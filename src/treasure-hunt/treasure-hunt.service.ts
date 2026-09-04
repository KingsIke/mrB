import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { TreasureHunt } from './entities/treasure-hunt.entity';
import { TreasureClaim } from './entities/treasure-claim.entity';
import { Gift } from '../gifts/entities/gift.entity';
import { CoinsService, COIN_RATE_NGN } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationTargetType,
  NotificationType,
} from '../notifications/entities/notification.entity';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { User } from '../users/entities/user.entity';

/**
 * Strip Expo Router group segments from a route path.
 * e.g. "/(features)/marketplace" → "/marketplace"
 *      "/(tabs)/index" → "/index"
 *      "/(features)/departmentWar/battleArena" → "/departmentWar/battleArena"
 */
function stripRouteGroups(route: string): string {
  // Remove all /(group) segments but keep the rest of the path
  return route.replace(/\/\([^/]+\)/g, '') || '/';
}

@Injectable()
export class TreasureHuntService {
  private readonly logger = new Logger(TreasureHuntService.name);

  constructor(
    @InjectRepository(TreasureHunt)
    private readonly huntRepo: Repository<TreasureHunt>,
    @InjectRepository(TreasureClaim)
    private readonly claimRepo: Repository<TreasureClaim>,
    @InjectRepository(Gift)
    private readonly giftRepo: Repository<Gift>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly coinsService: CoinsService,
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  // ── User-facing ───────────────────────────────────────────────────

  /**
   * Check if there's an available treasure on a given route for the user.
   * Returns the hunt + gift info, or null if nothing available.
   */
  async checkAvailable(userId: string, route: string) {
    const now = new Date();

    // Normalize the client route (strip Expo Router group segments)
    const normalizedRoute = stripRouteGroups(route);

    // Find active hunts whose normalized route matches, haven't expired, and have claims left
    const allActiveHunts = await this.huntRepo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.gift', 'gift')
      .where('h.isActive = true')
      .andWhere('(h.startsAt IS NULL OR h.startsAt <= :now)', { now })
      .andWhere('(h.expiresAt IS NULL OR h.expiresAt > :now)', { now })
      .andWhere('h.claimedCount < h.maxClaims')
      .getMany();

    // Filter by normalized route match (handles Expo Router group prefixes)
    const hunts = allActiveHunts.filter(
      (h) => stripRouteGroups(h.route) === normalizedRoute,
    );

    if (!hunts.length) return null;

    // Filter out hunts the user already claimed
    const claimedIds = (
      await this.claimRepo.find({
        where: hunts.map((h) => ({ userId, treasureHuntId: h.id })),
        select: ['treasureHuntId'],
      })
    ).map((c) => c.treasureHuntId);

    const available = hunts.filter((h) => !claimedIds.includes(h.id));
    if (!available.length) return null;

    // Return the first available hunt with gift info
    const hunt = available[0];
    return {
      id: hunt.id,
      name: hunt.name,
      description: hunt.description,
      bonusCoins: hunt.bonusCoins,
      gift: hunt.gift
        ? {
            id: hunt.gift.id,
            name: hunt.gift.name,
            animationUrl: hunt.gift.animationUrl,
            videoUrl: hunt.gift.videoUrl,
          }
        : null,
      claimsRemaining: hunt.maxClaims - hunt.claimedCount,
    };
  }

  /**
   * Claim a treasure hunt. Awards the gift + bonus coins.
   */
  async claim(userId: string, huntId: string) {
    const hunt = await this.huntRepo.findOne({
      where: { id: huntId },
      relations: ['gift'],
    });
    if (!hunt) throw new NotFoundException('Treasure hunt not found');
    if (!hunt.isActive) throw new BadRequestException('This treasure hunt is no longer active');

    const now = new Date();
    if (hunt.startsAt && hunt.startsAt > now) {
      throw new BadRequestException('This treasure hunt has not started yet');
    }
    if (hunt.expiresAt && hunt.expiresAt <= now) {
      throw new BadRequestException('This treasure hunt has expired');
    }
    if (hunt.claimedCount >= hunt.maxClaims) {
      throw new BadRequestException('All claims have been used');
    }

    // Check if already claimed
    const existing = await this.claimRepo.findOne({
      where: { userId, treasureHuntId: huntId },
    });
    if (existing) {
      throw new ConflictException('You have already claimed this treasure');
    }

    // Create claim record
    await this.claimRepo.save(
      this.claimRepo.create({ userId, treasureHuntId: huntId }),
    );

    // Increment claimed count
    hunt.claimedCount += 1;
    await this.huntRepo.save(hunt);

    // Award bonus coins to spendable balance if any
    if (hunt.bonusCoins > 0) {
      await this.coinsService.creditBalance(
        userId,
        hunt.bonusCoins,
        CoinTransactionType.TREASURE_HUNT_REWARD,
        huntId,
      );
    }

    // Credit the gift's coin value to the user's withdrawable (earned) balance
    if (hunt.gift && hunt.gift.coinCost > 0) {
      const earnedNgn = hunt.gift.coinCost * COIN_RATE_NGN;
      await this.coinsService.creditEarnedBalance(
        userId,
        earnedNgn,
        huntId,
        CoinTransactionType.TREASURE_HUNT_REWARD,
      );
    }

    const earnedNgn = hunt.gift && hunt.gift.coinCost > 0 ? hunt.gift.coinCost * COIN_RATE_NGN : 0;

    return {
      success: true,
      gift: hunt.gift
        ? {
            id: hunt.gift.id,
            name: hunt.gift.name,
            animationUrl: hunt.gift.animationUrl,
            videoUrl: hunt.gift.videoUrl,
          }
        : null,
      bonusCoins: hunt.bonusCoins,
      earnedNgn,
      message: hunt.gift
        ? `You found a ${hunt.gift.name}!${earnedNgn > 0 ? ` + ₦${earnedNgn} earned!` : ''}${hunt.bonusCoins > 0 ? ` + ${hunt.bonusCoins} bonus coins!` : ''}`
        : hunt.bonusCoins > 0
          ? `You won ${hunt.bonusCoins} bonus coins!`
          : 'Treasure claimed!',
    };
  }

  /**
   * Get recent claims with user info for display on the treasure hunt screen.
   */
  async getRecentClaims(limit = 10) {
    const claims = await this.claimRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .leftJoinAndSelect('c.treasureHunt', 'hunt')
      .leftJoinAndSelect('hunt.gift', 'gift')
      .orderBy('c.claimedAt', 'DESC')
      .take(limit)
      .getMany();

    return claims.map((c) => ({
      id: c.id,
      user: {
        id: c.user.id,
        firstName: c.user.firstName,
        lastName: c.user.lastName,
        username: c.user.username,
        profilePictureUrl: c.user.profilePictureUrl,
      },
      gift: c.treasureHunt?.gift
        ? {
            id: c.treasureHunt.gift.id,
            name: c.treasureHunt.gift.name,
            animationUrl: c.treasureHunt.gift.animationUrl,
            bonusCoins: c.treasureHunt.gift.coinCost,
            
          }
        : null,
      huntName: c.treasureHunt?.name || 'Mystery Box',
      // bonusCoins: c.treasureHunt?.bonusCoins || 0,
      claimedAt: c.claimedAt,
    }));
  }

  // ── Admin-facing ──────────────────────────────────────────────────

  async getAll() {
    return this.huntRepo.find({
      relations: ['gift'],
      order: { createdAt: 'DESC' },
    });
  }

  async getStats() {
    const [total, active, totalClaims] = await Promise.all([
      this.huntRepo.count(),
      this.huntRepo.count({ where: { isActive: true } }),
      this.claimRepo.count(),
    ]);

    const byRoute = await this.huntRepo
      .createQueryBuilder('h')
      .select('h.route', 'route')
      .addSelect('COUNT(*)', 'count')
      .groupBy('h.route')
      .getRawMany();

    return { total, active, totalClaims, byRoute };
  }

  async create(data: {
    name: string;
    route: string;
    giftId: string;
    description?: string;
    maxClaims?: number;
    startsAt?: string;
    expiresAt?: string;
    bonusCoins?: number;
    isActive?: boolean;
  }) {
    // Validate gift exists
    const gift = await this.giftRepo.findOne({ where: { id: data.giftId } });
    if (!gift) throw new NotFoundException('Gift not found');

    const hunt = this.huntRepo.create({
      name: data.name,
      route: data.route,
      giftId: data.giftId,
      description: data.description ?? null,
      maxClaims: data.maxClaims ?? 1,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      bonusCoins: data.bonusCoins ?? 0,
      isActive: data.isActive ?? true,
    });

    const saved = await this.huntRepo.save(hunt);

    // Send push notification to all users about the new treasure hunt
    try {
      await this.sendTreasureHuntNotificationToAllUsers(saved);
    } catch (err) {
      this.logger.warn(`Failed to send treasure hunt creation notifications: ${err}`);
    }

    return saved;
  }

  async update(id: string, data: Partial<{
    name: string;
    route: string;
    giftId: string;
    description: string;
    maxClaims: number;
    startsAt: string;
    expiresAt: string;
    bonusCoins: number;
    isActive: boolean;
  }>) {
    const hunt = await this.huntRepo.findOne({ where: { id } });
    if (!hunt) throw new NotFoundException('Treasure hunt not found');

    if (data.giftId) {
      const gift = await this.giftRepo.findOne({ where: { id: data.giftId } });
      if (!gift) throw new NotFoundException('Gift not found');
    }

    if (data.name !== undefined) hunt.name = data.name;
    if (data.route !== undefined) hunt.route = data.route;
    if (data.giftId !== undefined) hunt.giftId = data.giftId;
    if (data.description !== undefined) hunt.description = data.description;
    if (data.maxClaims !== undefined) hunt.maxClaims = data.maxClaims;
    if (data.startsAt !== undefined) hunt.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.expiresAt !== undefined) hunt.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    if (data.bonusCoins !== undefined) hunt.bonusCoins = data.bonusCoins;
    if (data.isActive !== undefined) hunt.isActive = data.isActive;

    return this.huntRepo.save(hunt);
  }

