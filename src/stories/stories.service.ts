import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Story, StoryMediaType } from './entities/story.entity';
import { StoryView } from './entities/story-view.entity';
import { StoryReaction } from './entities/story-reaction.entity';
import { StoryReply } from './entities/story-reply.entity';
import { CreateStoryDto } from './dto/create-story.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType, NotificationType } from '../notifications/entities/notification.entity';
import { GamificationService } from '../gamification/gamification.service';
import { FollowsService } from '../follows/follows.service';

const HIGHLIGHT_MIN_LEVEL = 3;

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const SOFT_DELETE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class StoriesService {
  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryView)
    private readonly storyViewRepository: Repository<StoryView>,
    @InjectRepository(StoryReaction)
    private readonly storyReactionRepository: Repository<StoryReaction>,
    @InjectRepository(StoryReply)
    private readonly storyReplyRepository: Repository<StoryReply>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly gamificationService: GamificationService,
    private readonly followsService: FollowsService,
  ) {}

  private async getActiveStoryOrThrow(id: string): Promise<Story> {
    const story = await this.storyRepository.findOne({
      where: { id, expiresAt: MoreThan(new Date()), deletedAt: IsNull() },
    });
    if (!story) {
      throw new NotFoundException(`Story with ID "${id}" not found or has expired`);
    }
    return story;
  }

async create(userId: string, dto: CreateStoryDto, file?: Express.Multer.File): Promise<Story> {
  const user = await this.usersService.findById(userId);
  if (!user) {
    throw new NotFoundException('User not found');
  }
  if (!file && !dto.textContent) {
    throw new BadRequestException('A story needs either media or text content');
  }

  let mediaUrl: string | null = null;
  let mediaType = StoryMediaType.TEXT;

  if (file) {
    const isVideo = file.mimetype.startsWith('video/');
    const result = await this.cloudinaryService.uploadFile(file, {
      folder: 'stories',
      resourceType: isVideo ? 'video' : 'image',
      transformation: [{ crop: 'limit', width: 720 }],
    });
    mediaUrl = result.secure_url;
    mediaType = isVideo ? StoryMediaType.VIDEO : StoryMediaType.IMAGE;
  }

  const story = this.storyRepository.create({
    userId,
    schoolId: user.schoolId,
    mediaUrl,
    mediaType,
    textContent: dto.textContent ?? null,
    backgroundColor: dto.backgroundColor ?? null,
    textAlign: dto.textAlign ?? 'center',       
    expiresAt: new Date(Date.now() + STORY_TTL_MS),
  });
  
  return this.storyRepository.save(story);
}


