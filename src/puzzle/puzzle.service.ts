import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PuzzleScore, PUZZLE_MILESTONES } from './entities/puzzle-score.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { GamificationService } from '../gamification/gamification.service';
import { XpSource } from '../gamification/entities/xp-transaction.entity';
import { CoinsService } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { Level } from '../gamification/entities/level.entity';

// XP awarded the first time a player ever reaches each milestone tile.
const MILESTONE_XP: Record<number, number> = {
  128: 10,
  256: 20,
  512: 40,
  1024: 80,
  2048: 200,
};

const HIGH_SCORE_COIN_REWARD = 10;

export interface SubmitScoreResult {
  bestScore: number;
  highestTile: number;
  isNewBest: boolean;
  newMilestones: number[];
  xpAwarded: number;
  coinsAwarded: number;
}

@Injectable()
export class PuzzleService {
  constructor(
    @InjectRepository(PuzzleScore)
    private readonly puzzleScoreRepository: Repository<PuzzleScore>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly gamificationService: GamificationService,
    private readonly coinsService: CoinsService,
  ) {}

  private async getOrCreate(userId: string): Promise<PuzzleScore> {
    let row = await this.puzzleScoreRepository.findOne({ where: { userId } });
    if (!row) {
      // `create()` only assigns the properties it's given — it does NOT pull
      // the column `default:` values into the in-memory entity. Seed the
      // counters here, otherwise the `Math.max()`/`+= 1` below run against
      // `undefined` and produce NaN, which Postgres rejects on save. That
      // meant a player's very first game was never persisted at all, leaving
      // their personal best blank and the leaderboard empty.
      row = this.puzzleScoreRepository.create({
        userId,
        bestScore: 0,
        highestTile: 0,
        gamesPlayed: 0,
        milestonesAwarded: [],
      });
    }
    // simple-array can come back as [] correctly, but guard against a stray
    // null from a fresh row that hasn't been through the column transformer yet
    row.milestonesAwarded = row.milestonesAwarded ?? [];
    return row;
  }

  async submitScore(userId: string, score: number, highestTile: number): Promise<SubmitScoreResult> {
    const row = await this.getOrCreate(userId);

    const isNewBest = score > row.bestScore;
    if (isNewBest) {
      row.bestScore = score;
    }
    row.highestTile = Math.max(row.highestTile, highestTile);
    row.gamesPlayed += 1;

    const newMilestones = PUZZLE_MILESTONES.filter(
      (m) => row.highestTile >= m && !row.milestonesAwarded.includes(m),
    );
    row.milestonesAwarded = [...row.milestonesAwarded, ...newMilestones];

    await this.puzzleScoreRepository.save(row);

    let xpAwarded = 0;
    for (const milestone of newMilestones) {
      const amount = MILESTONE_XP[milestone] ?? 0;
      if (amount > 0) {
        await this.gamificationService.awardXp(userId, XpSource.PUZZLE_MILESTONE, amount);
        xpAwarded += amount;
      }
    }

    let coinsAwarded = 0;
    // Only reward a new best once there was a real previous score to beat —
    // otherwise the very first game (0 -> anything) always "wins" for free.
    if (isNewBest && row.gamesPlayed > 1) {
      await this.coinsService.creditBalance(userId, HIGH_SCORE_COIN_REWARD, CoinTransactionType.PUZZLE_HIGH_SCORE);
      coinsAwarded = HIGH_SCORE_COIN_REWARD;
    }

    return {
      bestScore: row.bestScore,
      highestTile: row.highestTile,
      isNewBest,
      newMilestones,
      xpAwarded,
      coinsAwarded,
    };
  }

  async getMyStats(userId: string): Promise<PuzzleScore> {
    return this.getOrCreate(userId);
  }

  async getLeaderboard(limit = 20): Promise<Array<{
    userId: string;
    username: string | null;
    profilePictureUrl: string | null;
    profileFrame: string | null;
    bestScore: number;
    highestTile: number;
    level: Level | null;
  }>> {
    const rows = await this.puzzleScoreRepository
      .createQueryBuilder('score')
      .innerJoin('score.user', 'user')
      .addSelect(['user.username', 'user.profilePictureUrl', 'user.profileFrame'])
      .where('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('score.bestScore > 0')
      .orderBy('score.bestScore', 'DESC')
      .take(limit)
      .getMany();

    const levelByUserId = await this.gamificationService.getLevelsForUsers(rows.map((row) => row.userId));

    return rows.map((row) => ({
      userId: row.userId,
      username: row.user?.username ?? null,
      profilePictureUrl: row.user?.profilePictureUrl ?? null,
      profileFrame: row.user?.profileFrame ?? null,
      bestScore: row.bestScore,
      highestTile: row.highestTile,
      level: levelByUserId.get(row.userId) ?? null,
    }));
  }
}
