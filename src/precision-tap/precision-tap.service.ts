import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrecisionTapRound, PrecisionTapZone } from './entities/precision-tap-round.entity';
import { PrecisionTapDailyUsage } from './entities/precision-tap-daily-usage.entity';
import { CoinsService } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';

export const MIN_STAKE = 10;
export const MAX_STAKE = 200;
export const DAILY_STAKE_CAP = 1000;

const BASE_PERIOD_MS = 1800;
const MIN_PERIOD_MS = 500;
const SPEED_SCALE_FACTOR = 0.85;

// Position range is [-1, 1], 0 = dead center of the bar.
export const BULLSEYE_THRESHOLD = 0.06;
export const GOOD_THRESHOLD = 0.28;
export const BULLSEYE_MULTIPLIER = 4;
export const GOOD_MULTIPLIER = 1.8;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodForStreak(streakCount: number): number {
  return Math.max(MIN_PERIOD_MS, Math.round(BASE_PERIOD_MS * Math.pow(SPEED_SCALE_FACTOR, streakCount)));
}

/** Triangle wave oscillating between -1 and 1 with the given period (ms). */
function sweepPosition(elapsedMs: number, periodMs: number): number {
  const t = ((elapsedMs % periodMs) + periodMs) % periodMs / periodMs;
  return t < 0.5 ? 4 * t - 1 : 3 - 4 * t;
}

function resolveZone(position: number): { zone: PrecisionTapZone; multiplier: number } {
  const abs = Math.abs(position);
  if (abs <= BULLSEYE_THRESHOLD) return { zone: 'bullseye', multiplier: BULLSEYE_MULTIPLIER };
  if (abs <= GOOD_THRESHOLD) return { zone: 'good', multiplier: GOOD_MULTIPLIER };
  return { zone: 'miss', multiplier: 0 };
}

export interface StartRoundResponse {
  roundId: string;
  stake: number;
  periodMs: number;
  startedAt: string;
  minStake: number;
  maxStake: number;
  dailyRemaining: number;
  thresholds: { bullseye: number; good: number };
  multipliers: { bullseye: number; good: number };
}

export interface TapResponse {
  zone: PrecisionTapZone;
  multiplier: number;
  position: number;
  stake: number;
  payout: number;
}

@Injectable()
export class PrecisionTapService {
  constructor(
    @InjectRepository(PrecisionTapRound)
    private readonly roundRepository: Repository<PrecisionTapRound>,
    @InjectRepository(PrecisionTapDailyUsage)
    private readonly dailyUsageRepository: Repository<PrecisionTapDailyUsage>,
    private readonly coinsService: CoinsService,
  ) {}

  private async getOrCreateDailyUsage(userId: string): Promise<PrecisionTapDailyUsage> {
    const date = todayUtc();
    let row = await this.dailyUsageRepository.findOne({ where: { userId, date } });
    if (!row) {
      row = this.dailyUsageRepository.create({ userId, date, totalStaked: 0 });
    }
    return row;
  }

  /** Refunds and resolves any round the user never tapped, so a stake never gets silently stuck. */
  private async forfeitAbandonedRound(userId: string): Promise<void> {
    const stale = await this.roundRepository.findOne({ where: { userId, status: 'active' } });
    if (!stale) return;

    await this.coinsService.creditBalance(userId, stale.stake, CoinTransactionType.PRECISION_TAP_REFUND, stale.id);
    stale.status = 'resolved';
    stale.zone = 'abandoned';
    stale.payout = stale.stake;
    stale.resolvedAt = new Date();
    await this.roundRepository.save(stale);
  }

  async startRound(userId: string, stake: number, streakCount = 0): Promise<StartRoundResponse> {
    if (!Number.isInteger(stake) || stake < MIN_STAKE || stake > MAX_STAKE) {
      throw new BadRequestException(`Stake must be between ${MIN_STAKE} and ${MAX_STAKE} coins.`);
    }

    await this.forfeitAbandonedRound(userId);

    const dailyUsage = await this.getOrCreateDailyUsage(userId);
    if (dailyUsage.totalStaked + stake > DAILY_STAKE_CAP) {
      throw new BadRequestException(
        `You've reached today's play limit (${DAILY_STAKE_CAP} coins). Come back tomorrow!`,
      );
    }

    await this.coinsService.debitBalance(userId, stake, CoinTransactionType.PRECISION_TAP_STAKE);

    dailyUsage.totalStaked += stake;
    await this.dailyUsageRepository.save(dailyUsage);

    const periodMs = periodForStreak(streakCount ?? 0);
    const round = this.roundRepository.create({
      userId,
      stake,
      periodMs,
      startedAt: new Date(),
      status: 'active',
    });
    await this.roundRepository.save(round);

    return {
      roundId: round.id,
      stake,
      periodMs,
      startedAt: round.startedAt.toISOString(),
      minStake: MIN_STAKE,
      maxStake: MAX_STAKE,
      dailyRemaining: Math.max(0, DAILY_STAKE_CAP - dailyUsage.totalStaked),
      thresholds: { bullseye: BULLSEYE_THRESHOLD, good: GOOD_THRESHOLD },
      multipliers: { bullseye: BULLSEYE_MULTIPLIER, good: GOOD_MULTIPLIER },
    };
  }

  async tap(userId: string, roundId: string): Promise<TapResponse> {
    const round = await this.roundRepository.findOne({ where: { id: roundId, userId } });
    if (!round) {
      throw new NotFoundException('Round not found.');
    }
    if (round.status !== 'active') {
      throw new BadRequestException('This round has already been resolved.');
    }

    // Server clock is authoritative — the client never gets to report its
    // own elapsed time or claimed position.
    const elapsedMs = Date.now() - round.startedAt.getTime();
    const position = sweepPosition(elapsedMs, round.periodMs);
    const { zone, multiplier } = resolveZone(position);
    const payout = zone === 'miss' ? 0 : Math.round(round.stake * multiplier);

    if (payout > 0) {
      await this.coinsService.creditBalance(userId, payout, CoinTransactionType.PRECISION_TAP_WIN, round.id);
    }

    round.status = 'resolved';
    round.zone = zone;
    round.payout = payout;
    round.resolvedAt = new Date();
    await this.roundRepository.save(round);

    return { zone, multiplier, position, stake: round.stake, payout };
  }

  async getState(userId: string) {
    await this.forfeitAbandonedRound(userId);
    const dailyUsage = await this.getOrCreateDailyUsage(userId);
    return {
      minStake: MIN_STAKE,
      maxStake: MAX_STAKE,
      dailyRemaining: Math.max(0, DAILY_STAKE_CAP - dailyUsage.totalStaked),
      thresholds: { bullseye: BULLSEYE_THRESHOLD, good: GOOD_THRESHOLD },
      multipliers: { bullseye: BULLSEYE_MULTIPLIER, good: GOOD_MULTIPLIER },
    };
  }
}
