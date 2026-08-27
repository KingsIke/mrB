import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Not, In } from 'typeorm';
import { Question, QuestionDifficulty } from './entities/question.entity';
import { Battle, BattleType, BattleStatus } from './entities/battle.entity';
import { BattleAnswer } from './entities/battle-answer.entity';
import { DeptWarStats } from './entities/dept-war-stats.entity';
import { UserWarStats } from './entities/user-war-stats.entity';
import { User } from '../users/entities/user.entity';
import {
  ChallengeDto,
  AcceptChallengeDto,
  ScheduleBattleDto,
  SubmitAnswerDto,
  MatchmakingDto,
} from './dto/war.dto';
import { DepartmentWarGateway } from './department-war.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationTargetType } from '../notifications/entities/notification.entity';

@Injectable()
export class DepartmentWarService {
  private readonly logger = new Logger(DepartmentWarService.name);

  constructor(
    @InjectRepository(Question) private questionRepo: Repository<Question>,
    @InjectRepository(Battle) private battleRepo: Repository<Battle>,
    @InjectRepository(BattleAnswer) private answerRepo: Repository<BattleAnswer>,
    @InjectRepository(DeptWarStats) private deptStatsRepo: Repository<DeptWarStats>,
    @InjectRepository(UserWarStats) private userStatsRepo: Repository<UserWarStats>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private gateway: DepartmentWarGateway,
    private notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────
  // MATCHMAKING
  // ─────────────────────────────────────────────────────

  async getQuickMatchCandidates(userId: string, departmentId?: string) {
    const me = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const busyUserIds = await this.getBusyUserIds();

    const candidatesQuery = this.userRepo
      .createQueryBuilder('u')
      .where('u.id != :userId', { userId })
      .andWhere('u.status = :status', { status: 'active' });

    // Optional department filter — if omitted, match against ALL users
    if (departmentId) {
      candidatesQuery.andWhere('u.departmentId = :departmentId', { departmentId });
    }

    if (busyUserIds.size > 0) {
      candidatesQuery.andWhere('u.id NOT IN (:...busyIds)', {
        busyIds: Array.from(busyUserIds),
      });
    }

    const candidates = await candidatesQuery.getMany();

    // Only show users who are actually online and reachable right now —
    // no point letting the requester pick someone who can't respond.
    const onlineCandidates = candidates.filter((c) => this.gateway.isUserOnline(c.id));

    return Promise.all(
      onlineCandidates.map(async (c) => {
        const stats = await this.getOrCreateUserStats(c.id);
        return {
          id: c.id,
          username: c.username,
          firstName: c.firstName,
          lastName: c.lastName,
          profilePictureUrl: c.profilePictureUrl,
          stats: {
            totalBattles: stats.totalBattles,
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.totalBattles > 0 ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
            currentWinStreak: stats.currentWinStreak,
          },
        };
      }),
    );
  }

  private async getBusyUserIds(): Promise<Set<string>> {
    // Only COUNTDOWN and ACTIVE battles mean the user is truly in a battle.
    // WAITING means a challenge was sent but not yet accepted — users should
    // still be challengeable / able to send challenges while pending.
    const activeBattlePlayers = await this.battleRepo
      .createQueryBuilder('b')
      .select(['b.player1Id', 'b.player2Id'])
      .where('b.status IN (:...statuses)', {
        statuses: [BattleStatus.COUNTDOWN, BattleStatus.ACTIVE],
      })
      .getMany();
    const busyUserIds = new Set<string>();
    activeBattlePlayers.forEach((b) => {
      busyUserIds.add(b.player1Id);
      if (b.player2Id) busyUserIds.add(b.player2Id);
    });
    return busyUserIds;
  }

  async findMatch(userId: string, dto: MatchmakingDto) {
    const me = await this.userRepo.findOneOrFail({ where: { id: userId } });

    // Get user's war stats for level-based matching
    const myStats = await this.getOrCreateUserStats(userId);

    const busyUserIds = await this.getBusyUserIds();

    let opponent: User;

    if (dto.opponentId) {
      // User picked a specific opponent from the active-users list
      if (dto.opponentId === userId) {
        throw new BadRequestException('You cannot challenge yourself');
      }
      if (busyUserIds.has(dto.opponentId)) {
        throw new ConflictException('That user just entered another battle. Pick someone else.');
      }
      if (!this.gateway.isUserOnline(dto.opponentId)) {
        throw new BadRequestException('That user is no longer online');
      }
      const picked = await this.userRepo.findOne({ where: { id: dto.opponentId } });
      if (!picked) {
        throw new NotFoundException('Opponent not found');
      }
      opponent = picked;
    } else {
      // Find candidates: online, not busy, not recently battled
      const candidatesQuery = this.userRepo
        .createQueryBuilder('u')
        .where('u.id != :userId', { userId })
        .andWhere('u.status = :status', { status: 'active' });

      // Optional department filter
      if (dto.departmentId) {
        candidatesQuery.andWhere('u.departmentId = :departmentId', { departmentId: dto.departmentId });
      }

      if (busyUserIds.size > 0) {
        candidatesQuery.andWhere('u.id NOT IN (:...busyIds)', {
          busyIds: Array.from(busyUserIds),
        });
      }

      const allCandidates = await candidatesQuery.getMany();
      const candidates = allCandidates.filter((c) => this.gateway.isUserOnline(c.id));

      if (candidates.length === 0) {
        throw new NotFoundException('No opponents available right now. Try again in a minute.');
      }

      // Score candidates by recency and stats similarity
      const scored = await Promise.all(
        candidates.map(async (c) => {
          const cStats = await this.getOrCreateUserStats(c.id);
          let score = 0;

          // Prefer users not battled recently
          if (cStats.lastOpponentId === userId) {
            score -= 50;
          }

          // Prefer users with similar win rate (fair matchmaking)
          const myWinRate = myStats.totalBattles > 0 ? myStats.wins / myStats.totalBattles : 0.5;
          const theirWinRate = cStats.totalBattles > 0 ? cStats.wins / cStats.totalBattles : 0.5;
          score -= Math.abs(myWinRate - theirWinRate) * 20;

          // Prefer users with fewer battles today (fairness)
          score -= cStats.totalBattles * 2;

          // Add randomness
          score += Math.random() * 10;

          return { user: c, score, stats: cStats };
        }),
      );

      scored.sort((a, b) => b.score - a.score);
      opponent = scored[0].user;
    }

    // Create the battle
    const battle = this.battleRepo.create({
      type: BattleType.QUICK_MATCH,
      status: BattleStatus.WAITING,
      player1Id: userId,
      player2Id: opponent.id,
      totalQuestions: 10,
      timePerQuestion: 15,
      departmentPoints: 10,
      expiresAt: new Date(Date.now() + 30000), // 30s to accept
    });

    const saved = await this.battleRepo.save(battle);

    // Notify opponent via socket (include challenger stats for instant display)
    const [challengerSummary, challengerStats] = await Promise.all([
      this.getUserSummary(userId),
      this.getChallengerStats(userId),
    ]);

    this.gateway.notifyChallengeSent(opponent.id, {
      battleId: saved.id,
      challenger: challengerSummary,
      challengerStats,
      type: BattleType.QUICK_MATCH,
      expiresAt: saved.expiresAt,
    });

    // Send push notification
    await this.sendPushNotification(
      opponent.id,
      userId,
      NotificationType.WAR_CHALLENGED,
      saved.id,
      challengerSummary?.username || 'Someone',
    );

    return {
      battleId: saved.id,
      opponent: await this.getUserSummary(opponent.id),
      status: 'waiting',
    };
  }

  // ─────────────────────────────────────────────────────
  // CHALLENGE (user-picked opponent)
  // ─────────────────────────────────────────────────────

  async challengeUser(userId: string, dto: ChallengeDto) {
    if (userId === dto.opponentId) {
      throw new BadRequestException('You cannot challenge yourself');
    }

    const me = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const opponent = await this.userRepo.findOneOrFail({ where: { id: dto.opponentId } });

    // Check for existing active battle between these two
    const existingBattle = await this.battleRepo.findOne({
      where: [
        { player1Id: userId, player2Id: dto.opponentId, status: In([BattleStatus.WAITING, BattleStatus.ACTIVE]) },
        { player1Id: dto.opponentId, player2Id: userId, status: In([BattleStatus.WAITING, BattleStatus.ACTIVE]) },
      ],
    });
    if (existingBattle) {
      throw new ConflictException('You already have an active battle with this user');
    }

    const battle = this.battleRepo.create({
      type: BattleType.CHALLENGE,
      status: BattleStatus.WAITING,
      player1Id: userId,
      player2Id: dto.opponentId,
      totalQuestions: dto.totalQuestions || 10,
      timePerQuestion: dto.timePerQuestion || 15,
      departmentPoints: 10,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min to accept
    });

    const saved = await this.battleRepo.save(battle);

    // Notify opponent via socket (include challenger stats for instant display)
    const [challengerSummary, challengerStats] = await Promise.all([
      this.getUserSummary(userId),
      this.getChallengerStats(userId),
    ]);

    this.gateway.notifyChallengeSent(opponent.id, {
      battleId: saved.id,
      challenger: challengerSummary,
      challengerStats,
      type: BattleType.CHALLENGE,
      expiresAt: saved.expiresAt,
    });

    // Send push notification
    await this.sendPushNotification(
      opponent.id,
      userId,
      NotificationType.WAR_CHALLENGED,
      saved.id,
      challengerSummary?.username || 'Someone',
    );

    return {
      battleId: saved.id,
      opponent: await this.getUserSummary(opponent.id),
      status: 'waiting',
    };
  }

  // ─────────────────────────────────────────────────────
  // ACCEPT / REJECT CHALLENGE
  // ─────────────────────────────────────────────────────

  async acceptChallenge(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOneOrFail({ where: { id: battleId } });

    if (battle.player2Id !== userId) {
      throw new BadRequestException('This challenge is not for you');
    }
    if (battle.status !== BattleStatus.WAITING) {
      throw new BadRequestException('Battle is no longer waiting for acceptance');
    }
    if (battle.expiresAt && battle.expiresAt < new Date()) {
      throw new BadRequestException('Challenge has expired');
    }

    // Start countdown
    battle.status = BattleStatus.COUNTDOWN;
    battle.startedAt = new Date();
    await this.battleRepo.save(battle);

    // Let the challenger know immediately that their request was accepted
    // (don't make them wait for the battle-start countdown to find out)
    this.gateway.notifyChallengeAccepted(battle.player1Id, {
      battleId: battle.id,
      opponent: await this.getUserSummary(userId),
    });

    // Notify both players
    const questions = await this.selectQuestions(battle.totalQuestions, battle.player1Id, battle.player2Id!);
    const questionPayloads = questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
      // Don't send correctIndex to clients!
    }));

    // Store the selected question IDs so submitAnswer can look them up
    // instead of re-generating with RANDOM()
    battle.selectedQuestionIds = questions.map((q) => q.id);
    await this.battleRepo.save(battle);

    // Delay socket emission by 1 second so the acceptor client has time to
    // navigate to battleArena and register its socket listener before the
    // event arrives. Without this delay the event is emitted → missed.
    const battleStartPayload = {
      battleId: battle.id,
      questions: questionPayloads,
      totalQuestions: battle.totalQuestions,
      timePerQuestion: battle.timePerQuestion,
    };
    setTimeout(() => {
      this.gateway.notifyBattleStart(battle.player1Id, battle.player2Id!, battleStartPayload);
    }, 1000);

    // After 3-second countdown, set to ACTIVE
    setTimeout(async () => {
      const b = await this.battleRepo.findOne({ where: { id: battleId } });
      if (b && b.status === BattleStatus.COUNTDOWN) {
        b.status = BattleStatus.ACTIVE;
        b.currentQuestionIndex = 0;
        await this.battleRepo.save(b);
        this.gateway.notifyQuestionStart(b.player1Id, b.player2Id!, {
          battleId: b.id,
          questionIndex: 0,
          player1Score: b.player1Score,
          player2Score: b.player2Score,
        });
      }
    }, 3500);

    return {
      battleId: battle.id,
      status: 'countdown',
      questions: questionPayloads,
      totalQuestions: battle.totalQuestions,
      timePerQuestion: battle.timePerQuestion,
    };
  }

  async rejectChallenge(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOneOrFail({ where: { id: battleId } });
    if (battle.player2Id !== userId) {
      throw new BadRequestException('This challenge is not for you');
    }

    battle.status = BattleStatus.CANCELLED;
    await this.battleRepo.save(battle);

    const rejector = await this.getUserSummary(userId);
    this.gateway.notifyChallengeRejected(battle.player1Id, {
      battleId: battle.id,
      reason: 'rejected',
      by: rejector,
    });
    return { success: true };
  }

  async cancelChallenge(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOneOrFail({ where: { id: battleId } });

    // Only the challenger (player1) can cancel a pending challenge
    if (battle.player1Id !== userId) {
      throw new BadRequestException('Only the challenger can cancel this request');
    }
    if (battle.status !== BattleStatus.WAITING) {
      throw new BadRequestException('Battle is no longer waiting for acceptance');
    }

    battle.status = BattleStatus.CANCELLED;
    await this.battleRepo.save(battle);

    if (battle.player2Id) {
      // Notify opponent via socket (real-time)
      const canceller = await this.getUserSummary(userId);
      this.gateway.notifyChallengeRejected(battle.player2Id, {
        battleId: battle.id,
        reason: 'cancelled',
        by: canceller,
      });

      // Send push notification (offline fallback)
      const challenger = await this.getUserSummary(userId);
      await this.sendPushNotification(
        battle.player2Id,
        userId,
        NotificationType.WAR_CHALLENGED, // reuse challenged type — client shows cancelled message
        battle.id,
        challenger?.username || 'Someone',
        'cancelled',
      );
    }

    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // SUBMIT ANSWER
  // ─────────────────────────────────────────────────────

  async submitAnswer(userId: string, dto: SubmitAnswerDto) {
    this.logger.log(`submitAnswer called: userId=${userId}, battleId=${dto.battleId}, questionIndex=${dto.questionIndex}, selectedOption=${dto.selectedOption}`);

    let battle: Battle | null = null;
    try {
      battle = await this.battleRepo.findOne({
        where: { id: dto.battleId },
      });
    } catch (err) {
      this.logger.error(`submitAnswer: failed to load battle ${dto.battleId}: ${err}`);
      throw new NotFoundException('Battle not found');
    }
    if (!battle) {
      this.logger.warn(`submitAnswer: battle ${dto.battleId} not found for user ${userId}`);
      throw new NotFoundException('Battle not found');
    }

    if (battle.status !== BattleStatus.ACTIVE && battle.status !== BattleStatus.COUNTDOWN) {
      this.logger.warn(`submitAnswer: battle ${dto.battleId} has invalid status '${battle.status}' for user ${userId}`);
      throw new BadRequestException('Battle is not active');
    }
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      this.logger.warn(`submitAnswer: user ${userId} is not a player in battle ${dto.battleId} (player1=${battle.player1Id}, player2=${battle.player2Id})`);
      throw new BadRequestException('You are not in this battle');
    }

    // Check if already answered this question
    const existing = await this.answerRepo.findOne({
      where: { battleId: dto.battleId, userId, questionIndex: dto.questionIndex },
    });
    if (existing) {
      this.logger.warn(`submitAnswer: user ${userId} already answered question ${dto.questionIndex} in battle ${dto.battleId}`);
      throw new BadRequestException('Already answered this question');
    }

    // Get the correct answer — use stored question IDs, NOT re-generated
    let question: Question | null = null;
    if (battle.selectedQuestionIds && battle.selectedQuestionIds[dto.questionIndex]) {
      const questionId = battle.selectedQuestionIds[dto.questionIndex];
      this.logger.log(`submitAnswer: looking up stored question ${questionId} at index ${dto.questionIndex}`);
      question = await this.questionRepo.findOne({ where: { id: questionId } }).catch((err) => {
        this.logger.error(`submitAnswer: failed to load question ${questionId} from DB: ${err}`);
        return null;
      });
    }
    if (!question) {
      // Fallback: re-select questions for old battles without stored IDs
      this.logger.warn(`submitAnswer: stored question not found at index ${dto.questionIndex} (selectedQuestionIds=${JSON.stringify(battle.selectedQuestionIds)}), falling back to selectQuestions`);
      const questions = await this.selectQuestions(battle.totalQuestions, battle.player1Id, battle.player2Id!);
      question = questions[dto.questionIndex] || null;
    }
    if (!question) {
      this.logger.error(`submitAnswer: no question available at index ${dto.questionIndex} for battle ${dto.battleId}`);
      throw new BadRequestException('Invalid question index');
    }

    const isCorrect = dto.selectedOption === question.correctIndex;
    const points = isCorrect ? this.calculatePoints(dto.timeTakenMs, question.difficulty) : 0;

    // Save answer
    const answer = this.answerRepo.create({
      battleId: dto.battleId,
      userId,
      questionIndex: dto.questionIndex,
      selectedOption: dto.selectedOption,
      isCorrect,
      timeTakenMs: dto.timeTakenMs,
    });
    try {
      await this.answerRepo.save(answer);
    } catch (err) {
      this.logger.error(`submitAnswer: failed to save answer for user ${userId} in battle ${dto.battleId}, question ${dto.questionIndex}: ${err}`);
      throw err;
    }

    // Update battle scores
    if (userId === battle.player1Id) {
      battle.player1Score += points;
    } else {
      battle.player2Score += points;
    }

    // Check if both players answered this question
    const answersForQuestion = await this.answerRepo.find({
      where: { battleId: dto.battleId, questionIndex: dto.questionIndex },
    });

    const bothAnswered = answersForQuestion.length === 2;

    // Notify opponent — include both scores so their scoreboard updates
    const opponentId = userId === battle.player1Id ? battle.player2Id! : battle.player1Id;
    this.gateway.notifyAnswerSubmitted(opponentId, {
      battleId: battle.id,
      answeredBy: userId,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      questionIndex: dto.questionIndex,
    });

    // Also notify the submitting player so their client can update the scoreboard
    // (the HTTP response already has the scores, but a socket event keeps it in sync
    //  if the client uses the socket for live updates)
    this.gateway.notifyAnswerSubmitted(userId, {
      battleId: battle.id,
      answeredBy: userId,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      questionIndex: dto.questionIndex,
    });

    // ── Real-time score update ──
    // Broadcast the full scoreboard state to both players so the UI can
    // instantly show each other's score, who has answered, and points earned.
    const player1Answered = answersForQuestion.some((a) => a.userId === battle.player1Id);
    const player2Answered = battle.player2Id
      ? answersForQuestion.some((a) => a.userId === battle.player2Id)
      : false;

    this.gateway.notifyScoreUpdate(battle.player1Id, battle.player2Id!, {
      battleId: battle.id,
      questionIndex: dto.questionIndex,
      totalQuestions: battle.totalQuestions,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      player1Answered,
      player2Answered,
      answeredBy: userId,
      pointsEarned: points,
      isCorrect,
    });

    // If both answered, advance to next question or end battle
    if (bothAnswered) {
      const nextIndex = dto.questionIndex + 1;

      if (nextIndex >= battle.totalQuestions) {
        // Battle finished!
        this.logger.log(`submitAnswer: both players answered, battle ${dto.battleId} finished`);
        await this.finishBattle(battle);
      } else {
        battle.currentQuestionIndex = nextIndex;
        try {
          await this.battleRepo.save(battle);
        } catch (err) {
          this.logger.error(`submitAnswer: failed to save battle progress for ${dto.battleId}: ${err}`);
          throw err;
        }

        this.gateway.notifyQuestionStart(battle.player1Id, battle.player2Id!, {
          battleId: battle.id,
          questionIndex: nextIndex,
          player1Score: battle.player1Score,
          player2Score: battle.player2Score,
        });
      }
    } else {
      try {
        await this.battleRepo.save(battle);
      } catch (err) {
        this.logger.error(`submitAnswer: failed to save battle score for ${dto.battleId}: ${err}`);
        throw err;
      }
    }

    this.logger.log(`submitAnswer: success for user ${userId} in battle ${dto.battleId}, question ${dto.questionIndex}, isCorrect=${isCorrect}, points=${points}`);

    return {
      isCorrect,
      correctOption: isCorrect ? undefined : question.correctIndex,
      points,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      bothAnswered,
    };
  }

  // ─────────────────────────────────────────────────────
  // SCHEDULED BATTLES
  // ─────────────────────────────────────────────────────

  async scheduleBattle(userId: string, dto: ScheduleBattleDto) {
    if (userId === dto.opponentId) {
      throw new BadRequestException('You cannot schedule a battle with yourself');
    }

    const scheduledDate = new Date(dto.scheduledAt);
    if (scheduledDate <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }
    if (scheduledDate > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
      throw new BadRequestException('Cannot schedule more than 30 days in advance');
    }

    const battle = this.battleRepo.create({
      type: BattleType.SCHEDULED,
      status: BattleStatus.PENDING,
      player1Id: userId,
      player2Id: dto.opponentId,
      totalQuestions: dto.totalQuestions || 10,
      timePerQuestion: 15,
      scheduledAt: scheduledDate,
      departmentPoints: 15, // scheduled battles worth more
    });

    const saved = await this.battleRepo.save(battle);

    // Notify opponent (include challenger stats for instant display)
    const [challengerSummary, challengerStats] = await Promise.all([
      this.getUserSummary(userId),
      this.getChallengerStats(userId),
    ]);

    this.gateway.notifyChallengeSent(dto.opponentId, {
      battleId: saved.id,
      challenger: challengerSummary,
      challengerStats,
      type: BattleType.SCHEDULED,
      scheduledAt: scheduledDate,
    });

    return {
      battleId: saved.id,
      scheduledAt: scheduledDate,
      status: 'pending',
    };
  }

  async getScheduledBattles(userId: string) {
    return this.battleRepo.find({
      where: [
        { player1Id: userId, type: BattleType.SCHEDULED, status: BattleStatus.PENDING },
        { player2Id: userId, type: BattleType.SCHEDULED, status: BattleStatus.PENDING },
      ],
      relations: ['player1', 'player2'],
      order: { scheduledAt: 'ASC' },
    });
  }

  async cancelScheduledBattle(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOneOrFail({ where: { id: battleId } });

    // Either player can cancel a scheduled battle
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new BadRequestException('You are not part of this scheduled battle');
    }
    if (battle.type !== BattleType.SCHEDULED) {
      throw new BadRequestException('This is not a scheduled battle');
    }
    if (battle.status !== BattleStatus.PENDING) {
      throw new BadRequestException('Battle can no longer be cancelled');
    }

    battle.status = BattleStatus.CANCELLED;
    await this.battleRepo.save(battle);

    // Notify the other player
    const opponentId = userId === battle.player1Id ? battle.player2Id : battle.player1Id;
    if (opponentId) {
      const canceller = await this.getUserSummary(userId);
      this.gateway.notifyChallengeRejected(opponentId, {
        battleId: battle.id,
        reason: 'cancelled',
        by: canceller,
      });

      // Push notification fallback
      await this.sendPushNotification(
        opponentId,
        userId,
        NotificationType.WAR_CHALLENGED,
        battle.id,
        canceller?.username || 'Someone',
        'scheduled_cancelled',
      );
    }

    return { success: true };
  }

  // ─────────────────────────────────────────────────────
  // SEARCH OPPONENTS
  // ─────────────────────────────────────────────────────

  async searchOpponents(userId: string, query: string, departmentId?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'dept')
      .where('u.id != :userId', { userId })
      .andWhere('u.status = :status', { status: 'active' });

    // Optional department filter — if omitted, search ALL users
    if (departmentId) {
      qb.andWhere('u.departmentId = :departmentId', { departmentId });
    }

    if (query && query.trim()) {
      qb.andWhere(
        '(LOWER(u.username) LIKE :q OR LOWER(u.firstName) LIKE :q OR LOWER(u.lastName) LIKE :q)',
        { q: `%${query.toLowerCase().trim()}%` },
      );
    }

    const users = await qb.take(20).getMany();

    // Enrich with war stats
    const results = await Promise.all(
      users.map(async (u) => {
        const stats = await this.getOrCreateUserStats(u.id);
        return {
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          profilePictureUrl: u.profilePictureUrl,
          departmentId: u.departmentId,
          departmentName: (u as any).department?.name || null,
          stats: {
            totalBattles: stats.totalBattles,
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.totalBattles > 0 ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
            currentWinStreak: stats.currentWinStreak,
          },
        };
      }),
    );

    return results;
  }

  // ─────────────────────────────────────────────────────
  // LEADERBOARDS
  // ─────────────────────────────────────────────────────

  async getDeptLeaderboard() {
    return this.deptStatsRepo.find({
      order: { totalPoints: 'DESC' },
      relations: ['department'],
      take: 20,
    });
  }

  async getUserLeaderboard(departmentId?: string) {
    const qb = this.userStatsRepo
      .createQueryBuilder('us')
      .leftJoinAndSelect('us.user', 'u')
      .orderBy('us.wins', 'DESC')
      .addOrderBy('us.totalPointsEarned', 'DESC')
      .take(20);

    if (departmentId) {
      qb.where('u.departmentId = :departmentId', { departmentId });
    }

    return qb.getMany();
  }

  async getUserWarStats(userId: string) {
    return this.getOrCreateUserStats(userId);
  }

  // ─────────────────────────────────────────────────────
  // ACTIVE BATTLE
  // ─────────────────────────────────────────────────────

  async getActiveBattle(userId: string) {
    const battle = await this.battleRepo.findOne({
      where: [
        { player1Id: userId, status: In([BattleStatus.WAITING, BattleStatus.COUNTDOWN, BattleStatus.ACTIVE]) },
        { player2Id: userId, status: In([BattleStatus.WAITING, BattleStatus.COUNTDOWN, BattleStatus.ACTIVE]) },
      ],
      relations: ['player1', 'player2'],
    });
    return battle || null;
  }

  /**
   * Get all incoming WAITING challenges where the current user is player2
   * (i.e. someone challenged them and they haven't responded yet).
   */
  async getPendingChallenges(userId: string) {
    const battles = await this.battleRepo.find({
      where: {
        player2Id: userId,
        status: BattleStatus.WAITING,
      },
      relations: ['player1', 'player2'],
      order: { createdAt: 'DESC' },
    });

    // Enrich each battle with the challenger's (player1) war stats
    const enriched = await Promise.all(
      battles.map(async (battle) => {
        const stats = await this.getOrCreateUserStats(battle.player1Id);
        return {
          ...battle,
          challengerStats: {
            totalBattles: stats.totalBattles,
            wins: stats.wins,
            losses: stats.losses,
            winRate: stats.totalBattles > 0 ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
            currentWinStreak: stats.currentWinStreak,
            bestWinStreak: stats.bestWinStreak,
          },
        };
      }),
    );

    return enriched;
  }

  // ─────────────────────────────────────────────────────
  // HISTORY
  // ─────────────────────────────────────────────────────

  async getBattleHistory(userId: string, limit = 20, cursor?: string) {
    const qb = this.battleRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.player1', 'p1')
      .leftJoinAndSelect('b.player2', 'p2')
      .leftJoinAndSelect('b.winner', 'w')
      .where('(b.player1Id = :userId OR b.player2Id = :userId)', { userId })
      .andWhere('b.status = :status', { status: BattleStatus.FINISHED })
      .orderBy('b.finishedAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere('b.finishedAt < :cursor', { cursor });
    }

    const battles = await qb.getMany();
    const hasMore = battles.length > limit;
    if (hasMore) battles.pop();

    return {
      battles,
      nextCursor: hasMore ? battles[battles.length - 1].finishedAt : null,
    };
  }

  // ─────────────────────────────────────────────────────
  // SEED QUESTIONS
  // ─────────────────────────────────────────────────────

  async seedQuestion(
    questionText: string,
    options: string[],
    correctIndex: number,
    departmentId?: string,
    category?: string,
    difficulty?: string,
  ) {
    if (options.length !== 4) {
      throw new BadRequestException('Exactly 4 options are required');
    }
    if (correctIndex < 0 || correctIndex > 3) {
      throw new BadRequestException('correctIndex must be 0-3');
    }

    const q = this.questionRepo.create({
      questionText,
      options,
      correctIndex,
      departmentId: departmentId || null,
      category: category || 'general',
      difficulty: (difficulty as QuestionDifficulty) || QuestionDifficulty.MEDIUM,
    });

    return this.questionRepo.save(q);
  }

  async seedBulkQuestions(
    questions: Array<{
      questionText: string;
      options: string[];
      correctIndex: number;
      departmentId?: string;
      category?: string;
      difficulty?: string;
    }>,
  ) {
    const entities = questions.map((q) =>
      this.questionRepo.create({
        questionText: q.questionText,
        options: q.options,
        correctIndex: q.correctIndex,
        departmentId: q.departmentId || null,
        category: q.category || 'general',
        difficulty: (q.difficulty as QuestionDifficulty) || QuestionDifficulty.MEDIUM,
      }),
    );

    return this.questionRepo.save(entities);
  }

  // ─────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────

  private async selectQuestions(count: number, player1Id: string, player2Id: string): Promise<Question[]> {
    // Get both users' departments
    const [p1, p2] = await Promise.all([
      this.userRepo.findOne({ where: { id: player1Id } }),
      this.userRepo.findOne({ where: { id: player2Id } }),
    ]);

    // Collect unique department IDs from both players
    const deptIds = [p1?.departmentId, p2?.departmentId].filter(Boolean) as string[];
    const uniqueDeptIds = [...new Set(deptIds)];

    // 60% department questions (from either player's dept), 40% general
    const deptCount = Math.ceil(count * 0.6);
    const generalCount = count - deptCount;

    let deptQuestions: Question[] = [];
    let generalQuestions: Question[] = [];

    if (uniqueDeptIds.length > 0) {
      deptQuestions = await this.questionRepo
        .createQueryBuilder('q')
        .where('q.departmentId IN (:...deptIds)', { deptIds: uniqueDeptIds })
        .andWhere('q.isActive = true')
        .orderBy('RANDOM()')
        .take(deptCount)
        .getMany();
    }

    generalQuestions = await this.questionRepo
      .createQueryBuilder('q')
      .where('q.departmentId IS NULL')
      .andWhere('q.isActive = true')
      .orderBy('RANDOM()')
      .take(generalCount)
      .getMany();

    // Fill gaps if not enough questions in one category
    const all = [...deptQuestions, ...generalQuestions];
    if (all.length < count) {
      const gapQuery = this.questionRepo
        .createQueryBuilder('q')
        .andWhere('q.isActive = true')
        .orderBy('RANDOM()')
        .take(count - all.length);

      const existingIds = all.map((q) => q.id);
      if (existingIds.length > 0) {
        gapQuery.andWhere('q.id NOT IN (:...ids)', { ids: existingIds });
      }

      const missing = await gapQuery.getMany();
      all.push(...missing);
    }

    // Shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }

    return all.slice(0, count);
  }

  private calculatePoints(timeTakenMs: number, difficulty: QuestionDifficulty): number {
    // Base points by difficulty
    const base = difficulty === QuestionDifficulty.HARD ? 15 : difficulty === QuestionDifficulty.MEDIUM ? 10 : 5;

    // Speed bonus: faster = more points (up to +5 for answering in <2s)
    const maxTimeMs = 15000;
    const speedBonus = Math.max(0, Math.round(5 * (1 - timeTakenMs / maxTimeMs)));

    return base + speedBonus;
  }

  private async finishBattle(battle: Battle) {
    this.logger.log(`finishBattle: starting for battle ${battle.id}`);

    if (!battle.player2Id) {
      this.logger.warn(`Cannot finish battle ${battle.id}: player2Id is null`);
      battle.status = BattleStatus.CANCELLED;
      battle.finishedAt = new Date();
      await this.battleRepo.save(battle);
      return;
    }

    battle.status = BattleStatus.FINISHED;
    battle.finishedAt = new Date();

    if (battle.player1Score > battle.player2Score) {
      battle.winnerId = battle.player1Id;
    } else if (battle.player2Score > battle.player1Score) {
      battle.winnerId = battle.player2Id;
    }
    // If tied, winnerId stays null (draw)

    try {
      await this.battleRepo.save(battle);
    } catch (err) {
      this.logger.error(`finishBattle: failed to save battle ${battle.id} as FINISHED: ${err}`);
      // Still try to notify clients — don't leave them hanging
    }

    // Update stats (wrapped in try/catch so a stats failure doesn't block the socket notification)
    try {
      await this.updateBattleStats(battle);
    } catch (err) {
      this.logger.error(`finishBattle: failed to update battle stats for ${battle.id}: ${err}`);
    }

    // Notify both players via socket — always attempt this even if stats failed
    try {
      const p1Stats = await this.getOrCreateUserStats(battle.player1Id);
      const p2Stats = await this.getOrCreateUserStats(battle.player2Id!);

      this.gateway.notifyBattleEnded(battle.player1Id, battle.player2Id!, {
        battleId: battle.id,
        winnerId: battle.winnerId,
        player1Score: battle.player1Score,
        player2Score: battle.player2Score,
        departmentPoints: battle.departmentPoints,
        stats: {
          player1: { totalBattles: p1Stats.totalBattles, wins: p1Stats.wins, losses: p1Stats.losses },
          player2: { totalBattles: p2Stats.totalBattles, wins: p2Stats.wins, losses: p2Stats.losses },
        },
      });
    } catch (err) {
      this.logger.error(`finishBattle: failed to send BATTLE_ENDED socket event for ${battle.id}: ${err}`);
    }

    // Send push notifications for battle results (non-critical, best effort)
    try {
      const isDraw = !battle.winnerId;
      if (isDraw) {
        await this.sendPushNotification(
          battle.player1Id, battle.player2Id!,
          NotificationType.WAR_BATTLE_DRAW, battle.id,
          '',
        );
        await this.sendPushNotification(
          battle.player2Id!, battle.player1Id,
          NotificationType.WAR_BATTLE_DRAW, battle.id,
          '',
        );
      } else {
        const loserId = battle.winnerId === battle.player1Id ? battle.player2Id : battle.player1Id;
        const winnerName = (await this.getUserSummary(battle.winnerId!))?.username || 'Someone';

        await this.sendPushNotification(
          battle.winnerId!, loserId || battle.winnerId!,
          NotificationType.WAR_BATTLE_WON, battle.id,
          winnerName,
          `+${battle.departmentPoints} dept points`,
        );

        if (loserId) {
          await this.sendPushNotification(
            loserId, battle.winnerId!,
            NotificationType.WAR_BATTLE_LOST, battle.id,
            winnerName,
            `+${Math.floor(battle.departmentPoints / 2)} dept points`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`finishBattle: failed to send push notifications for ${battle.id}: ${err}`);
    }

    this.logger.log(`finishBattle: completed for battle ${battle.id}`);
  }

  private async updateBattleStats(battle: Battle) {
    const isDraw = !battle.winnerId;
    const winnerId = battle.winnerId;
    const loserId = winnerId === battle.player1Id ? battle.player2Id : battle.player1Id;

    // Player 1 stats
    const p1Stats = await this.getOrCreateUserStats(battle.player1Id);
    p1Stats.totalBattles += 1;
    p1Stats.lastBattleAt = new Date();
    if (isDraw) {
      p1Stats.draws += 1;
    } else if (winnerId === battle.player1Id) {
      p1Stats.wins += 1;
      p1Stats.currentWinStreak += 1;
      p1Stats.bestWinStreak = Math.max(p1Stats.bestWinStreak, p1Stats.currentWinStreak);
    } else {
      p1Stats.losses += 1;
      p1Stats.currentWinStreak = 0;
    }
    p1Stats.totalPointsEarned += winnerId === battle.player1Id ? battle.departmentPoints : Math.floor(battle.departmentPoints / 2);
    await this.userStatsRepo.save(p1Stats);

    // Player 2 stats
    if (battle.player2Id) {
      const p2Stats = await this.getOrCreateUserStats(battle.player2Id);
      p2Stats.totalBattles += 1;
      p2Stats.lastBattleAt = new Date();
      if (isDraw) {
        p2Stats.draws += 1;
      } else if (winnerId === battle.player2Id) {
        p2Stats.wins += 1;
        p2Stats.currentWinStreak += 1;
        p2Stats.bestWinStreak = Math.max(p2Stats.bestWinStreak, p2Stats.currentWinStreak);
      } else {
        p2Stats.losses += 1;
        p2Stats.currentWinStreak = 0;
      }
      p2Stats.totalPointsEarned += winnerId === battle.player2Id ? battle.departmentPoints : Math.floor(battle.departmentPoints / 2);
      await this.userStatsRepo.save(p2Stats);
    }

    // Department stats
    const [p1, p2] = await Promise.all([
      this.userRepo.findOne({ where: { id: battle.player1Id } }),
      battle.player2Id ? this.userRepo.findOne({ where: { id: battle.player2Id } }) : null,
    ]);

    if (p1?.departmentId) {
      await this.updateDeptStats(p1.departmentId, winnerId === battle.player1Id, isDraw, battle.departmentPoints);
    }
    if (p2?.departmentId) {
      await this.updateDeptStats(p2.departmentId, winnerId === battle.player2Id, isDraw, Math.floor(battle.departmentPoints / 2));
    }
  }

  private async updateDeptStats(departmentId: string, isWin: boolean, isDraw: boolean, points: number) {
    let stats = await this.deptStatsRepo.findOne({ where: { departmentId } });
    if (!stats) {
      stats = this.deptStatsRepo.create({ departmentId });
    }

    stats.totalBattles += 1;
    stats.totalPoints += points;

    if (isWin) {
      stats.wins += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    } else if (!isDraw) {
      stats.losses += 1;
      stats.currentStreak = 0;
    }

    await this.deptStatsRepo.save(stats);
  }

  private async getOrCreateUserStats(userId: string): Promise<UserWarStats> {
    if (!userId) {
      this.logger.error(`getOrCreateUserStats called with falsy userId: ${userId}`);
      throw new BadRequestException('User ID is required for war stats');
    }
    let stats = await this.userStatsRepo.findOne({ where: { userId } });
    if (!stats) {
      stats = this.userStatsRepo.create({ userId });
      stats = await this.userStatsRepo.save(stats);
    }
    return stats;
  }

  // ─────────────────────────────────────────────────────
  // CRON: SCHEDULED BATTLE REMINDERS
  // ─────────────────────────────────────────────────────

  /**
   * Runs every 5 minutes. Finds scheduled battles starting in 25-35 minutes
   * that haven't been reminded yet, and sends push notifications to both players.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledBattleReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 25 * 60 * 1000); // 25 min from now
    const windowEnd = new Date(now.getTime() + 35 * 60 * 1000);   // 35 min from now

    const pendingBattles = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.type = :type', { type: BattleType.SCHEDULED })
      .andWhere('b.status = :status', { status: BattleStatus.PENDING })
      .andWhere('b."reminderSent" = false')
      .andWhere('b."scheduledAt" BETWEEN :windowStart AND :windowEnd', {
        windowStart,
        windowEnd,
      })
      .getMany();

    if (pendingBattles.length === 0) return;

    this.logger.log(`[War Cron] Found ${pendingBattles.length} scheduled battles needing reminders`);

    for (const battle of pendingBattles) {
      try {
        // Get opponent info for the notification message
        const challenger = await this.getUserSummary(battle.player1Id);
        const challengerName = challenger?.username || 'Someone';

        // Calculate time until battle
        const minsUntil = Math.round((new Date(battle.scheduledAt!).getTime() - Date.now()) / 60000);
        const timeText = minsUntil <= 1 ? 'now' : `in ${minsUntil} minutes`;

        // Notify player 2 (challenger scheduled it, so notify the opponent)
        if (battle.player2Id) {
          await this.sendPushNotification(
            battle.player2Id,
            battle.player1Id,
            NotificationType.WAR_SCHEDULED_REMINDER,
            battle.id,
            challengerName,
            timeText,
          );
        }

        // Also notify player 1 as a reminder
        if (battle.player2Id) {
          const opponent = await this.getUserSummary(battle.player2Id);
          await this.sendPushNotification(
            battle.player1Id,
            battle.player2Id,
            NotificationType.WAR_SCHEDULED_REMINDER,
            battle.id,
            opponent?.username || 'Someone',
            timeText,
          );
        }

        // Mark as reminded
        battle.reminderSent = true;
        await this.battleRepo.save(battle);

        this.logger.log(`[War Cron] Sent reminder for battle ${battle.id}`);
      } catch (err) {
        this.logger.error(`[War Cron] Failed to send reminder for battle ${battle.id}: ${err}`);
      }
    }
  }

  /**
   * Runs every minute. Auto-cancels scheduled battles where only one player
   * joined within the 5-minute window after scheduled time.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBattleTimeouts() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000); // 5 min after scheduled time

    const expiredBattles = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.type = :type', { type: BattleType.SCHEDULED })
      .andWhere('b.status IN (:...statuses)', {
        statuses: [BattleStatus.PENDING, BattleStatus.WAITING],
      })
      .andWhere('b."scheduledAt" < :cutoff', { cutoff })
      .getMany();

    for (const battle of expiredBattles) {
      battle.status = BattleStatus.CANCELLED;
      await this.battleRepo.save(battle);

      // Notify both players
      this.gateway.notifyChallengeRejected(battle.player1Id, { battleId: battle.id, reason: 'expired' });
      if (battle.player2Id) {
        this.gateway.notifyChallengeRejected(battle.player2Id, { battleId: battle.id, reason: 'expired' });
      }

      this.logger.log(`[War Cron] Auto-cancelled expired scheduled battle ${battle.id}`);
    }
  }

  /**
   * Runs every minute. Auto-cancels quick-match/challenge requests that sat
   * unanswered past their expiresAt — otherwise both players stay stuck in
   * "busy" status forever (findMatch/getQuickMatchCandidates exclude anyone
   * with a WAITING battle) even though nobody ever accepted or rejected it.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredChallenges() {
    const now = new Date();

    const expiredChallenges = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.type IN (:...types)', { types: [BattleType.QUICK_MATCH, BattleType.CHALLENGE] })
      .andWhere('b.status = :status', { status: BattleStatus.WAITING })
      .andWhere('b."expiresAt" IS NOT NULL')
      .andWhere('b."expiresAt" < :now', { now })
      .getMany();

    for (const battle of expiredChallenges) {
      battle.status = BattleStatus.CANCELLED;
      await this.battleRepo.save(battle);

      this.gateway.notifyChallengeRejected(battle.player1Id, { battleId: battle.id, reason: 'expired' });
      if (battle.player2Id) {
        this.gateway.notifyChallengeRejected(battle.player2Id, { battleId: battle.id, reason: 'expired' });
      }

      this.logger.log(`[War Cron] Auto-cancelled expired ${battle.type} challenge ${battle.id}`);
    }
  }

  // ─────────────────────────────────────────────────────
  // PUSH NOTIFICATIONS
  // ─────────────────────────────────────────────────────

  private async sendPushNotification(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    targetId: string,
    actorName: string,
    extra?: string,
  ) {
    try {
      await this.notificationsService.notify(
        recipientId,
        actorId,
        type,
        NotificationTargetType.WAR,
        targetId,
        actorName,
        extra,
        { battleId: targetId },
      );
    } catch (err) {
      this.logger.warn(`Failed to send push notification: ${err}`);
    }
  }

  private async getUserSummary(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePictureUrl: user.profilePictureUrl,
    };
  }

  /**
   * Build the stats payload that gets attached to challenge_sent socket events
   * so the recipient's client can display the challenger's record immediately.
   */
  private async getChallengerStats(userId: string) {
    const stats = await this.getOrCreateUserStats(userId);
    return {
      totalBattles: stats.totalBattles,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.totalBattles > 0 ? Math.round((stats.wins / stats.totalBattles) * 100) : 0,
      currentWinStreak: stats.currentWinStreak,
      bestWinStreak: stats.bestWinStreak,
    };
  }
}
