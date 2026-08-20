import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { Gift } from '../gifts/entities/gift.entity';
import { GiftTransaction } from '../gifts/entities/gift-transaction.entity';
import { Post } from '../posts/entities/post.entity';
import { Story } from '../stories/entities/story.entity';
import {
  CoinPurchase,
  CoinPurchaseStatus,
} from '../coins/entities/coin-purchase.entity';
import {
  CoinTransaction,
  CoinTransactionType,
} from '../coins/entities/coin-transaction.entity';
import { PastQuestion } from '../past-questions/entities/past-question.entity';
import { PastQuestionAnalyticsQueryDto } from './dto/past-question-analytics.dto';
import { UpdateGiftDto } from './dto/update-gift.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateVerificationDto } from './dto/update-verification.dto';
import {
  AdminTransactionQueryDto,
  AdminTransactionType,
} from './dto/transaction-query.dto';

/** Lightweight user shape used by the admin transaction views. */
export interface AdminUserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string;
  profilePictureUrl: string | null;
}

export interface TopPurchaser {
  user: AdminUserSummary;
  /** Total coins credited from successful purchases. */
  totalCoins: number;
  /** Total amount paid across successful purchases. */
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseAt: string;
}

export interface TopRecipient {
  user: AdminUserSummary;
  /** Total gifts received. */
  giftCount: number;
  /** Total coin value of gifts received. */
  totalCoinsValue: number;
  lastGiftAt: string;
}

