import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from './entities/follow.entity';
import { UserBlock } from './entities/user-block.entity';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(UserBlock)
    private readonly blockRepository: Repository<UserBlock>,
  ) {}

  async follow(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (existing) return;
    await this.followRepository.save(this.followRepository.create({ followerId, followingId }));
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    if (!existing) return;
    await this.followRepository.remove(existing);
  }

  async getFollowers(userId: string): Promise<Follow[]> {
    return this.followRepository.find({ where: { followingId: userId } });
  }

  async getFollowing(userId: string): Promise<Follow[]> {
    return this.followRepository.find({ where: { followerId: userId } });
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const existing = await this.followRepository.findOne({ where: { followerId, followingId } });
    return !!existing;
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

  async getBlockedUsers(blockerId: string): Promise<UserBlock[]> {
    return this.blockRepository.find({ where: { blockerId } });
  }

  /** True if either user has blocked the other — used to gate new interactions. */
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

  /** IDs of users blocked in either direction relative to `userId` — used to exclude content in feed queries. */
  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockRepository
      .createQueryBuilder('block')
      .where('block.blockerId = :userId OR block.blockedId = :userId', { userId })
      .getMany();

    return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
  }
}
