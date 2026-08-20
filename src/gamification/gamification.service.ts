import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Level } from './entities/level.entity';
import { UserXp } from './entities/user-xp.entity';
import { XpTransaction, XpSource } from './entities/xp-transaction.entity';
import { GamificationConfig } from './entities/gamification-config.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { CoinsService } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { UsersService } from '../users/users.service';
import { GamificationGateway } from './gamification.gateway';

const SEED_LEVELS: Omit<Level, 'id'>[] = [
  { level: 1, title: 'Fresher', emoji: '🌱', minXp: 0, maxXp: 1_999, badge: 'fresher', color: '#22C55E', rewardCoins: 0, perks: ['Basic profile, post'] },
  { level: 2, title: 'Explorer', emoji: '📘', minXp: 2_000, maxXp: 5_999, badge: 'explorer', color: '#3B82F6', rewardCoins: 100, perks: ['Custom username color'] },
  { level: 3, title: 'Elite', emoji: '✨', minXp: 6_000, maxXp: 11_999, badge: 'elite', color: '#A855F7', rewardCoins: 200, perks: ['Story highlights'] },
  { level: 4, title: 'Professional', emoji: '💼', minXp: 12_000, maxXp: 19_999, badge: 'professional', color: '#6366F1', rewardCoins: 300, perks: ['Verified badge'] },
  { level: 5, title: 'Hero', emoji: '🦸', minXp: 20_000, maxXp: 34_999, badge: 'hero', color: '#F59E0B', rewardCoins: 400, perks: ['Priority in "For You"'] },
  { level: 6, title: 'Champion', emoji: '🏅', minXp: 35_000, maxXp: 54_999, badge: 'champion', color: '#EF4444', rewardCoins: 500, perks: ['Custom profile frame'] },
  { level: 7, title: 'Leader', emoji: '👑', minXp: 55_000, maxXp: 79_999, badge: 'leader', color: '#EC4899', rewardCoins: 750, perks: ['Create Groups'] },
  { level: 8, title: 'Ambassador', emoji: '🌍', minXp: 80_000, maxXp: 119_999, badge: 'ambassador', color: '#14B8A6', rewardCoins: 1_000, perks: ['Campus-wide reach'] },
  { level: 9, title: 'Superstar', emoji: '⭐', minXp: 120_000, maxXp: 179_999, badge: 'superstar', color: '#FACC15', rewardCoins: 1_250, perks: ['Exclusive events'] },
  { level: 10, title: 'Celebrity', emoji: '🎖️', minXp: 180_000, maxXp: 249_999, badge: 'celebrity', color: '#F97316', rewardCoins: 1_500, perks: ['Monetization (gifts → cash)'] },
  { level: 11, title: 'Master', emoji: '💠', minXp: 250_000, maxXp: 349_999, badge: 'master', color: '#06B6D4', rewardCoins: 2_000, perks: ['Analytics dashboard'] },
  { level: 12, title: 'Ultimate', emoji: '🚀', minXp: 350_000, maxXp: 499_999, badge: 'ultimate', color: '#8B5CF6', rewardCoins: 2_500, perks: ['Influencer tools'] },
  { level: 13, title: 'Grandmaster', emoji: '🧠', minXp: 500_000, maxXp: 749_999, badge: 'grandmaster', color: '#DC2626', rewardCoins: 3_000, perks: ['Admin-like campus tools'] },
  { level: 14, title: 'Pioneer', emoji: '🏛️', minXp: 750_000, maxXp: 999_999, badge: 'pioneer', color: '#0EA5E9', rewardCoins: 4_000, perks: ['Name campus events'] },
  { level: 15, title: 'Legend', emoji: '💎', minXp: 1_000_000, maxXp: null, badge: 'legend', color: '#FFD700', rewardCoins: 5_000, perks: ['Hall of Fame + physical merch'] },
];

export interface XpAwardResult {
  leveledUp: boolean;
  newLevel: Level;
}

export enum LeaderboardScope {
  DEPARTMENT = 'department',
  FACULTY = 'faculty',
  SCHOOL = 'school',
  APP = 'app',
}