async getFeed(userId: string): Promise<any[]> {
    const blockedUserIds = await this.followsService.getBlockedUserIds(userId);

    const qb = this.storyRepository
      .createQueryBuilder('story')
      .leftJoin('story.user', 'user') 
      // Select columns explicitly to exclude user.password entirely
      .addSelect([
        'story.id',
        'story.mediaUrl',
        'story.mediaType',
        'story.textContent',
        'story.backgroundColor',
        'story.textAlign',
        'story.createdAt',
        'story.expiresAt',
        'story.userId',
        'user.id',
        'user.username',
        'user.firstName',
        'user.lastName',
        'user.profilePictureUrl',
      ])
      .where('story.expiresAt > :now', { now: new Date() })
      .andWhere('story.deletedAt IS NULL')
      .orderBy('story.createdAt', 'DESC');

    if (blockedUserIds.length > 0) {
      qb.andWhere('story.userId NOT IN (:...blockedUserIds)', { blockedUserIds });
    }

    const stories = await qb.getMany();

    // 1. Extract unique user IDs from the active feed
    const userIds = [...new Set(stories.map((s) => s.userId))];

    // 2. Fetch all user levels concurrently in parallel batches
    const levelMapArray = await Promise.all(
      userIds.map(async (id) => {
        try {
          const stats = await this.gamificationService.getMe(id);
          return { id, level: stats?.level ?? 1 };
        } catch (error) {
          console.error(`Failed to load gamification metrics for user ID ${id}:`, error);
          return { id, level: 1 }; // Safe default fallback
        }
      }),
    );

    // 3. Convert array map into a key-value look-up dictionary
    const levelLookup = levelMapArray.reduce((acc, current) => {
      acc[current.id] = current.level as number;
      return acc;
    }, {} as Record<string, number>);

    // 4. Inject resolved gamification levels via clean object spreading
    const storiesWithLevel = stories.map((story) => {
      if (story.user) {
        return {
          ...story,
          user: {
            ...story.user,
            level: levelLookup[story.userId] ?? 1,
          },
        };
      }
      return {
        ...story,
        user: null,
      };
    });

    // 5. Prioritize "Your Story" items to head positions
    const mine = storiesWithLevel.filter((s) => s.userId === userId);
    const others = storiesWithLevel.filter((s) => s.userId !== userId);
    
    return [...mine, ...others];
  }

  /** Used by GiftsService (Phase 4) to find the recipient. */
  async getGiftTarget(storyId: string): Promise<{ recipientId: string }> {
    const story = await this.getActiveStoryOrThrow(storyId);
    return { recipientId: story.userId };
  }

  async incrementGiftsCount(storyId: string): Promise<void> {
    await this.storyRepository.increment({ id: storyId }, 'giftsCount', 1);
  }

  async view(userId: string, id: string): Promise<Story> {
    const story = await this.getActiveStoryOrThrow(id);
    const existing = await this.storyViewRepository.findOne({ where: { storyId: id, viewerId: userId } });
    if (!existing) {
      await this.storyViewRepository.save(this.storyViewRepository.create({ storyId: id, viewerId: userId }));
      await this.storyRepository.increment({ id }, 'viewCount', 1);
    }
    return story;
  }

  async remove(userId: string, id: string): Promise<void> {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== userId) {
      throw new ForbiddenException('You can only delete your own story');
    }
    await this.storyRepository.remove(story);
  }

  async react(userId: string, id: string, emoji: string): Promise<void> {
    const story = await this.getActiveStoryOrThrow(id);
    const existing = await this.storyReactionRepository.findOne({ where: { storyId: id, userId } });

    if (existing) {
      existing.emoji = emoji;
      await this.storyReactionRepository.save(existing);
      return;
    }

    await this.storyReactionRepository.save(this.storyReactionRepository.create({ storyId: id, userId, emoji }));
    await this.storyRepository.increment({ id }, 'reactionsCount', 1);
    await this.notificationsService.notify(
      story.userId,
      userId,
      NotificationType.STORY_REACTION,
      NotificationTargetType.STORY,
      id,
    );
  }

  async unreact(userId: string, id: string): Promise<void> {
    const existing = await this.storyReactionRepository.findOne({ where: { storyId: id, userId } });
    if (!existing) return;
    await this.storyReactionRepository.remove(existing);
    await this.storyRepository.decrement({ id }, 'reactionsCount', 1);
  }

  async reply(userId: string, id: string, text: string): Promise<StoryReply> {
    const story = await this.getActiveStoryOrThrow(id);
    const saved = await this.storyReplyRepository.save(this.storyReplyRepository.create({ storyId: id, userId, text }));
    await this.notificationsService.notify(
      story.userId,
      userId,
      NotificationType.STORY_REPLY,
      NotificationTargetType.STORY,
      id,
    );
    return saved;
  }

  async getReplies(ownerId: string, id: string): Promise<StoryReply[]> {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== ownerId) {
      throw new ForbiddenException('Only the story owner can view replies');
    }
    return this.storyReplyRepository.find({ where: { storyId: id }, order: { createdAt: 'DESC' } });
  }

  async markRepliesRead(ownerId: string, id: string): Promise<void> {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== ownerId) {
      throw new ForbiddenException('Only the story owner can mark replies as read');
    }
    await this.storyReplyRepository.update({ storyId: id, isRead: false }, { isRead: true });
  }

  async highlight(userId: string, id: string): Promise<Story> {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== userId) {
      throw new ForbiddenException('You can only highlight your own story');
    }
    const { level } = await this.gamificationService.getMe(userId);
    if (level.level < HIGHLIGHT_MIN_LEVEL) {
      throw new ForbiddenException(`Story highlights unlock at level ${HIGHLIGHT_MIN_LEVEL}`);
    }
    story.isHighlighted = true;
    return this.storyRepository.save(story);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markExpiredStories(): Promise<void> {
    await this.storyRepository.update(
      { expiresAt: LessThan(new Date()), deletedAt: IsNull() },
      { deletedAt: new Date() },
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeSoftDeletedStories(): Promise<void> {
    // A nullable column compared with LessThan already excludes NULL rows in SQL
    // (deletedAt < x is unknown/false for NULL), so no separate NOT NULL check is needed.
    await this.storyRepository.delete({
      deletedAt: LessThan(new Date(Date.now() - SOFT_DELETE_GRACE_MS)),
    });
  }
}