  async delete(id: string) {
    const hunt = await this.huntRepo.findOne({ where: { id } });
    if (!hunt) throw new NotFoundException('Treasure hunt not found');
    await this.huntRepo.remove(hunt);
  }

  async deleteMany(ids: string[]) {
    const deleted: string[] = [];
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await this.delete(id);
        deleted.push(id);
      } catch {
        errors.push(id);
      }
    }
    return { deleted, errors };
  }

  async getClaims(huntId: string) {
    return this.claimRepo.find({
      where: { treasureHuntId: huntId },
      relations: ['user'],
      order: { claimedAt: 'DESC' },
    });
  }

  // ── Push Notifications ────────────────────────────────────────────

  /**
   * Send push notification to all active users about a new treasure hunt.
   */
  private async sendTreasureHuntNotificationToAllUsers(hunt: TreasureHunt) {
    const users = await this.userRepository.find({
      where: { status: 'active' as any },
      select: ['id'],
      take: 5000,
    });

    if (!users.length) return;

    const userIds = users.map((u) => u.id);
    const bodyExtra = hunt.name
      ? `${hunt.name} — open the app to find it!`
      : 'Open the app to find it!';

    await this.pushNotificationsService.sendToUsers(
      userIds,
      NotificationType.TREASURE_HUNT_CREATED,
      'Freebuff',
      bodyExtra,
      { treasureHuntId: hunt.id, route: hunt.route },
    );

    this.logger.log(`[TreasureHunt] Sent creation push to ${userIds.length} users for hunt "${hunt.name}"`);
  }

  /**
   * Periodically send reminder push notifications for active treasure hunts
   * that haven't been fully claimed yet.
   * Runs every 4 hours.
   */
  @Cron('0 */4 * * *')
  async sendUnclaimedHuntReminders() {
    const now = new Date();

    // Find active hunts that haven't expired and still have claims left
    const hunts = await this.huntRepo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.gift', 'gift')
      .where('h.isActive = true')
      .andWhere('(h.startsAt IS NULL OR h.startsAt <= :now)', { now })
      .andWhere('(h.expiresAt IS NULL OR h.expiresAt > :now)', { now })
      .andWhere('h.claimedCount < h.maxClaims')
      .getMany();

    if (!hunts.length) return;

    this.logger.log(`[TreasureHunt] Found ${hunts.length} unclaimed active hunts — sending reminders`);

    for (const hunt of hunts) {
      try {
        // Find users who have NOT claimed this hunt
        const claimedUserIds = (
          await this.claimRepo.find({
            where: { treasureHuntId: hunt.id },
            select: ['userId'],
          })
        ).map((c) => c.userId);

        const userQb = this.userRepository
          .createQueryBuilder('u')
          .select('u.id', 'id')
          .where('u.status = :status', { status: 'active' })
          .take(5000);

        if (claimedUserIds.length > 0) {
          userQb.andWhere('u.id NOT IN (:...claimedIds)', { claimedIds: claimedUserIds });
        }

        const unclaimedUsers = await userQb.getRawMany<{ id: string }>();

        if (!unclaimedUsers.length) continue;

        const userIds = unclaimedUsers.map((u) => u.id);
        const bodyExtra = hunt.name
          ? `"${hunt.name}" is still available — claim it before it's gone!`
          : 'A treasure is still available — claim it before it\'s gone!';

        await this.pushNotificationsService.sendToUsers(
          userIds,
          NotificationType.TREASURE_HUNT_REMINDER,
          'Freebuff',
          bodyExtra,
          { treasureHuntId: hunt.id, route: hunt.route },
        );

        this.logger.log(`[TreasureHunt] Sent reminder for "${hunt.name}" to ${userIds.length} users`);
      } catch (err) {
        this.logger.warn(`[TreasureHunt] Failed to send reminder for hunt ${hunt.id}: ${err}`);
      }
    }
  }
}