export interface LeaderboardQueryOptions {
  scope?: LeaderboardScope;
  departmentId?: string;
  facultyId?: string;
  schoolId?: string;
  limit?: number;
}
export interface LeaderboardUserXpResponse extends Partial<UserXp> {
  rank: number;
}
@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    @InjectRepository(UserXp)
    private readonly userXpRepository: Repository<UserXp>,
    @InjectRepository(XpTransaction)
    private readonly xpTransactionRepository: Repository<XpTransaction>,
    @InjectRepository(GamificationConfig)
  
    private readonly configRepository: Repository<GamificationConfig>,
    private readonly notificationsService: NotificationsService,
    private readonly coinsService: CoinsService,
    private readonly usersService: UsersService,
    private readonly gamificationGateway: GamificationGateway,
  ) {}

  
  async seedLevels(): Promise<void> {
    const count = await this.levelRepository.count();
    if (count > 0) return;

    for (const level of SEED_LEVELS) {
      await this.levelRepository.save(this.levelRepository.create(level));
    }
  }

  private async getOrCreateUserXp(userId: string): Promise<UserXp> {
    let userXp = await this.userXpRepository.findOne({ where: { userId } });
    if (!userXp) {
      userXp = await this.userXpRepository.save(this.userXpRepository.create({ userId }));
    }
    return userXp;
  }

  private async getActiveMultiplier(): Promise<number> {
    const config = await this.configRepository.findOne({ where: {} });
    if (!config) return 1;
    if (config.multiplierExpiresAt && config.multiplierExpiresAt < new Date()) return 1;
    return config.xpMultiplier;
  }

  private async resolveLevel(totalXp: number): Promise<Level> {
    const level = await this.levelRepository
      .createQueryBuilder('level')
      .where('level.minXp <= :xp', { xp: totalXp })
      .andWhere('(level.maxXp IS NULL OR level.maxXp >= :xp)', { xp: totalXp })
      .getOne();

    // Falls back to level 1 if levels haven't been seeded yet, rather than throwing
    // mid-request for what's ultimately a reference-data gap.
    return level ?? (await this.levelRepository.findOne({ where: { level: 1 } })) ?? SEED_LEVELS[0] as Level;
  }

  async awardXp(
    userId: string,
    source: XpSource,
    baseAmount: number,
    referenceId?: string,
  ): Promise<XpAwardResult> {
    const multiplier = await this.getActiveMultiplier();
    const amount = Math.round(baseAmount * multiplier);

    const userXp = await this.getOrCreateUserXp(userId);
    await this.xpTransactionRepository.save(
      this.xpTransactionRepository.create({ userId, amount, source, referenceId: referenceId ?? null }),
    );

    userXp.totalXp += amount;
    const newLevel = await this.resolveLevel(userXp.totalXp);
    const leveledUp = newLevel.level > userXp.currentLevel;
    userXp.currentLevel = newLevel.level;
    await this.userXpRepository.save(userXp);

    if (leveledUp) {
      if (newLevel.rewardCoins > 0) {
        await this.coinsService.creditBalance(userId, newLevel.rewardCoins, CoinTransactionType.LEVEL_UP_REWARD, newLevel.id);
      }
      await this.notificationsService.notify(userId, null, NotificationType.LEVEL_UP);

      // Let everybody currently online see the level-up moment live.
      const user = await this.usersService.findById(userId);
      this.gamificationGateway.broadcastLevelUp({
        userId,
        username: user?.username ?? null,
        profilePictureUrl: user?.profilePictureUrl ?? null,
        level: newLevel.level,
        title: newLevel.title,
        emoji: newLevel.emoji,
        color: newLevel.color,
        badge: newLevel.badge,
      });
    }

    return { leveledUp, newLevel };
  }

  async recordDailyLogin(userId: string): Promise<void> {
    const userXp = await this.getOrCreateUserXp(userId);
    const today = new Date().toISOString().slice(0, 10);
    if (userXp.lastLoginDate === today) return;

    const isConsecutive = userXp.lastLoginDate === this.yesterday();
    userXp.currentStreak = isConsecutive ? userXp.currentStreak + 1 : 1;
    userXp.longestStreak = Math.max(userXp.longestStreak, userXp.currentStreak);
    userXp.lastLoginDate = today;
    await this.userXpRepository.save(userXp);

    await this.awardXp(userId, XpSource.DAILY_LOGIN, 10);
    if (userXp.currentStreak > 0 && userXp.currentStreak % 7 === 0) {
      await this.awardXp(userId, XpSource.STREAK_BONUS, 50);
    }
  }

  private yesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /** Used by GiftsService (Phase 4) to track the giver/receiver ratio behind the "Generous" title. */
  async recordGiftGiven(userId: string): Promise<void> {
    const userXp = await this.getOrCreateUserXp(userId);
    userXp.giftsGiven += 1;
    await this.userXpRepository.save(userXp);
  }

  async recordGiftReceived(userId: string): Promise<void> {
    const userXp = await this.getOrCreateUserXp(userId);
    userXp.giftsReceived += 1;
    await this.userXpRepository.save(userXp);
  }

  async getMe(userId: string): Promise<{
    totalXp: number;
    level: Level;
    nextLevel: Level | null;
    progress: number;
    currentStreak: number;
    giftsGiven: number;
    giftsReceived: number;
  }> {
    const userXp = await this.getOrCreateUserXp(userId);
    const level = await this.resolveLevel(userXp.totalXp);
    const nextLevel = await this.levelRepository.findOne({ where: { level: level.level + 1 } });

    const progress = nextLevel
      ? (userXp.totalXp - level.minXp) / (nextLevel.minXp - level.minXp)
      : 1;

    return {
      totalXp: userXp.totalXp,
      level,
      nextLevel,
      progress,
      currentStreak: userXp.currentStreak,
      giftsGiven: userXp.giftsGiven,
      giftsReceived: userXp.giftsReceived,
    };
  }

  async getLevels(): Promise<Level[]> {
    return this.levelRepository.find({ order: { level: 'ASC' } });
  }

  /**
   * Get the perks array for a user's current level.
   * Returns the perks from the highest level whose minXp <= user's totalXp.
   */
  async getLevelPerks(userId: string): Promise<string[]> {
    const userXp = await this.getOrCreateUserXp(userId);
    const level = await this.resolveLevel(userXp.totalXp);
    return level?.perks ?? [];
  }

  /**
   * Check if a user has a specific perk (by exact string match in their level perks).
   */
  async hasPerk(userId: string, perk: string): Promise<boolean> {
    const perks = await this.getLevelPerks(userId);
    return perks.includes(perk);
  }

  /**
   * Get the full level info for a user (level number, title, perks, etc.).
   */
  async getUserLevel(userId: string): Promise<Level | null> {
    const userXp = await this.getOrCreateUserXp(userId);
    return this.resolveLevel(userXp.totalXp);
  }

  async createLevel(data: {
    level: number;
    title: string;
    emoji: string;
    minXp: number;
    maxXp?: number | null;
    badge: string;
    color: string;
    rewardCoins?: number;
    perks?: string[];
  }): Promise<Level> {
    const level = this.levelRepository.create(data);
    return this.levelRepository.save(level);
  }

  async updateLevel(id: string, data: Partial<{
    level: number;
    title: string;
    emoji: string;
    minXp: number;
    maxXp?: number | null;
    badge: string;
    color: string;
    rewardCoins: number;
    perks: string[];
  }>): Promise<Level> {
    await this.levelRepository.update(id, data);
    return this.levelRepository.findOneByOrFail({ id });
  }

  async deleteLevel(id: string): Promise<void> {
    await this.levelRepository.delete(id);
  }

