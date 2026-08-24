import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, ILike, Repository, LessThan, LessThanOrEqual } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { UserBlock } from './entities/user-block.entity';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications/entities/notification.entity';

export interface FollowUserResponseDto {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePictureUrl?: string;
  bio?: string;
  appLevel?: any;
  isFollowing?: boolean;
}

export interface PaginatedFollowResponse<T> {
  items: T[];
  nextCursor: string | null;
}

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
    private readonly gamificationService: GamificationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (existing) return;
    await this.followRepository.save(this.followRepository.create({ followerId, followingId }));

    // Notify the followed user that they gained a new follower (skipped when following yourself)
    await this.notificationsService.notify(
      followingId,
      followerId,
      NotificationType.NEW_FOLLOWER,
      NotificationTargetType.USER,
      followerId,
    );
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (!existing) return;
    await this.followRepository.remove(existing);
  }

  /** Get paginated followers who follow `targetUserId`, with optional search and cursor support. */
  async getFollowers(
    targetUserId: string,
    currentUserId?: string,
    search?: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedFollowResponse<FollowUserResponseDto>> {
    const qb = this.followRepository
      .createQueryBuilder('follow')
      .leftJoinAndSelect('follow.follower', 'follower')
      .where('follow.followingId = :targetUserId', { targetUserId });

    if (search && search.trim().length > 0) {
      const queryTerm = `%${search.trim()}%`;
      qb.andWhere(
        '(follower.username ILike :query OR follower.firstName ILike :query OR follower.lastName ILike :query)',
        { query: queryTerm },
      );
    }

    if (cursor) {
      const { createdAt, id } = this.decodeCursor(cursor);
      qb.andWhere(
        '(follow.createdAt < :createdAt OR (follow.createdAt = :createdAt AND follow.id < :id))',
        { createdAt, id },
      );
    }

    qb.orderBy('follow.createdAt', 'DESC')
      .addOrderBy('follow.id', 'DESC')
      .take(limit + 1);

    const follows = await qb.getMany();
    const hasMore = follows.length > limit;
    const itemsToProcess = hasMore ? follows.slice(0, limit) : follows;
    const lastItem = itemsToProcess[itemsToProcess.length - 1];

    const followers = itemsToProcess.map((f) => f.follower).filter(Boolean);
    if (!followers.length) {
      return { items: [], nextCursor: null };
    }

    const followerIds = followers.map((u) => u.id);

    const [followingSet, levelMapArray] = await Promise.all([
      currentUserId
        ? this.getFollowingIdsSet(currentUserId, followerIds)
        : Promise.resolve(new Set<string>()),
      Promise.all(
        followerIds.map(async (id) => {
          try {
            const stats = await this.gamificationService.getMe(id);
            return { id, level: stats.level };
          } catch {
            return { id, level: null };
          }
        }),
      ),
    ]);

    const levelLookup = Object.fromEntries(
      levelMapArray.map((x) => [x.id, x.level]),
    );

    const items = followers.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      appLevel: levelLookup[user.id] ?? null,
      isFollowing: followingSet.has(user.id),
    }));

    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem.createdAt, lastItem.id) : null;

    return {
      items,
      nextCursor,
    };
  }

  /** Get paginated users that `targetUserId` follows, with optional search and cursor support. */
  async getFollowing(
    targetUserId: string,
    currentUserId?: string,
    search?: string,
    limit = 20,
    cursor?: string,
  ): Promise<PaginatedFollowResponse<FollowUserResponseDto>> {
    const qb = this.followRepository
      .createQueryBuilder('follow')
      .leftJoinAndSelect('follow.following', 'following')
      .where('follow.followerId = :targetUserId', { targetUserId });

    if (search && search.trim().length > 0) {
      const queryTerm = `%${search.trim()}%`;
      qb.andWhere(
        '(following.username ILike :query OR following.firstName ILike :query OR following.lastName ILike :query)',
        { query: queryTerm },
      );
    }

    if (cursor) {
      const { createdAt, id } = this.decodeCursor(cursor);
      qb.andWhere(
        '(follow.createdAt < :createdAt OR (follow.createdAt = :createdAt AND follow.id < :id))',
        { createdAt, id },
      );
    }

    qb.orderBy('follow.createdAt', 'DESC')
      .addOrderBy('follow.id', 'DESC')
      .take(limit + 1);

    const follows = await qb.getMany();
    const hasMore = follows.length > limit;
    const itemsToProcess = hasMore ? follows.slice(0, limit) : follows;
    const lastItem = itemsToProcess[itemsToProcess.length - 1];

    const followingUsers = itemsToProcess.map((f) => f.following).filter(Boolean);
    if (!followingUsers.length) {
      return { items: [], nextCursor: null };
    }

    const followingIds = followingUsers.map((u) => u.id);

    const [followingSet, levelMapArray] = await Promise.all([
      currentUserId
        ? this.getFollowingIdsSet(currentUserId, followingIds)
        : Promise.resolve(new Set<string>()),
      Promise.all(
        followingIds.map(async (id) => {
          try {
            const stats = await this.gamificationService.getMe(id);
            return { id, level: stats.level };
          } catch {
            return { id, level: null };
          }
        }),
      ),
    ]);

    const levelLookup = Object.fromEntries(
      levelMapArray.map((x) => [x.id, x.level]),
    );

    const items = followingUsers.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      appLevel: levelLookup[user.id] ?? null,
      isFollowing: followingSet.has(user.id),
    }));

    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem.createdAt, lastItem.id) : null;

    return {
      items,
      nextCursor,
    };
  }

  private encodeCursor(createdAt: Date, id: any): string {
    return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: any } {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    return { createdAt: new Date(decoded.createdAt), id: decoded.id };
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    return !!existing;
  }

  async getFollowingIdsSet(followerId: string, targetUserIds: string[]): Promise<Set<string>> {
    if (!targetUserIds.length) return new Set();

    const follows = await this.followRepository.find({
      where: {
        followerId,
        followingId: In(targetUserIds),
      },
      select: ['followingId'],
    });

    return new Set(follows.map((f) => f.followingId));
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }
    const existing = await this.blockRepository.findOne({ where: { blockerId, blockedId } });
    if (existing) return;
    await this.blockRepository.save(this.blockRepository.create({ blockerId, blockedId }));
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const existing = await this.blockRepository.findOne({ where: { blockerId, blockedId } });
    if (!existing) return;
    await this.blockRepository.remove(existing);
  }

  async getBlockedUsers(blockerId: string): Promise<any[]> {
  const blocks = await this.blockRepository
    .createQueryBuilder('block')
    .leftJoinAndSelect('block.blocked', 'blockedUser') // Join the blocked user e
    .where('block.blockerId = :blockerId', { blockerId })
    .orderBy('block.createdAt', 'DESC')
    .getMany();

  // Return the mapped user details along with the block ID/timestamp if needed
  return blocks.map((block) => {
    const user = (block as any).blocked;
    return {
      blockId: block.id,
      blockedAt: (block as any).createdAt,
      user: user
        ? {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
            bio: user.bio,
          }
        : null,
    };
  }).filter((item) => item.user !== null);
}

  async isBlocked(userIdA: string, userIdB: string): Promise<boolean> {
    const count = await this.blockRepository
      .createQueryBuilder('block')
      .where(
        '(block.blockerId = :a AND block.blockedId = :b) OR (block.blockerId = :b AND block.blockedId = :a)',
        { a: userIdA, b: userIdB },
      )
      .getCount();
    return count > 0;
  }

  /** Check if a specific block relation exists strictly from blockerId -> blockedId */
async isBlocker(blockerId: string, blockedId: string): Promise<boolean> {
  const existing = await this.blockRepository.findOne({ 
    where: { blockerId, blockedId } 
  });
  return !!existing;
}

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockRepository
      .createQueryBuilder('block')
      .where('block.blockerId = :userId OR block.blockedId = :userId', { userId })
      .getMany();

    return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
  }
}