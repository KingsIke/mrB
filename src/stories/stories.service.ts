import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
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
import { Level } from '../gamification/entities/level.entity';
import { FollowsService } from '../follows/follows.service';
import { GiftTransaction, GiftTargetType } from '../gifts/entities/gift-transaction.entity';
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from '../common/pagination/cursor-pagination.dto';

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
    @InjectRepository(GiftTransaction)
    private readonly giftTransactionRepository: Repository<GiftTransaction>,
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
        'user.profileFrame',
      ])
      .where('story.expiresAt > :now', { now: new Date() })
      .andWhere('story.deletedAt IS NULL')
      .orderBy('story.createdAt', 'DESC');

    if (blockedUserIds.length > 0) {
      qb.andWhere('story.userId NOT IN (:...blockedUserIds)', { blockedUserIds });
    }

    const stories = await qb.getMany();

    // 0. Load the current user's own reactions for these stories so the
    //    client can render filled hearts and toggle like/unlike correctly.
    const storyIds = stories.map((s) => s.id);
    const myReactions: StoryReaction[] =
      storyIds.length > 0
        ? await this.storyReactionRepository.find({
            where: { storyId: In(storyIds), userId },
          })
        : [];
    const myReactionByStory = new Map<string, string>(
      myReactions.map((r) => [r.storyId, r.emoji]),
    );

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
          myReaction: myReactionByStory.get(story.id) ?? null,
          user: {
            ...story.user,
            level: levelLookup[story.userId] ?? 1,
          },
        };
      }
      return {
        ...story,
        myReaction: null,
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
    // The owner opening their own story is not a "view" — don't inflate
    // viewCount or have them show up in their own viewers list.
    if (userId === story.userId) return story;

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

  async react(
    userId: string,
    id: string,
    emoji: string,
  ): Promise<{ created: boolean; reactionsCount: number }> {
    const story = await this.getActiveStoryOrThrow(id);
    const existing = await this.storyReactionRepository.findOne({
      where: { storyId: id, userId },
    });

    // The current user already reacted -> just update their emoji in place
    // (no double-counting, no duplicate reaction rows).
    if (existing) {
      existing.emoji = emoji;
      await this.storyReactionRepository.save(existing);
      return { created: false, reactionsCount: story.reactionsCount };
    }

    await this.storyReactionRepository.save(
      this.storyReactionRepository.create({ storyId: id, userId, emoji }),
    );
    await this.storyRepository.increment({ id }, 'reactionsCount', 1);
    await this.notificationsService.notify(
      story.userId,
      userId,
      NotificationType.STORY_REACTION,
      NotificationTargetType.STORY,
      id,
    );
    return { created: true, reactionsCount: story.reactionsCount + 1 };
  }

  async unreact(
    userId: string,
    id: string,
  ): Promise<{ removed: boolean; reactionsCount: number }> {
    const existing = await this.storyReactionRepository.findOne({
      where: { storyId: id, userId },
    });
    if (!existing) {
      // Nothing to remove — tell the client the current authoritative count
      // so it can correct itself instead of blindly decrementing.
      const story = await this.storyRepository.findOne({ where: { id } });
      return { removed: false, reactionsCount: story?.reactionsCount ?? 0 };
    }
    await this.storyReactionRepository.remove(existing);
    await this.storyRepository.decrement({ id }, 'reactionsCount', 1);
    const story = await this.storyRepository.findOne({ where: { id } });
    return {
      removed: true,
      reactionsCount: Math.max(0, story?.reactionsCount ?? 0),
    };
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

  async getViewers(ownerId: string, id: string, pagination: CursorPaginationDto): Promise<
    CursorPaginated<{
      id: string;
      username: string | null;
      profilePictureUrl: string | null;
      profileFrame: string | null;
      viewedAt: Date;
      level: Level;
    }>
  > {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== ownerId) {
      throw new ForbiddenException('Only the story owner can see who has viewed this story');
    }

    const limit = pagination.limit ?? 20;
    const qb = this.storyViewRepository
      .createQueryBuilder('view')
      .leftJoin('view.viewer', 'viewer')
      // Select columns explicitly to exclude viewer.password entirely
      .addSelect(['viewer.id', 'viewer.username', 'viewer.profilePictureUrl', 'viewer.profileFrame'])
      .where('view.storyId = :id', { id })
      // Defensive: excludes any self-view rows recorded before this guard
      // existed in view() — the owner should never appear in their own list.
      .andWhere('view.viewerId != :ownerId', { ownerId });

    if (pagination.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(pagination.cursor);
      qb.andWhere('(view.createdAt < :createdAt OR (view.createdAt = :createdAt AND view.id < :cursorId))', {
        createdAt,
        cursorId,
      });
    }

    qb.orderBy('view.createdAt', 'DESC').addOrderBy('view.id', 'DESC').take(limit + 1);

    const views = await qb.getMany();
    const hasMore = views.length > limit;
    const page = hasMore ? views.slice(0, limit) : views;
    const viewersOnly = page.filter((v) => v.viewer);

    const levelByUserId = await this.gamificationService.getLevelsForUsers(viewersOnly.map((v) => v.viewer.id));

    const items = viewersOnly.map((v) => ({
      id: v.viewer.id,
      username: v.viewer.username,
      profilePictureUrl: v.viewer.profilePictureUrl,
      profileFrame: v.viewer.profileFrame,
      viewedAt: v.createdAt,
      level: levelByUserId.get(v.viewer.id) as Level,
    }));

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getReactions(ownerId: string, id: string, pagination: CursorPaginationDto): Promise<
    CursorPaginated<{
      id: string;
      username: string | null;
      profilePictureUrl: string | null;
      profileFrame: string | null;
      emoji: string;
      reactedAt: Date;
      level: Level;
    }>
  > {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== ownerId) {
      throw new ForbiddenException('Only the story owner can see who has reacted to this story');
    }

    const limit = pagination.limit ?? 20;
    const qb = this.storyReactionRepository
      .createQueryBuilder('reaction')
      .leftJoin('reaction.user', 'user')
      // Select columns explicitly to exclude user.password entirely
      .addSelect(['user.id', 'user.username', 'user.profilePictureUrl', 'user.profileFrame'])
      .where('reaction.storyId = :id', { id });

    if (pagination.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(pagination.cursor);
      qb.andWhere(
        '(reaction.createdAt < :createdAt OR (reaction.createdAt = :createdAt AND reaction.id < :cursorId))',
        { createdAt, cursorId },
      );
    }

    qb.orderBy('reaction.createdAt', 'DESC').addOrderBy('reaction.id', 'DESC').take(limit + 1);

    const reactions = await qb.getMany();
    const hasMore = reactions.length > limit;
    const page = hasMore ? reactions.slice(0, limit) : reactions;
    const reactionsOnly = page.filter((r) => r.user);

    const levelByUserId = await this.gamificationService.getLevelsForUsers(reactionsOnly.map((r) => r.user.id));

    const items = reactionsOnly.map((r) => ({
      id: r.user.id,
      username: r.user.username,
      profilePictureUrl: r.user.profilePictureUrl,
      profileFrame: r.user.profileFrame,
      emoji: r.emoji,
      reactedAt: r.createdAt,
      level: levelByUserId.get(r.user.id) as Level,
    }));

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getGifters(ownerId: string, id: string, pagination: CursorPaginationDto): Promise<
    CursorPaginated<{
      id: string;
      username: string | null;
      profilePictureUrl: string | null;
      profileFrame: string | null;
      giftName: string;
      coinsCost: number;
      giftedAt: Date;
      level: Level;
    }>
  > {
    const story = await this.getActiveStoryOrThrow(id);
    if (story.userId !== ownerId) {
      throw new ForbiddenException('Only the story owner can see who has gifted this story');
    }

    const limit = pagination.limit ?? 20;
    const qb = this.giftTransactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.sender', 'sender')
      .leftJoin('transaction.gift', 'gift')
      // Select columns explicitly to exclude sender.password entirely
      .addSelect(['sender.id', 'sender.username', 'sender.profilePictureUrl', 'sender.profileFrame'])
      .addSelect(['gift.name'])
      .where('transaction.targetType = :targetType', { targetType: GiftTargetType.STORY })
      .andWhere('transaction.targetId = :id', { id });

    if (pagination.cursor) {
      const { createdAt, id: cursorId } = decodeCursor(pagination.cursor);
      qb.andWhere(
        '(transaction.createdAt < :createdAt OR (transaction.createdAt = :createdAt AND transaction.id < :cursorId))',
        { createdAt, cursorId },
      );
    }

    qb.orderBy('transaction.createdAt', 'DESC').addOrderBy('transaction.id', 'DESC').take(limit + 1);

    const gifts = await qb.getMany();
    const hasMore = gifts.length > limit;
    const page = hasMore ? gifts.slice(0, limit) : gifts;
    const giftsOnly = page.filter((g) => g.sender);

    const levelByUserId = await this.gamificationService.getLevelsForUsers(giftsOnly.map((g) => g.sender.id));

    const items = giftsOnly.map((g) => ({
      id: g.sender.id,
      username: g.sender.username,
      profilePictureUrl: g.sender.profilePictureUrl,
      profileFrame: g.sender.profileFrame,
      giftName: g.gift?.name ?? 'Gift',
      coinsCost: g.coinsCost,
      giftedAt: g.createdAt,
      level: levelByUserId.get(g.sender.id) as Level,
    }));

    const last = page[page.length - 1];
    return {
      items,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
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
