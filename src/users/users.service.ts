import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePrivacyDto } from './dto/update-privacy.dto';
import { Follow } from 'src/follows/entities/follow.entity';

import { Post } from 'src/posts/entities/post.entity';
import { GiftTransaction } from 'src/gifts/entities/gift-transaction.entity';
import { PostLike } from 'src/posts/entities/post-like.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { UserXp } from 'src/gamification/entities/user-xp.entity';
import { Level } from 'src/gamification/entities/level.entity';

export interface UserProfileStats {
  postsCount: number;
  likesCount: number;
  followersCount: number;
  followingCount: number;
  giftsCount: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(PostLike)
    private readonly likeRepository: Repository<PostLike>,
    @InjectRepository(GiftTransaction)
    private readonly giftRepository: Repository<GiftTransaction>,
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(UserXp)
    private readonly userXpRepository: Repository<UserXp>,
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['school', 'faculty', 'department'],
    });
  }

  async isFollowing(followerId: string, targetUserId: string): Promise<boolean> {
    if (!followerId || !targetUserId || followerId === targetUserId) return true;
    const record = await this.followRepository.findOne({
      where: { followerId, followingId: targetUserId },
    });
    return Boolean(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username: username.toLowerCase().trim() },
    });
  }

  async findTakenUsernames(usernames: string[]): Promise<string[]> {
    const records = await this.userRepository.find({
      where: { username: In(usernames) },
      select: ['username'],
    });
    return records.map((r) => r.username.toLowerCase());
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phoneNumber } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['school', 'faculty', 'department'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get total number of posts, likes received, followers, following, and gifts received for a user.
   */
  async getUserStats(userId: string): Promise<UserProfileStats> {
    const [
      postsCount,
      followersCount,
      followingCount,
      giftsCount,
      likesCountResult,
    ] = await Promise.all([
      this.postRepository.count({ where: { userId } }),
      this.followRepository.count({ where: { followingId: userId } }),
      this.followRepository.count({ where: { followerId: userId } }),
      this.giftRepository.count({ where: { recipientId: userId } }),
      this.likeRepository
        .createQueryBuilder('like')
        .innerJoin('like.post', 'post')
        .where('post.userId = :userId', { userId })
        .getCount(),
    ]);

    return {
      postsCount,
      followersCount,
      followingCount,
      giftsCount,
      likesCount: likesCountResult,
    };
  }

  async updatePrivacy(userId: string, dto: UpdatePrivacyDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Only touch the fields the client explicitly sent
    if (dto.privateProfile !== undefined) user.privateProfile = dto.privateProfile;
    if (dto.onlineStatus !== undefined) user.onlineStatus = dto.onlineStatus;
    if (dto.readReceipts !== undefined) user.readReceipts = dto.readReceipts;
    if (dto.activityStatus !== undefined) user.activityStatus = dto.activityStatus;
    if (dto.dataSharing !== undefined) user.dataSharing = dto.dataSharing;

    return this.userRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    if (data.username && data.username !== user.username) {
      const existing = await this.findByUsername(data.username);
      if (existing && existing.id !== id) {
        throw new ConflictException('Username already taken');
      }
    }

    Object.assign(user, data);
    await this.userRepository.save(user);
    return (await this.findById(id))!;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    await this.userRepository.remove(user);
  }

  async searchUsers(query: string, currentUserId?: string, limit = 20) {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
      return { items: [] };
    }

    const escapedQuery = trimmedQuery.replace(/[%_]/g, '\\$&');
    const searchPattern = `%${escapedQuery}%`;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('user.faculty', 'faculty')
      .leftJoinAndSelect('user.department', 'department');

    if (currentUserId) {
      qb.where('user.id != :currentUserId', { currentUserId });
    }

    const searchFilter = new Brackets((qbInner) => {
      qbInner
        .where('user.username ILIKE :searchPattern', { searchPattern })
        .orWhere('user.firstName ILIKE :searchPattern', { searchPattern })
        .orWhere('user.lastName ILIKE :searchPattern', { searchPattern })
        .orWhere('user.bio ILIKE :searchPattern', { searchPattern });
    });

    if (currentUserId) {
      qb.andWhere(searchFilter);
    } else {
      qb.where(searchFilter);
    }

    qb.orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.username', 'ASC')
      .take(limit);

    const users = await qb.getMany();

    if (!users || users.length === 0) {
      return { items: [] };
    }

    const userIds = users.map((u) => u.id);
    const followingSet =
      currentUserId && userIds.length > 0
        ? await this.getFollowingIdsSet(currentUserId, userIds)
        : new Set<string>();

    const searchAppLevelMap = await this.resolveAppLevels(userIds);

    const items = users.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      profileFrame: user.profileFrame || null,
      appLevel: searchAppLevelMap.get(user.id) || null,
      bio: user.bio,
      isFollowing: followingSet.has(user.id),
      school: user.school ? { id: user.school.id, name: user.school.name } : null,
      faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
    }));

    return { items };
  }


  /**
   * Resolve appLevel (full Level entity) for a set of user IDs.
   * Returns a Map<userId, Level | null>.
   */
  private async resolveAppLevels(userIds: string[]): Promise<Map<string, any | null>> {
    if (userIds.length === 0) return new Map();
    const allLevels = await this.levelRepository.find({ order: { level: 'ASC' } });
    const xpData = await this.userXpRepository.find({ where: { userId: In(userIds) } });
    const xpMap = new Map(xpData.map((x) => [x.userId, x]));
    const result = new Map<string, any | null>();
    for (const uid of userIds) {
      const xp = xpMap.get(uid);
      const totalXp = xp?.totalXp ?? 0;
      const matched = allLevels.find(
        (lvl) => totalXp >= lvl.minXp && (lvl.maxXp === null || totalXp <= lvl.maxXp),
      ) || allLevels[0] || null;
      result.set(uid, matched || null);
    }
    return result;
  }

  async getTrendingUsers(currentUserId?: string, limit = 10) {
    // 1. Fetch active, non-deleted users with their XP data
    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('user.faculty', 'faculty')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.status = :status', { status: 'active' })
      .andWhere('user.deletedAt IS NULL')
      .andWhere('user.isOnboardingComplete = :complete', { complete: true })
      .orderBy('user.createdAt', 'DESC')
      .take(limit * 5) // fetch more to rank in-memory
      .getMany();

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) {
      return { items: [] };
    }

    // 2. Fetch XP data for these users
    const xpData = await this.userXpRepository.find({ where: { userId: In(userIds) } });
    const xpMap = new Map(xpData.map((x) => [x.userId, x]));

    // 3. Fetch follower counts for all these users
    const followerCounts = await this.followRepository
      .createQueryBuilder('follow')
      .select('follow.followingId', 'followingId')
      .addSelect('COUNT(*)', 'count')
      .where('follow.followingId IN (:...userIds)', { userIds })
      .groupBy('follow.followingId')
      .getRawMany();
    const followerMap = new Map<string, number>(
      followerCounts.map((r) => [r.followingId, Number(r.count)]),
    );

    // 4. Rank: combination of level + followers
    //    Score = (level * 1000) + followerCount
    //    This puts higher-level users first, with followers as tiebreaker
    const rankedUsers = users
      .map((user) => {
        const xp = xpMap.get(user.id);
        const level = xp?.currentLevel ?? 1;
        const totalXp = xp?.totalXp ?? 0;
        const followers = followerMap.get(user.id) ?? 0;
        return {
          ...user,
          currentLevel: level,
          totalXp,
          followerCount: followers,
          trendingScore: level * 1000 + followers,
        };
      })
      .sort((a, b) => b.trendingScore - a.trendingScore || b.totalXp - a.totalXp)
      .slice(0, limit);

    // 5. Check which ranked users the current user follows
    const rankedIds = rankedUsers.map((u) => u.id);

    // 6. Resolve appLevel for all ranked users
    const appLevelMap = await this.resolveAppLevels(rankedIds);
    const followingSet = currentUserId
      ? await this.getFollowingIdsSet(currentUserId, rankedIds)
      : new Set<string>();

    return {
      items: rankedUsers.map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        profileFrame: user.profileFrame || null,
        bio: user.bio,
        isFollowing: followingSet.has(user.id),
        currentLevel: user.currentLevel,
        totalXp: user.totalXp,
        followerCount: user.followerCount,
        appLevel: appLevelMap.get(user.id) || null,
        school: user.school ? { id: user.school.id, name: user.school.name } : null,
        faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
      })),
    };
  }

  async getSuggestedUsers(currentUserId?: string, limit = 10) {
    const qb = this.userRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.school', 'school')
      .leftJoinAndSelect('user.faculty', 'faculty')
      .leftJoinAndSelect('user.department', 'department')
      .where('school.id IS NOT NULL')
      .andWhere('faculty.id IS NOT NULL')
      .andWhere('department.id IS NOT NULL');

    if (currentUserId) {
      qb.andWhere('user.id != :currentUserId', { currentUserId });
    }

    const suggested = await qb
      .take(limit)
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    const userIds = suggested.map((user) => user.id);
    const followingSet = currentUserId
      ? await this.getFollowingIdsSet(currentUserId, userIds)
      : new Set<string>();
    const suggestedAppLevelMap = await this.resolveAppLevels(userIds);

    return {
      items: suggested.map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        profileFrame: user.profileFrame || null,
        appLevel: suggestedAppLevelMap.get(user.id) || null,
        bio: user.bio,
        isFollowing: followingSet.has(user.id),
        school: user.school ? { id: user.school.id, name: user.school.name } : null,
        faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
      })),
    };
  }

  // HELPER & PROFILE UPDATE METHODS
  // --------------------------------------------------------------------------

  private async getFollowingIdsSet(currentUserId: string, targetUserIds: string[]): Promise<Set<string>> {
    if (!targetUserIds.length) return new Set();

    const follows = await this.followRepository.find({
      where: {
        followerId: currentUserId,
        followingId: In(targetUserIds),
      },
      select: ['followingId'],
    });

    return new Set(follows.map((follow) => follow.followingId));
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    file?: Express.Multer.File,
  ): Promise<User> {
    let profilePictureUrl = dto.profilePictureUrl;

    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(file, {
        folder: 'school-social/profile-pictures',
        resourceType: 'image',
      });
      profilePictureUrl = uploadResult.secure_url;
    }

    return this.update(userId, {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      profilePictureUrl,
    });
  }
}