async getGiverLeaderboard(
    options: LeaderboardQueryOptions = {},
  ): Promise<LeaderboardUserXpResponse[]> {
    const { scope = LeaderboardScope.APP, departmentId, facultyId, schoolId, limit = 20 } = options;

    // 1. Fetch levels ordered by minXp for matching
    const levels = await this.levelRepository.find({
      order: { minXp: 'ASC' },
    });

    // 2. Query leaderboard data
    const query = this.userXpRepository
      .createQueryBuilder('userXp')
      .leftJoinAndSelect('userXp.user', 'user')
      .orderBy('userXp.giftsGiven', 'DESC')
      .addOrderBy('userXp.totalXp', 'DESC')
      // Users with activity status off opt out of the public leaderboard
      .andWhere('user.activityStatus = :activityStatus', { activityStatus: true })
      .take(limit);

    switch (scope) {
      case LeaderboardScope.DEPARTMENT:
        if (!departmentId) {
          throw new BadRequestException('departmentId is required for department scope');
        }
        query.andWhere('user.departmentId = :departmentId', { departmentId });
        break;

      case LeaderboardScope.FACULTY:
        if (!facultyId) {
          throw new BadRequestException('facultyId is required for faculty scope');
        }
        query.andWhere('user.facultyId = :facultyId', { facultyId });
        break;

      case LeaderboardScope.SCHOOL:
        if (!schoolId) {
          throw new BadRequestException('schoolId is required for school scope');
        }
        query.andWhere('user.schoolId = :schoolId', { schoolId });
        break;

      case LeaderboardScope.APP:
      default:
        break;
    }

    const results = await query.getMany();

    // 3. Map each user's totalXp to their Level entity
    return results.map((item, index) => {
      const userXp = item.totalXp || 0;

      // Find matching level based on minXp and maxXp range
      const matchedLevel =
        levels.find(
          (lvl) =>
            userXp >= lvl.minXp && (lvl.maxXp === null || userXp <= lvl.maxXp),
        ) || levels[0]; 

      return {
        ...item,
        rank: index + 1,
        level: matchedLevel?.level || item.currentLevel || 1,
        appLevel: matchedLevel,
      };
    });
  }
}
