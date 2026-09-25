import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WordGameAttempt, MAX_GUESSES } from './entities/word-game-attempt.entity';
import { WordGameStats } from './entities/word-game-stats.entity';
import { WORD_LIST } from './word-list';
import { GamificationService } from '../gamification/gamification.service';
import { XpSource } from '../gamification/entities/xp-transaction.entity';

export type LetterStatus = 'correct' | 'present' | 'absent';

// XP for a win, indexed by (guessesUsed - 1) — fewer guesses earns more.
const WIN_XP_BY_GUESS_COUNT = [50, 40, 30, 20, 15, 10];

// Fixed reference point for the daily puzzle index. Never change this once
// live — it would shift which word every past puzzleNumber maps to.
const EPOCH_UTC_MS = Date.UTC(2026, 0, 1);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface TodayPuzzleResponse {
  puzzleNumber: number;
  guesses: string[];
  feedback: LetterStatus[][];
  completed: boolean;
  won: boolean;
  maxGuesses: number;
  answer?: string;
}

export interface SubmitGuessResponse extends TodayPuzzleResponse {
  xpAwarded: number;
  stats: WordGameStats;
}

/**
 * Classic Wordle diffing: exact matches first, then a second pass for
 * "right letter, wrong spot" that respects how many of that letter remain
 * in the answer (so a guess with 2 of a letter the answer only has once
 * doesn't mark both as present).
 */
export function computeFeedback(guess: string, answer: string): LetterStatus[] {
  const result: LetterStatus[] = new Array(guess.length).fill('absent');
  const answerLetters = answer.split('');
  const used = new Array(answer.length).fill(false);

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answerLetters[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const idx = answerLetters.findIndex((letter, j) => letter === guess[i] && !used[j]);
    if (idx !== -1) {
      result[i] = 'present';
      used[idx] = true;
    }
  }

  return result;
}

@Injectable()
export class WordGameService {
  constructor(
    @InjectRepository(WordGameAttempt)
    private readonly attemptRepository: Repository<WordGameAttempt>,
    @InjectRepository(WordGameStats)
    private readonly statsRepository: Repository<WordGameStats>,
    private readonly gamificationService: GamificationService,
  ) {}

  getPuzzleNumber(): number {
    const now = new Date();
    const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((todayUtcMs - EPOCH_UTC_MS) / ONE_DAY_MS);
  }

  private getWordForPuzzle(puzzleNumber: number): string {
    const index = ((puzzleNumber % WORD_LIST.length) + WORD_LIST.length) % WORD_LIST.length;
    return WORD_LIST[index];
  }

  private toResponse(attempt: WordGameAttempt | null, puzzleNumber: number): TodayPuzzleResponse {
    const answer = this.getWordForPuzzle(puzzleNumber);
    const guesses = attempt?.guesses ?? [];
    const completed = attempt?.completed ?? false;
    return {
      puzzleNumber,
      guesses,
      feedback: guesses.map((g) => computeFeedback(g, answer)),
      completed,
      won: attempt?.won ?? false,
      maxGuesses: MAX_GUESSES,
      answer: completed ? answer : undefined,
    };
  }

  async getToday(userId: string): Promise<TodayPuzzleResponse> {
    const puzzleNumber = this.getPuzzleNumber();
    const attempt = await this.attemptRepository.findOne({ where: { userId, puzzleNumber } });
    return this.toResponse(attempt, puzzleNumber);
  }

  async submitGuess(userId: string, rawGuess: string): Promise<SubmitGuessResponse> {
    const guess = rawGuess.toLowerCase();
    if (!WORD_LIST.includes(guess)) {
      throw new BadRequestException('Not a recognized word — try another guess.');
    }

    const puzzleNumber = this.getPuzzleNumber();
    let attempt = await this.attemptRepository.findOne({ where: { userId, puzzleNumber } });

    if (attempt?.completed) {
      throw new BadRequestException("You've already completed today's puzzle.");
    }
    if (!attempt) {
      attempt = this.attemptRepository.create({ userId, puzzleNumber, guesses: [], won: false, completed: false });
    }
    if (attempt.guesses.length >= MAX_GUESSES) {
      throw new BadRequestException('No guesses left.');
    }

    const answer = this.getWordForPuzzle(puzzleNumber);
    attempt.guesses = [...attempt.guesses, guess];
    attempt.won = guess === answer;
    attempt.completed = attempt.won || attempt.guesses.length >= MAX_GUESSES;
    await this.attemptRepository.save(attempt);

    let xpAwarded = 0;
    let stats = await this.statsRepository.findOne({ where: { userId } });

    if (attempt.completed) {
      stats = await this.recordCompletion(userId, stats, puzzleNumber, attempt.won, attempt.guesses.length);

      if (attempt.won) {
        xpAwarded = WIN_XP_BY_GUESS_COUNT[attempt.guesses.length - 1] ?? 10;
        await this.gamificationService.awardXp(userId, XpSource.WORD_GAME_WIN, xpAwarded);

        if (stats.currentStreak > 0 && stats.currentStreak % 7 === 0) {
          await this.gamificationService.awardXp(userId, XpSource.STREAK_BONUS, 50);
        }
      }
    }

    return {
      ...this.toResponse(attempt, puzzleNumber),
      xpAwarded,
      stats: stats ?? (await this.getOrCreateStats(userId)),
    };
  }

  private async getOrCreateStats(userId: string): Promise<WordGameStats> {
    const existing = await this.statsRepository.findOne({ where: { userId } });
    if (existing) return existing;
    return this.statsRepository.create({ userId, guessDistribution: [0, 0, 0, 0, 0, 0] });
  }

  private async recordCompletion(
    userId: string,
    existingStats: WordGameStats | null,
    puzzleNumber: number,
    won: boolean,
    guessCount: number,
  ): Promise<WordGameStats> {
    const stats = existingStats ?? this.statsRepository.create({ userId, guessDistribution: [0, 0, 0, 0, 0, 0] });

    stats.totalPlayed += 1;

    if (won) {
      stats.totalWon += 1;
      const distribution = [...stats.guessDistribution];
      distribution[guessCount - 1] = (distribution[guessCount - 1] ?? 0) + 1;
      stats.guessDistribution = distribution;

      const isConsecutiveDay = stats.lastPuzzleNumber === puzzleNumber - 1;
      stats.currentStreak = isConsecutiveDay ? stats.currentStreak + 1 : 1;
      stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }

    stats.lastPuzzleNumber = puzzleNumber;
    return this.statsRepository.save(stats);
  }

  async getStats(userId: string): Promise<WordGameStats> {
    return this.getOrCreateStats(userId);
  }
}
