import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserSearchHistory } from './entities/user-search-history.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Follow } from 'src/follows/entities/follow.entity';

import { Post } from 'src/posts/entities/post.entity';
import { GiftTransaction } from 'src/gifts/entities/gift-transaction.entity';
import { PostLike } from 'src/posts/entities/post-like.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

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
    @InjectRepository(UserSearchHistory)
    private readonly searchHistoryRepository: Repository<UserSearchHistory>,
    private readonly cloudinaryService: CloudinaryService,
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

    const items = users.map((user) => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      isFollowing: followingSet.has(user.id),
      school: user.school ? { id: user.school.id, name: user.school.name } : null,
      faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
      department: user.department ? { id: user.department.id, name: user.department.name } : null,
    }));

    return { items };
  }

  async getTrendingUsers(currentUserId?: string, limit = 10) {
    const users = await this.userRepository.find({
      relations: ['school', 'faculty', 'department'],
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const followerCounts = await this.followRepository
      .createQueryBuilder('follow')
      .select('follow.followingId', 'followingId')
      .addSelect('COUNT(*)', 'followersCount')
      .groupBy('follow.followingId')
      .getRawMany();

    const countMap = new Map<string, number>(
      followerCounts.map((item) => [item.followingId, Number(item.followersCount)]),
    );

    const rankedUsers = users
      .map((user) => ({
        ...user,
        followerCount: countMap.get(user.id) ?? 0,
      }))
      .sort((a, b) => b.followerCount - a.followerCount || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    const userIds = rankedUsers.map((user) => user.id);
    const followingSet = currentUserId
      ? await this.getFollowingIdsSet(currentUserId, userIds)
      : new Set<string>();

    return {
      items: rankedUsers.map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        bio: user.bio,
        isFollowing: followingSet.has(user.id),
        school: user.school ? { id: user.school.id, name: user.school.name } : null,
        faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
      })),
    };
  }

  async getSuggestedUsers(currentUserId?: string, limit = 10) {
    const where = currentUserId ? { id: Not(In([currentUserId])) } : {};
    const suggested = await this.userRepository.find({
      where,
      relations: ['school', 'faculty', 'department'],
      take: limit,
      order: { createdAt: 'DESC' },
    });

    const userIds = suggested.map((user) => user.id);
    const followingSet = currentUserId
      ? await this.getFollowingIdsSet(currentUserId, userIds)
      : new Set<string>();

    return {
      items: suggested.map((user) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        bio: user.bio,
        isFollowing: followingSet.has(user.id),
        school: user.school ? { id: user.school.id, name: user.school.name } : null,
        faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // 🔍 RECENT SEARCH HISTORY METHODS
  // --------------------------------------------------------------------------

  /**
   * Fetch a user's recent search history.
   */
  async getRecentSearches(userId: string, limit = 10) {
    const rows = await this.searchHistoryRepository.find({
      where: { userId },
      relations: [
        'searchedUser',
        'searchedUser.school',
        'searchedUser.faculty',
        'searchedUser.department',
      ],
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return {
      items: rows
        .filter((row) => row.searchedUser !== null)
        .map((row) => {
          const user = row.searchedUser;
          return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            profilePictureUrl: user.profilePictureUrl,
            bio: user.bio,
            school: user.school ? { id: user.school.id, name: user.school.name } : null,
            faculty: user.faculty ? { id: user.faculty.id, name: user.faculty.name } : null,
            department: user.department ? { id: user.department.id, name: user.department.name } : null,
          };
        }),
    };
  }

  /**
   * Add a user to recent search history (or move to top if existing).
   * Automatically caps total search history at 10 items.
   */
  async addRecentSearch(userId: string, searchedUserId: string) {
    if (userId === searchedUserId) return { success: true };

    const searchedUser = await this.userRepository.findOne({ where: { id: searchedUserId } });
    if (!searchedUser) {
      throw new NotFoundException('Searched user not found');
    }

    // Remove old entry if exists to bump it to the top with a new timestamp
    const existing = await this.searchHistoryRepository.findOne({
      where: { userId, searchedUserId },
    });

    if (existing) {
      await this.searchHistoryRepository.remove(existing);
    }

    const historyEntry = this.searchHistoryRepository.create({ userId, searchedUserId });
    await this.searchHistoryRepository.save(historyEntry);

    // Keep only the 10 most recent searches
    const rows = await this.searchHistoryRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (rows.length > 10) {
      const stale = rows.slice(10);
      await this.searchHistoryRepository.remove(stale);
    }

    return { success: true };
  }

  /**
   * Remove a specific user from the search history.
   */
  async removeRecentSearch(userId: string, searchedUserId: string) {
    const existing = await this.searchHistoryRepository.findOne({
      where: { userId, searchedUserId },
    });

    if (existing) {
      await this.searchHistoryRepository.remove(existing);
    }

    return { success: true };
  }
  
  
  /**
   * Clear all recent search history for a user.
   */
  async clearAllRecentSearches(userId: string) {
    await this.searchHistoryRepository.delete({ userId });
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // ⚙️ HELPER & PROFILE UPDATE METHODS
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