export type AdminTransactionRow =
  | {
      kind: 'purchase';
      id: string;
      user: AdminUserSummary;
      amountPaid: number;
      currency: string;
      coinsCredited: number;
      status: string;
      reference: string;
      createdAt: string;
    }
  | {
      kind: 'gift';
      id: string;
      sender: AdminUserSummary;
      recipient: AdminUserSummary;
      gift: { id: string; name: string };
      coinsCost: number;
      targetType: string;
      createdAt: string;
    }
  | {
      kind: 'ledger';
      id: string;
      user: AdminUserSummary;
      amount: number;
      type: string;
      balanceAfter: number;
      referenceId: string | null;
      createdAt: string;
    };

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Gift)
    private readonly giftRepository: Repository<Gift>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(CoinPurchase)
    private readonly coinPurchaseRepository: Repository<CoinPurchase>,
    @InjectRepository(CoinTransaction)
    private readonly coinTransactionRepository: Repository<CoinTransaction>,
    @InjectRepository(GiftTransaction)
    private readonly giftTransactionRepository: Repository<GiftTransaction>,
    @InjectRepository(PastQuestion)
    private readonly pastQuestionRepository: Repository<PastQuestion>,
  ) {}

  // ------------------------------------------------------------------
  // Users
  // ------------------------------------------------------------------

  async setUserStatus(id: string, dto: UpdateUserStatusDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    user.status = dto.status as UserStatus;
    return this.userRepository.save(user);
  }

  /**
   * Soft-deletes a user (sets deletedAt) so related rows are not
   * orphaned. Suspended users and deleted users can no longer sign in.
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    user.deletedAt = new Date();
    await this.userRepository.save(user);
  }

  // ------------------------------------------------------------------
  // Bulk user actions
  // ------------------------------------------------------------------

  async bulkSetUserStatus(ids: string[], status: string): Promise<{
    updated: string[];
    notFound: string[];
  }> {
    const updated: string[] = [];
    const notFound: string[] = [];

    for (const id of ids) {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        notFound.push(id);
        continue;
      }
      user.status = status as UserStatus;
      await this.userRepository.save(user);
      updated.push(id);
    }

    return { updated, notFound };
  }

  async bulkDeleteUsers(ids: string[]): Promise<{
    deleted: string[];
    notFound: string[];
  }> {
    const deleted: string[] = [];
    const notFound: string[] = [];

    for (const id of ids) {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        notFound.push(id);
        continue;
      }
      user.deletedAt = new Date();
      await this.userRepository.save(user);
      deleted.push(id);
    }

    return { deleted, notFound };
  }

  async bulkSetVerification(ids: string[], status: string): Promise<{
    updated: string[];
    notFound: string[];
    skipped: string[];
  }> {
    const updated: string[] = [];
    const notFound: string[] = [];
    const skipped: string[] = [];

    for (const id of ids) {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        notFound.push(id);
        continue;
      }
      if (status === 'verified' && !user.schoolIdCardUrl && !user.administrationLetterUrl) {
        skipped.push(id);
        continue;
      }
      user.verificationStatus = status;
      await this.userRepository.save(user);
      updated.push(id);
    }

    return { updated, notFound, skipped };
  }

  // ------------------------------------------------------------------
  // Student verification
  // ------------------------------------------------------------------

  /**
   * Users who have uploaded verification documents or whose status is no
   * longer "unverified". Pending submissions are listed first so admins
   * can review the queue.
   */
  async listVerifications(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: [
        { verificationStatus: 'pending' },
        { verificationStatus: Not('unverified') },
        { schoolIdCardUrl: Not(IsNull()) },
        { administrationLetterUrl: Not(IsNull()) },
      ],
      relations: ['school', 'faculty', 'department'],
      order: { createdAt: 'DESC' },
    });

    const priority: Record<string, number> = {
      pending: 0,
      verified: 1,
      rejected: 2,
      unverified: 3,
    };
    users.sort((a, b) => {
      const diff =
        (priority[a.verificationStatus] ?? 9) -
        (priority[b.verificationStatus] ?? 9);
      if (diff !== 0) return diff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return users;
  }

  async updateVerification(id: string, dto: UpdateVerificationDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    if (
      dto.status === 'verified' &&
      !user.schoolIdCardUrl &&
      !user.administrationLetterUrl
    ) {
      throw new BadRequestException(
        'Cannot verify a user who has not uploaded any documents',
      );
    }
    user.verificationStatus = dto.status;
    return this.userRepository.save(user);
  }

  // ------------------------------------------------------------------
  // Gifts
  // ------------------------------------------------------------------

  /** List every gift, including inactive ones (the public endpoint only shows active). */
  async listAllGifts(): Promise<Gift[]> {
    return this.giftRepository.find({
      order: { isActive: 'DESC', name: 'ASC' },
    });
  }

  async updateGift(id: string, dto: UpdateGiftDto): Promise<Gift> {
    const gift = await this.giftRepository.findOne({ where: { id } });
    if (!gift) {
      throw new NotFoundException(`Gift with ID "${id}" not found`);
    }
    Object.assign(gift, dto);
    return this.giftRepository.save(gift);
  }

  async deleteGift(id: string): Promise<void> {
    const gift = await this.giftRepository.findOne({ where: { id } });
    if (!gift) {
      throw new NotFoundException(`Gift with ID "${id}" not found`);
    }
    try {
      await this.giftRepository.remove(gift);
    } catch (error) {
      // Gifts referenced by transactions cannot be hard-deleted
      // (FK constraint). Deactivate it so it leaves the catalog.
      gift.isActive = false;
      await this.giftRepository.save(gift);
      throw new BadRequestException(
        'This gift has been used in transactions and cannot be deleted; it was deactivated instead.',
      );
    }
  }

  /**
   * Bulk delete gifts. Returns a summary of what succeeded, failed,
   * or was deactivated instead (due to FK constraints).
   */
  async deleteGifts(ids: string[]): Promise<{
    deleted: string[];
    deactivated: string[];
    notFound: string[];
  }> {
    const deleted: string[] = [];
    const deactivated: string[] = [];
    const notFound: string[] = [];

    for (const id of ids) {
      const gift = await this.giftRepository.findOne({ where: { id } });
      if (!gift) {
        notFound.push(id);
        continue;
      }
      try {
        await this.giftRepository.remove(gift);
        deleted.push(id);
      } catch {
        // FK constraint — deactivate instead
        gift.isActive = false;
        await this.giftRepository.save(gift);
        deactivated.push(id);
      }
    }

    return { deleted, deactivated, notFound };
  }

  // ------------------------------------------------------------------
  // Posts & Stories (moderation)
  // ------------------------------------------------------------------

  async deletePost(id: string): Promise<void> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    // Likes, comments, reshares, favorites, media and tags cascade at the DB level.
    await this.postRepository.delete({ id });
  }

  async hidePost(id: string, isHidden: boolean): Promise<{ id: string; isHidden: boolean }> {
    const post = await this.postRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }
    post.isHidden = isHidden;
    await this.postRepository.save(post);
    return { id: post.id, isHidden: post.isHidden };
  }

  async bulkDeletePosts(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
    const deleted: string[] = [];
    const notFound: string[] = [];
    for (const id of ids) {
      const post = await this.postRepository.findOne({ where: { id } });
      if (!post) { notFound.push(id); continue; }
      await this.postRepository.delete({ id });
      deleted.push(id);
    }
    return { deleted, notFound };
  }

  async bulkHidePosts(ids: string[], isHidden: boolean): Promise<{ updated: string[]; notFound: string[] }> {
    const updated: string[] = [];
    const notFound: string[] = [];
    for (const id of ids) {
      const post = await this.postRepository.findOne({ where: { id } });
      if (!post) { notFound.push(id); continue; }
      post.isHidden = isHidden;
      await this.postRepository.save(post);
      updated.push(id);
    }
    return { updated, notFound };
  }

  async deleteStory(id: string): Promise<void> {
    const story = await this.storyRepository.findOne({ where: { id } });
    if (!story) {
      throw new NotFoundException(`Story with ID "${id}" not found`);
    }
    // Views, reactions and replies cascade at the DB level.
    await this.storyRepository.delete({ id });
  }

  async hideStory(id: string, isHidden: boolean): Promise<{ id: string; isHidden: boolean }> {
    const story = await this.storyRepository.findOne({ where: { id } });
    if (!story) {
      throw new NotFoundException(`Story with ID "${id}" not found`);
    }
    story.isHidden = isHidden;
    await this.storyRepository.save(story);
    return { id: story.id, isHidden: story.isHidden };
  }

  async bulkDeleteStories(ids: string[]): Promise<{ deleted: string[]; notFound: string[] }> {
    const deleted: string[] = [];
    const notFound: string[] = [];
    for (const id of ids) {
      const story = await this.storyRepository.findOne({ where: { id } });
      if (!story) { notFound.push(id); continue; }
      await this.storyRepository.delete({ id });
      deleted.push(id);
    }
    return { deleted, notFound };
  }

  async bulkHideStories(ids: string[], isHidden: boolean): Promise<{ updated: string[]; notFound: string[] }> {
    const updated: string[] = [];
    const notFound: string[] = [];
    for (const id of ids) {
      const story = await this.storyRepository.findOne({ where: { id } });
      if (!story) { notFound.push(id); continue; }
      story.isHidden = isHidden;
      await this.storyRepository.save(story);
      updated.push(id);
    }
    return { updated, notFound };
  }

  // ------------------------------------------------------------------
  // Transaction analytics
  // ------------------------------------------------------------------

  /**
   * Users ranked by how many coins they have actually purchased
   * (successful payments only), most coins first.
   */
  async getTopPurchasers(limit = 10): Promise<TopPurchaser[]> {
    const rows = await this.coinPurchaseRepository
      .createQueryBuilder('p')
      .select('p.userId', 'userId')
      .addSelect('SUM(p.coinsCredited)', 'totalCoins')
      .addSelect('SUM(p.amountPaid)', 'totalSpent')
      .addSelect('COUNT(p.id)', 'purchaseCount')
      .addSelect('MAX(p.createdAt)', 'lastPurchaseAt')
      .where('p.status = :status', { status: CoinPurchaseStatus.SUCCESS })
      .groupBy('p.userId')
      .orderBy('"totalCoins"', 'DESC')
      .addOrderBy('"totalSpent"', 'DESC')
      .limit(limit)
      .getRawMany();

    const users = await this.loadUsers(rows.map((r) => r.userId));
    return rows
      .filter((r) => users.has(r.userId))
      .map((r) => ({
        user: this.toUserSummary(users.get(r.userId)!),
        totalCoins: Number(r.totalCoins),
        totalSpent: Number(r.totalSpent),
        purchaseCount: Number(r.purchaseCount),
        lastPurchaseAt: (r.lastPurchaseAt as Date).toISOString(),
      }));
  }

  /**
   * Users ranked by how many gifts they have received, most gifts first.
   */
  async getTopGiftRecipients(limit = 10): Promise<TopRecipient[]> {
    const rows = await this.giftTransactionRepository
      .createQueryBuilder('g')
      .select('g.recipientId', 'userId')
      .addSelect('COUNT(g.id)', 'giftCount')
      .addSelect('SUM(g.coinsCost)', 'totalCoinsValue')
      .addSelect('MAX(g.createdAt)', 'lastGiftAt')
      .groupBy('g.recipientId')
      .orderBy('"giftCount"', 'DESC')
      .addOrderBy('"totalCoinsValue"', 'DESC')
      .limit(limit)
      .getRawMany();

    const users = await this.loadUsers(rows.map((r) => r.userId));
    return rows
      .filter((r) => users.has(r.userId))
      .map((r) => ({
        user: this.toUserSummary(users.get(r.userId)!),
        giftCount: Number(r.giftCount),
        totalCoinsValue: Number(r.totalCoinsValue),
        lastGiftAt: (r.lastGiftAt as Date).toISOString(),
      }));
  }

  /**
   * Combined, newest-first transaction history across coin purchases,
   * gift transactions and the coin ledger.
   *
   * The coin ledger also mirrors purchases and gifts, so those ledger rows
   * are omitted when no type filter is given to avoid duplicates; they are
   * still reachable via the explicit `type` filter.
   */
  async getTransactions(query: AdminTransactionQueryDto): Promise<{
    items: AdminTransactionRow[];
    total: number;
  }> {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const type = query.type;
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const includePurchases = !type || type === 'purchase';
    const includeGifts =
      !type || type === 'gift_sent' || type === 'gift_received';
    const includeLedger =
      !type || !['purchase', 'gift_sent', 'gift_received'].includes(type);

    const fetchLimit = offset + limit;

    const [purchases, gifts, ledger, purchaseCount, giftCount, ledgerCount] =
      await Promise.all([
        includePurchases
          ? this.coinPurchaseRepository.find({
              where: this.purchaseWhere(query),
              relations: ['user'],
              order: { createdAt: 'DESC' },
              take: fetchLimit,
            })
          : Promise.resolve([]),
        includeGifts
          ? this.giftTransactionRepository.find({
              where: this.giftWhere(query, type),
              relations: ['gift', 'sender', 'recipient'],
              order: { createdAt: 'DESC' },
              take: fetchLimit,
            })
          : Promise.resolve([]),
        includeLedger
          ? this.coinTransactionRepository.find({
              where: this.ledgerWhere(query, type),
              relations: ['user'],
              order: { createdAt: 'DESC' },
              take: fetchLimit,
            })
          : Promise.resolve([]),
        includePurchases
          ? this.coinPurchaseRepository.count({
              where: this.purchaseWhere(query),
            })
          : Promise.resolve(0),
        includeGifts
          ? this.giftTransactionRepository.count({
              where: this.giftWhere(query, type),
            })
          : Promise.resolve(0),
        includeLedger
          ? this.coinTransactionRepository.count({
              where: this.ledgerWhere(query, type),
            })
          : Promise.resolve(0),
      ]);

    const items: AdminTransactionRow[] = [
      ...purchases.map((p) => ({
        kind: 'purchase' as const,
        id: p.id,
        user: this.toUserSummary(p.user),
        amountPaid: Number(p.amountPaid),
        currency: p.currency,
        coinsCredited: p.coinsCredited,
        status: p.status,
        reference: p.paymentReference,
        createdAt: p.createdAt.toISOString(),
      })),
      ...gifts.map((g) => ({
        kind: 'gift' as const,
        id: g.id,
        sender: this.toUserSummary(g.sender),
        recipient: this.toUserSummary(g.recipient),
        gift: { id: g.gift.id, name: g.gift.name },
        coinsCost: g.coinsCost,
        targetType: g.targetType,
        createdAt: g.createdAt.toISOString(),
      })),
      ...ledger.map((t) => ({
        kind: 'ledger' as const,
        id: t.id,
        user: this.toUserSummary(t.user),
        amount: Number(t.amount),
        type: t.type,
        balanceAfter: Number(t.balanceAfter),
        referenceId: t.referenceId,
        createdAt: t.createdAt.toISOString(),
      })),
    ];

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      items: items.slice(offset, offset + limit),
      total: purchaseCount + giftCount + ledgerCount,
    };
  }

  // ------------------------------------------------------------------
  // Past question analytics
  // ------------------------------------------------------------------

  async getPastQuestionAnalytics(query?: PastQuestionAnalyticsQueryDto): Promise<{
    totalUploads: number;
    totalDownloads: number;
    totalRevenue: number;
    topUploaders: {
      user: AdminUserSummary;
      uploadCount: number;
      totalDownloads: number;
      totalRevenue: number;
    }[];
    recentUploads: {
      id: string;
      course: string;
      level: string;
      session: string;
      semester: string;
      priceCoins: number;
      downloadsCount: number;
      uploader: AdminUserSummary;
      createdAt: string;
    }[];
  }> {
    const from = query?.from ? new Date(query.from) : undefined;
    const to = query?.to ? new Date(query.to) : undefined;

    // Aggregate stats
    const statsQb = this.pastQuestionRepository
      .createQueryBuilder('pq')
      .select('COUNT(pq.id)', 'totalUploads')
      .addSelect('SUM(pq.downloadsCount)', 'totalDownloads')
      .addSelect('SUM(pq.priceCoins * pq.downloadsCount)', 'totalRevenue');
    if (from && to) {
      statsQb.where('pq.createdAt BETWEEN :from AND :to', { from, to });
    } else if (from) {
      statsQb.where('pq.createdAt >= :from', { from });
    } else if (to) {
      statsQb.where('pq.createdAt <= :to', { to });
    }
    const stats = await statsQb.getRawOne();

    // Top uploaders
    const topQb = this.pastQuestionRepository
      .createQueryBuilder('pq')
      .leftJoin('pq.uploader', 'uploader')
      .select('uploader.id', 'userId')
      .addSelect('COUNT(pq.id)', 'uploadCount')
      .addSelect('SUM(pq.downloadsCount)', 'totalDownloads')
      .addSelect('SUM(pq.priceCoins * pq.downloadsCount)', 'totalRevenue');
    if (from && to) {
      topQb.where('pq.createdAt BETWEEN :from AND :to', { from, to });
    } else if (from) {
      topQb.where('pq.createdAt >= :from', { from });
    } else if (to) {
      topQb.where('pq.createdAt <= :to', { to });
    }
    const topUploaders = await topQb
      .groupBy('uploader.id')
      .orderBy('"uploadCount"', 'DESC')
      .limit(10)
      .getRawMany();

    const uploaderUsers = await this.loadUsers(topUploaders.map((r) => r.userId));

    // Recent uploads
    const recentQb = this.pastQuestionRepository
      .createQueryBuilder('pq')
      .leftJoinAndSelect('pq.uploader', 'uploader');
    if (from && to) {
      recentQb.where('pq.createdAt BETWEEN :from AND :to', { from, to });
    } else if (from) {
      recentQb.where('pq.createdAt >= :from', { from });
    } else if (to) {
      recentQb.where('pq.createdAt <= :to', { to });
    }
    const recentRaw = await recentQb
      .orderBy('pq.createdAt', 'DESC')
      .take(10)
      .getMany();

    return {
      totalUploads: Number(stats?.totalUploads ?? 0),
      totalDownloads: Number(stats?.totalDownloads ?? 0),
      totalRevenue: Number(stats?.totalRevenue ?? 0),
      topUploaders: topUploaders
        .filter((r) => uploaderUsers.has(r.userId))
        .map((r) => ({
          user: this.toUserSummary(uploaderUsers.get(r.userId)!),
          uploadCount: Number(r.uploadCount),
          totalDownloads: Number(r.totalDownloads),
          totalRevenue: Number(r.totalRevenue),
        })),
      recentUploads: recentRaw.map((pq) => ({
        id: pq.id,
        course: pq.course,
        level: pq.level,
        session: pq.session,
        semester: pq.semester,
        priceCoins: pq.priceCoins,
        downloadsCount: pq.downloadsCount,
        uploader: this.toUserSummary(pq.uploader),
        createdAt: pq.createdAt.toISOString(),
      })),
    };
  }

  // ------------------------------------------------------------------
  // Transaction query helpers
  // ------------------------------------------------------------------

  private purchaseWhere(
    query: AdminTransactionQueryDto,
  ): FindOptionsWhere<CoinPurchase> {
    const where: FindOptionsWhere<CoinPurchase> = {};
    if (query.userId) where.userId = query.userId;
    this.applyDateRange(where, query);
    return where;
  }

  private ledgerWhere(
    query: AdminTransactionQueryDto,
    type: AdminTransactionType | undefined,
  ): FindOptionsWhere<CoinTransaction> {
    const where: FindOptionsWhere<CoinTransaction> = {};
    if (query.userId) where.userId = query.userId;
    if (type) {
      where.type = type as CoinTransactionType;
    } else {
      // Purchases and gifts are surfaced from their own tables; skip the
      // mirrored ledger rows so the feed has no duplicates.
      where.type = Not(In(['purchase', 'gift_sent', 'gift_received']));
    }
    this.applyDateRange(where, query);
    return where;
  }

  private giftWhere(
    query: AdminTransactionQueryDto,
    type: AdminTransactionType | undefined,
  ): FindOptionsWhere<GiftTransaction> | FindOptionsWhere<GiftTransaction>[] {
    const base: FindOptionsWhere<GiftTransaction> = {};
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to) {
      base.createdAt = Between(from, to);
    } else if (from) {
      base.createdAt = MoreThanOrEqual(from);
    } else if (to) {
      base.createdAt = LessThanOrEqual(to);
    }

    if (!query.userId) return base;

    if (type === 'gift_sent') return { ...base, senderId: query.userId };
    if (type === 'gift_received') return { ...base, recipientId: query.userId };
    // No direction filter → either the sender or the recipient.
    return [
      { ...base, senderId: query.userId },
      { ...base, recipientId: query.userId },
    ];
  }

  private applyDateRange(
    where: { createdAt?: unknown },
    query: AdminTransactionQueryDto,
  ): void {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to) {
      where.createdAt = Between(from, to);
    } else if (from) {
      where.createdAt = MoreThanOrEqual(from);
    } else if (to) {
      where.createdAt = LessThanOrEqual(to);
    }
  }

  /** Loads a batch of users and returns them keyed by id (skips missing users). */
  private async loadUsers(ids: string[]): Promise<Map<string, User>> {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return new Map();
    const users = await this.userRepository.find({
      where: { id: In(uniqueIds) },
    });
    return new Map(users.map((u) => [u.id, u]));
  }

  private toUserSummary(user: User): AdminUserSummary {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl,
    };
  }
}
