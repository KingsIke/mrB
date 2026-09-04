import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { CoinBattle, CoinBattleStatus, PLATFORM_FEE_PERCENT } from './entities/coin-battle.entity';
import { CoinBattleAnswer } from './entities/coin-battle-answer.entity';
import { Question, QuestionDifficulty } from '../department-war/entities/question.entity';
import { User } from '../users/entities/user.entity';
import { CoinsService } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { CoinBattleGateway } from './coin-battle.gateway';
import { ChallengeDto, SubmitCoinBattleAnswerDto } from './dto/coin-battle.dto';

@Injectable()
export class CoinBattleService {
  private readonly logger = new Logger(CoinBattleService.name);

  // In-memory matchmaking queue: stake → userId[]
  // In production, use Redis for this
  private matchmakingQueues = new Map<number, Set<string>>();

  // How long a user can stay queued before auto-refund (3 minutes)
  private readonly QUEUE_TIMEOUT_MS = 3 * 60 * 1000;
  // How long a battle can stay MATCHED/COUNTDOWN before auto-refund (30 seconds)
  private readonly MATCH_TIMEOUT_MS = 30 * 1000;
  // How long a pending challenge can stay WAITING before auto-refund (30 seconds)
  private readonly CHALLENGE_TIMEOUT_MS = 30 * 1000;

  constructor(
    @InjectRepository(CoinBattle) private battleRepo: Repository<CoinBattle>,
    @InjectRepository(CoinBattleAnswer) private answerRepo: Repository<CoinBattleAnswer>,
    @InjectRepository(Question) private questionRepo: Repository<Question>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private coinsService: CoinsService,
    private gateway: CoinBattleGateway,
  ) {
    // Wire up disconnect handler — refund if user drops during pre-battle
    this.gateway.setOnDisconnectCallback((userId) => this.handleDisconnect(userId));
  }

  // ─────────────────────────────────────────────
  // QUESTION TIMERS (server-side progression)
  // ─────────────────────────────────────────────

  /**
   * In-memory per-question timers so coin battles keep progressing even when a
   * player disconnects or never answers. The battle auto-records a no-answer
   * for anyone who missed the question, then advances / finishes — so escrowed
   * coins are never stuck in a battle that can no longer move forward.
   */
  private questionTimers = new Map<
    string,
    { timer: NodeJS.Timeout; questionIndex: number; startedAt: number }
  >();

  /**
   * Users currently locked into a battle (or a pending one): QUEUED (waiting
   * for a queue match), WAITING (challenge sent/received, coins escrowed),
   * MATCHED, COUNTDOWN or ACTIVE. These users can't be challenged or queue.
   */
  private async getBusyUserIds(): Promise<Set<string>> {
    const busyBattles = await this.battleRepo
      .createQueryBuilder('b')
      .select(['b.player1Id', 'b.player2Id'])
      .where('b.status IN (:...statuses)', {
        statuses: [
          CoinBattleStatus.WAITING,
          CoinBattleStatus.QUEUED,
          CoinBattleStatus.MATCHED,
          CoinBattleStatus.COUNTDOWN,
          CoinBattleStatus.ACTIVE,
        ],
      })
      .getMany();
    const busy = new Set<string>();
    busyBattles.forEach((b) => {
      busy.add(b.player1Id);
      if (b.player2Id) busy.add(b.player2Id);
    });
    return busy;
  }

  private clearQuestionTimer(battleId: string) {
    const existing = this.questionTimers.get(battleId);
    if (existing) {
      clearTimeout(existing.timer);
      this.questionTimers.delete(battleId);
    }
  }

  private startQuestionTimer(battle: CoinBattle) {
    this.clearQuestionTimer(battle.id);
    if (battle.status !== CoinBattleStatus.ACTIVE) return;

    const timeoutMs = (battle.timePerQuestion || 15) * 1000;
    const timer = setTimeout(() => {
      this.handleQuestionTimeout(battle.id).catch((err) => {
        this.logger.error(`handleQuestionTimeout failed for coin battle ${battle.id}: ${err}`);
      });
    }, timeoutMs);

    this.questionTimers.set(battle.id, {
      timer,
      questionIndex: battle.currentQuestionIndex,
      startedAt: Date.now(),
    });
    this.logger.log(`Started question timer for coin battle ${battle.id} (q${battle.currentQuestionIndex}, ${battle.timePerQuestion}s)`);
  }

  /**
   * Fired when a question's time runs out. Auto-records a no-answer (selected
   * option -1) for any player who didn't answer, then advances to the next
   * question (or finishes the battle) once both players are accounted for.
   */
  private async handleQuestionTimeout(battleId: string) {
    const timerState = this.questionTimers.get(battleId);
    if (!timerState) return;
    this.questionTimers.delete(battleId);

    const battle = await this.battleRepo.findOne({ where: { id: battleId } });
    if (!battle || battle.status !== CoinBattleStatus.ACTIVE) return;
    // Stale timer (question already advanced via submitAnswer) — ignore.
    if (timerState.questionIndex !== battle.currentQuestionIndex) return;

    const questionIndex = battle.currentQuestionIndex;
    const players = [battle.player1Id, battle.player2Id].filter(Boolean) as string[];

    const answers = await this.answerRepo.find({ where: { battleId, questionIndex } });
    const answeredUserIds = new Set(answers.map((a) => a.userId));

    for (const playerId of players) {
      if (answeredUserIds.has(playerId)) continue;
      await this.answerRepo.save(
        this.answerRepo.create({
          battleId,
          userId: playerId,
          questionIndex,
          selectedOption: -1, // no answer (timeout)
          isCorrect: false,
          timeTakenMs: (battle.timePerQuestion || 15) * 1000,
        }),
      );
    }

    const nowAnswers = await this.answerRepo.find({ where: { battleId, questionIndex } });
    const bothAnswered = nowAnswers.length >= 2;

    if (bothAnswered) {
      // Grace period: when a player was recorded as a no-answer, hold off on
      // advancing for ~2s so their real answer — submitted right as their
      // client timer ends, a moment behind the server clock due to network
      // latency — can upgrade the no-answer record instead of being rejected.
      const needsGrace = nowAnswers.some((a) => a.selectedOption === -1);

      const advance = async () => {
        const fresh = await this.battleRepo.findOne({ where: { id: battleId } });
        if (!fresh || fresh.status !== CoinBattleStatus.ACTIVE) return;
        // Stale — the battle already advanced (e.g. via a submitAnswer upgrade).
        if (fresh.currentQuestionIndex !== questionIndex) return;
        const nextIndex = questionIndex + 1;
        if (nextIndex >= fresh.totalQuestions) {
          await this.finishBattle(fresh);
        } else {
          fresh.currentQuestionIndex = nextIndex;
          await this.battleRepo.save(fresh);
          this.gateway.notifyQuestionStart(fresh.player1Id, fresh.player2Id!, {
            battleId: fresh.id,
            questionIndex: nextIndex,
            player1Score: fresh.player1Score,
            player2Score: fresh.player2Score,
          });
          this.startQuestionTimer(fresh);
        }
      };

      if (needsGrace) {
        setTimeout(() => {
          advance().catch((err) =>
            this.logger.error(`Grace advance failed for coin battle ${battleId}: ${err}`),
          );
        }, 2000);
      } else {
        await advance();
      }
    }
  }

  // ─────────────────────────────────────────────
  // MATCHMAKING QUEUE
  // ─────────────────────────────────────────────

  async joinQueue(userId: string, stake: number) {
    // Check if user already in a battle
    const activeBattle = await this.battleRepo.findOne({
      where: [
        { player1Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
        { player2Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
      ],
    });
    if (activeBattle) {
      throw new BadRequestException('You are already in a battle, queue, or have a pending challenge');
    }

    // Check user has enough coins
    const balance = await this.coinsService.getBalance(userId);
    if (Number(balance.balance) < stake) {
      throw new BadRequestException(`Insufficient coins. You need ${stake} coins but have ${balance.balance}`);
    }

    // Deduct coins (escrow)
    await this.coinsService.debitBalance(userId, stake, CoinTransactionType.BATTLE_ENTRY);

    // Create battle record
    const battle = this.battleRepo.create({
      status: CoinBattleStatus.QUEUED,
      stake,
      pot: stake, // will become stake*2 when player2 joins
      player1Id: userId,
      player1Escrowed: true,
      queuedAt: new Date(),
      totalQuestions: 10,
      timePerQuestion: 15,
    });
    const saved = await this.battleRepo.save(battle);

    // Clean up any stale queue entries for this user across all stakes
    for (const [s, queue] of this.matchmakingQueues.entries()) {
      if (queue.has(userId)) {
        queue.delete(userId);
        this.logger.log(`joinQueue: removed stale entry for ${userId} from stake ${s} queue`);
        if (queue.size === 0) this.matchmakingQueues.delete(s);
      }
    }

    // Add to in-memory queue
    if (!this.matchmakingQueues.has(stake)) {
      this.matchmakingQueues.set(stake, new Set());
    }
    this.matchmakingQueues.get(stake)!.add(userId);

    // Notify client
    this.gateway.notifyQueueJoined(userId, {
      battleId: saved.id,
      stake,
      status: 'queued',
    });

    // Try to find a match
    await this.tryMatch(stake);

    return {
      battleId: saved.id,
      stake,
      status: 'queued',
    };
  }

  async leaveQueue(userId: string) {
    // Find the user's queued battle
    const battle = await this.battleRepo.findOne({
      where: { player1Id: userId, status: CoinBattleStatus.QUEUED },
    });

    if (!battle) {
      throw new BadRequestException('You are not in any queue');
    }

    // Refund escrowed coins
    await this.coinsService.creditBalance(
      userId,
      battle.stake,
      CoinTransactionType.BATTLE_REFUND,
      battle.id,
    );

    // Update battle status
    battle.status = CoinBattleStatus.CANCELLED;
    await this.battleRepo.save(battle);

    // Remove from queue
    const queue = this.matchmakingQueues.get(battle.stake);
    if (queue) {
      queue.delete(userId);
      if (queue.size === 0) {
        this.matchmakingQueues.delete(battle.stake);
      }
    }

    this.gateway.notifyQueueLeft(userId, {
      battleId: battle.id,
      status: 'cancelled',
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────
  // CHALLENGES (pick an online opponent directly)
  // ─────────────────────────────────────────────

  /**
   * Online users who can be challenged for a given stake: active, currently
   * online, not already in a battle/queue/challenge, and able to afford the
   * stake. Returns each user's coin balance so the picker can show it.
   */
  async getActiveUsers(userId: string, stake: number) {
    const busyUserIds = await this.getBusyUserIds();

    const candidates = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id != :userId', { userId })
      .andWhere('u.status = :status', { status: 'active' })
      .getMany();

    const results = [];
    for (const c of candidates) {
      if (busyUserIds.has(c.id)) continue;
      if (!this.gateway.isUserOnline(c.id)) continue;
      const balance = await this.coinsService.getBalance(c.id);
      if (Number(balance.balance) < stake) continue;
      results.push({
        id: c.id,
        username: c.username,
        firstName: c.firstName,
        lastName: c.lastName,
        profilePictureUrl: c.profilePictureUrl,
        balance: Number(balance.balance),
      });
    }
    return results;
  }

  /** Send a coin battle challenge to a specific opponent for a stake. */
  async challengeUser(userId: string, dto: ChallengeDto) {
    if (dto.opponentId === userId) {
      throw new BadRequestException('You cannot challenge yourself');
    }

    const busyUserIds = await this.getBusyUserIds();
    if (busyUserIds.has(userId)) {
      throw new ConflictException('You already have a battle, queue, or pending challenge');
    }
    if (busyUserIds.has(dto.opponentId)) {
      throw new ConflictException('That user is already in a battle or has a pending challenge. Pick someone else.');
    }
    if (!this.gateway.isUserOnline(dto.opponentId)) {
      throw new BadRequestException('That user is no longer online');
    }

    const opponent = await this.userRepo.findOne({ where: { id: dto.opponentId } });
    if (!opponent) {
      throw new NotFoundException('Opponent not found');
    }

    // No existing pending/battle between the pair (either direction)
    const existing = await this.battleRepo.findOne({
      where: [
        { player1Id: userId, player2Id: dto.opponentId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
        { player1Id: dto.opponentId, player2Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
      ],
    });
    if (existing) {
      throw new ConflictException('You already have a pending challenge or battle with this user');
    }

    // Escrow the challenger's coins up front
    const balance = await this.coinsService.getBalance(userId);
    if (Number(balance.balance) < dto.stake) {
      throw new BadRequestException(`Insufficient coins. You need ${dto.stake} coins but have ${balance.balance}`);
    }
    await this.coinsService.debitBalance(userId, dto.stake, CoinTransactionType.BATTLE_ENTRY);

    const pot = dto.stake * 2;
    const platformFee = Math.floor((pot * PLATFORM_FEE_PERCENT) / 100);
    const battle = this.battleRepo.create({
      status: CoinBattleStatus.WAITING,
      stake: dto.stake,
      pot,
      platformFee,
      winnerPrize: pot - platformFee,
      player1Id: userId,
      player1Escrowed: true,
      queuedAt: new Date(),
      totalQuestions: 10,
      timePerQuestion: 15,
    });
    const saved = await this.battleRepo.save(battle);

    // Notify the opponent via socket (with challenger summary + stake info)
    const challengerSummary = await this.getUserSummary(userId);
    this.gateway.notifyChallengeSent(opponent.id, {
      battleId: saved.id,
      stake: saved.stake,
      pot: saved.pot,
      winnerPrize: saved.winnerPrize,
      platformFee: saved.platformFee,
      challenger: challengerSummary,
      expiresAt: new Date(saved.queuedAt!.getTime() + this.CHALLENGE_TIMEOUT_MS),
    });

    return {
      battleId: saved.id,
      opponent: await this.getUserSummary(opponent.id),
      stake: saved.stake,
      pot: saved.pot,
      winnerPrize: saved.winnerPrize,
      platformFee: saved.platformFee,
      status: 'waiting',
    };
  }

  /** The challenged user accepts — escrow their coins and start the battle. */
  async acceptChallenge(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOne({ where: { id: battleId } });
    if (!battle) throw new NotFoundException('Battle not found');
    if (battle.player2Id !== userId) {
      throw new BadRequestException('This challenge is not for you');
    }
    if (battle.status !== CoinBattleStatus.WAITING) {
      throw new BadRequestException('This challenge is no longer waiting for acceptance');
    }
    if (battle.queuedAt && Date.now() - battle.queuedAt.getTime() > this.CHALLENGE_TIMEOUT_MS) {
      throw new BadRequestException('This challenge has expired');
    }

    // Acceptor must not be busy (e.g. joined the queue after being challenged)
    const busyUserIds = await this.getBusyUserIds();
    if (busyUserIds.has(userId)) {
      throw new ConflictException('You are already in a battle, queue, or have a pending challenge');
    }

    // Escrow the acceptor's coins
    const balance = await this.coinsService.getBalance(userId);
    if (Number(balance.balance) < battle.stake) {
      throw new BadRequestException(`Insufficient coins. You need ${battle.stake} coins but have ${balance.balance}`);
    }
    await this.coinsService.debitBalance(userId, battle.stake, CoinTransactionType.BATTLE_ENTRY);

    battle.player2Id = userId;
    battle.player2Escrowed = true;
    battle.status = CoinBattleStatus.MATCHED;
    battle.startedAt = new Date();
    await this.battleRepo.save(battle);

    // Select + store questions for the battle
    const questions = await this.selectQuestions(battle.totalQuestions, battle.player1Id, userId);
    battle.selectedQuestionIds = questions.map((q) => q.id);
    await this.battleRepo.save(battle);

    // Let the challenger know immediately so they can head to the arena
    this.gateway.notifyChallengeAccepted(battle.player1Id, {
      battleId: battle.id,
      stake: battle.stake,
      pot: battle.pot,
      winnerPrize: battle.winnerPrize,
      platformFee: battle.platformFee,
      opponent: await this.getUserSummary(userId),
    });

    // Delay battle_start by 1s so the challenger's client has time to
    // navigate to the arena and register its socket listeners first.
    setTimeout(() => {
      this.startBattle(battle.id).catch((err) => {
        this.logger.error(`acceptChallenge: startBattle failed for ${battle.id}: ${err}`);
      });
    }, 1000);

    const questionPayloads = questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
    }));
    return {
      battleId: battle.id,
      status: 'countdown',
      questions: questionPayloads,
      totalQuestions: battle.totalQuestions,
      timePerQuestion: battle.timePerQuestion,
      stake: battle.stake,
      pot: battle.pot,
      winnerPrize: battle.winnerPrize,
      platformFee: battle.platformFee,
    };
  }

  /** The challenged user declines — refund the challenger. */
  async rejectChallenge(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOne({ where: { id: battleId } });
    if (!battle) throw new NotFoundException('Battle not found');
    if (battle.player2Id !== userId) {
      throw new BadRequestException('This challenge is not for you');
    }
    if (battle.status !== CoinBattleStatus.WAITING) {
      throw new BadRequestException('This challenge is no longer waiting for acceptance');
    }
    await this.cancelWaitingChallenge(battle, 'rejected');
    return { success: true };
  }

  /** The challenger withdraws their request — refund their coins. */
  async cancelChallenge(userId: string, battleId: string) {
    const battle = await this.battleRepo.findOne({ where: { id: battleId } });
    if (!battle) throw new NotFoundException('Battle not found');
    if (battle.player1Id !== userId) {
      throw new BadRequestException('Only the challenger can cancel this request');
    }
    if (battle.status !== CoinBattleStatus.WAITING) {
      throw new BadRequestException('This challenge is no longer waiting for acceptance');
    }
    await this.cancelWaitingChallenge(battle, 'cancelled');
    return { success: true };
  }

  /** Incoming WAITING challenges where the caller is the challenged user. */
  async getPendingChallenges(userId: string) {
    const battles = await this.battleRepo.find({
      where: { player2Id: userId, status: CoinBattleStatus.WAITING },
      relations: ['player1'],
      order: { createdAt: 'DESC' },
    });
    return battles
      .filter((b) => !b.queuedAt || Date.now() - b.queuedAt.getTime() <= this.CHALLENGE_TIMEOUT_MS)
      .map((b) => ({
        id: b.id,
        stake: b.stake,
        pot: b.pot,
        winnerPrize: b.winnerPrize,
        platformFee: b.platformFee,
        challenger: b.player1
          ? {
              id: b.player1.id,
              username: b.player1.username,
              firstName: b.player1.firstName,
              lastName: b.player1.lastName,
              profilePictureUrl: b.player1.profilePictureUrl,
            }
          : null,
        expiresAt: b.queuedAt
          ? new Date(b.queuedAt.getTime() + this.CHALLENGE_TIMEOUT_MS)
          : null,
      }));
  }

  /**
   * Cancel a WAITING challenge, refund the challenger's escrow, and notify
   * both players over the socket.
   */
  private async cancelWaitingChallenge(
    battle: CoinBattle,
    reason: 'rejected' | 'cancelled' | 'expired',
  ) {
    battle.status = CoinBattleStatus.CANCELLED;
    battle.finishedAt = new Date();
    await this.battleRepo.save(battle);

    if (battle.player1Escrowed) {
      await this.refundPlayer(battle.player1Id, battle.stake, `${reason}_${battle.id}`);
    }
    this.gateway.notifyChallengeRejected(battle.player1Id, {
      battleId: battle.id,
      reason,
    });
    if (battle.player2Id && reason === 'cancelled') {
      this.gateway.notifyChallengeRejected(battle.player2Id, {
        battleId: battle.id,
        reason,
      });
    }
  }

  private async tryMatch(stake: number) {
    const queue = this.matchmakingQueues.get(stake);
    if (!queue || queue.size < 2) return;

    // Filter to eligible players: online + not in an active battle
    const allUserIds = Array.from(queue);
    const eligibleUserIds: string[] = [];

    for (const userId of allUserIds) {
      // Must be online (socket connected)
      if (!this.gateway.isUserOnline(userId)) {
        this.logger.log(`tryMatch: skipping ${userId} — not online`);
        continue;
      }

      // Must not be in a battle or pending challenge (WAITING, MATCHED, COUNTDOWN, ACTIVE)
      const inBattle = await this.battleRepo.findOne({
        where: [
          { player1Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
          { player2Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
        ],
      });
      if (inBattle) {
        this.logger.log(`tryMatch: skipping ${userId} — already in battle ${inBattle.id}`);
        // Remove stale entry from queue
        queue.delete(userId);
        continue;
      }

      eligibleUserIds.push(userId);
    }

    // Clean up empty queue
    if (queue.size === 0) {
      this.matchmakingQueues.delete(stake);
    }

    if (eligibleUserIds.length < 2) {
      this.logger.log(`tryMatch: only ${eligibleUserIds.length} eligible players for stake ${stake}, need 2`);
      return;
    }

    // Randomly pick 2 players from eligible pool
    const shuffled = eligibleUserIds.sort(() => Math.random() - 0.5);
    const player1Id = shuffled[0];
    const player2Id = shuffled[1];

    // Remove both from queue
    queue.delete(player1Id);
    queue.delete(player2Id);
    if (queue.size === 0) {
      this.matchmakingQueues.delete(stake);
    }

    // Update player1's battle
    const battle = await this.battleRepo.findOne({
      where: { player1Id, status: CoinBattleStatus.QUEUED },
    });
    if (!battle) {
      this.logger.warn(`tryMatch: battle not found for player1 ${player1Id}`);
      await this.refundPlayer(player1Id, stake, 'battle_not_found');
      await this.refundPlayer(player2Id, stake, 'battle_not_found');
      return;
    }

    // Check player2 balance (they might have spent coins while queued)
    const p2Balance = await this.coinsService.getBalance(player2Id);
    if (Number(p2Balance.balance) < stake) {
      this.logger.warn(`tryMatch: player2 ${player2Id} has insufficient coins (${p2Balance.balance} < ${stake})`);
      await this.refundPlayer(player1Id, stake, 'opponent_insufficient_funds');
      battle.status = CoinBattleStatus.CANCELLED;
      await this.battleRepo.save(battle);
      this.gateway.notifyQueueLeft(player1Id, { battleId: battle.id, status: 'cancelled', reason: 'opponent_insufficient_funds' });
      return;
    }

    // Deduct player2's coins (escrow)
    await this.coinsService.debitBalance(player2Id, stake, CoinTransactionType.BATTLE_ENTRY);

    // Update battle
    battle.player2Id = player2Id;
    battle.player2Escrowed = true;
    battle.pot = stake * 2;
    battle.platformFee = Math.floor((stake * 2 * PLATFORM_FEE_PERCENT) / 100);
    battle.winnerPrize = stake * 2 - battle.platformFee;
    battle.status = CoinBattleStatus.MATCHED;
    await this.battleRepo.save(battle);

    // Select questions
    const questions = await this.selectQuestions(battle.totalQuestions, player1Id, player2Id);
    battle.selectedQuestionIds = questions.map((q) => q.id);
    await this.battleRepo.save(battle);

    const questionPayloads = questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
    }));

    // Notify both players of match
    const [p1Summary, p2Summary] = await Promise.all([
      this.getUserSummary(player1Id),
      this.getUserSummary(player2Id),
    ]);

    this.gateway.notifyMatchFound(player1Id, player2Id, {
      battleId: battle.id,
      stake,
      pot: battle.pot,
      winnerPrize: battle.winnerPrize,
      platformFee: battle.platformFee,
      player1Id,
      player2Id,
      player1: p1Summary,
      player2: p2Summary,
    });

    // Start battle after short delay
    setTimeout(() => {
      this.startBattle(battle.id);
    }, 1500);
  }

  private async refundPlayer(userId: string, amount: number, reason: string) {
    try {
      await this.coinsService.creditBalance(
        userId,
        amount,
        CoinTransactionType.BATTLE_REFUND,
        reason,
      );
    } catch (err) {
      this.logger.error(`refundPlayer: failed to refund ${userId}: ${err}`);
    }
  }

  // ─────────────────────────────────────────────
  // DISCONNECT HANDLER
  // ─────────────────────────────────────────────

  private async handleDisconnect(userId: string) {
    this.logger.log(`handleDisconnect: processing refund for user ${userId}`);

    const activeBattle = await this.battleRepo.findOne({
      where: [
        { player1Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN]) },
        { player2Id: userId, status: In([CoinBattleStatus.WAITING, CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN]) },
      ],
    });

    if (!activeBattle) return;

    // Pending challenge: cancel it and refund the challenger (either player
    // disconnecting while waiting aborts the request).
    if (activeBattle.status === CoinBattleStatus.WAITING) {
      await this.cancelWaitingChallenge(activeBattle, 'cancelled');
      return;
    }

    // Remove from in-memory queue
    const queue = this.matchmakingQueues.get(activeBattle.stake);
    if (queue) {
      queue.delete(userId);
      if (queue.size === 0) this.matchmakingQueues.delete(activeBattle.stake);
    }

    await this.cancelAndRefund(activeBattle, `disconnect_${userId}`);
  }

  // ─────────────────────────────────────────────
  // CRON: AUTO-REFUND STALE BATTLES
  // ─────────────────────────────────────────────

  /**
   * Runs every minute. Refunds users in 3 scenarios:
   * 1. QUEUED too long (>3 min) — no match found
   * 2. MATCHED too long (>30s) — opponent didn't start battle
   * 3. COUNTDOWN too long (>10s) — battle never became ACTIVE
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleCoinBattles() {
    const now = Date.now();

    // 1. Refund QUEUED battles older than QUEUE_TIMEOUT_MS
    const staleQueued = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: CoinBattleStatus.QUEUED })
      .andWhere('b."queuedAt" IS NOT NULL')
      .andWhere('b."queuedAt" < :cutoff', {
        cutoff: new Date(now - this.QUEUE_TIMEOUT_MS),
      })
      .getMany();

    for (const battle of staleQueued) {
      this.logger.log(`[CoinBattle Cron] Refunding stale QUEUED battle ${battle.id} for user ${battle.player1Id}`);
      await this.cancelAndRefund(battle, 'queue_timeout');
    }

    // 2. Refund MATCHED battles older than MATCH_TIMEOUT_MS (opponent never started)
    const staleMatched = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: CoinBattleStatus.MATCHED })
      .andWhere('b."startedAt" < :cutoff', {
        cutoff: new Date(now - this.MATCH_TIMEOUT_MS),
      })
      .getMany();

    for (const battle of staleMatched) {
      this.logger.log(`[CoinBattle Cron] Refunding stale MATCHED battle ${battle.id}`);
      await this.cancelAndRefund(battle, 'match_timeout');
    }

    // 3. Refund COUNTDOWN battles older than 10s (never became ACTIVE)
    const staleCountdown = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: CoinBattleStatus.COUNTDOWN })
      .andWhere('b."startedAt" < :cutoff', {
        cutoff: new Date(now - 10 * 1000),
      })
      .getMany();

    for (const battle of staleCountdown) {
      this.logger.log(`[CoinBattle Cron] Refunding stale COUNTDOWN battle ${battle.id}`);
      await this.cancelAndRefund(battle, 'countdown_timeout');
    }

    // 1b. Refund WAITING challenges older than CHALLENGE_TIMEOUT_MS (no response)
    const staleWaiting = await this.battleRepo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: CoinBattleStatus.WAITING })
      .andWhere('b."queuedAt" IS NOT NULL')
      .andWhere('b."queuedAt" < :cutoff', {
        cutoff: new Date(now - this.CHALLENGE_TIMEOUT_MS),
      })
      .getMany();

    for (const battle of staleWaiting) {
      this.logger.log(`[CoinBattle Cron] Expiring stale WAITING challenge ${battle.id}`);
      await this.cancelWaitingChallenge(battle, 'expired');
    }

    // 4. Clean up in-memory queue entries for users who are no longer online
    for (const [stake, queue] of this.matchmakingQueues.entries()) {
      const toRemove: string[] = [];
      for (const userId of queue) {
        if (!this.gateway.isUserOnline(userId)) {
          toRemove.push(userId);
        }
      }
      for (const userId of toRemove) {
        queue.delete(userId);
        this.logger.log(`[CoinBattle Cron] Removed offline user ${userId} from stake ${stake} queue`);
        // Refund their queued battle if it exists
        const staleBattle = await this.battleRepo.findOne({
          where: { player1Id: userId, status: CoinBattleStatus.QUEUED },
        });
        if (staleBattle) {
          await this.cancelAndRefund(staleBattle, 'offline_cleanup');
        }
      }
      if (queue.size === 0) this.matchmakingQueues.delete(stake);
    }
  }

  /**
   * Cancel a battle and refund both escrowed players.
   */
  private async cancelAndRefund(battle: CoinBattle, reason: string) {
    battle.status = CoinBattleStatus.CANCELLED;
    battle.finishedAt = new Date();
    await this.battleRepo.save(battle);

    // Refund player1 (always escrowed)
    if (battle.player1Escrowed) {
      await this.refundPlayer(battle.player1Id, battle.stake, `${reason}_${battle.id}`);
      this.gateway.notifyOpponentDisconnected(battle.player1Id, {
        battleId: battle.id,
        reason,
      });
    }

    // Refund player2 (if matched and escrowed)
    if (battle.player2Id && battle.player2Escrowed) {
      await this.refundPlayer(battle.player2Id, battle.stake, `${reason}_${battle.id}`);
      this.gateway.notifyOpponentDisconnected(battle.player2Id, {
        battleId: battle.id,
        reason,
      });
    }

    // Remove from in-memory queue if still there
    const queue = this.matchmakingQueues.get(battle.stake);
    if (queue) {
      queue.delete(battle.player1Id);
      if (queue.size === 0) this.matchmakingQueues.delete(battle.stake);
    }
  }

  // ─────────────────────────────────────────────
  // BATTLE FLOW
  // ─────────────────────────────────────────────

  private async startBattle(battleId: string) {
    const battle = await this.battleRepo.findOne({ where: { id: battleId } });
    if (!battle || battle.status !== CoinBattleStatus.MATCHED) {
      // Battle was cancelled/refunded before we could start — nothing to do
      if (battle && battle.status === CoinBattleStatus.CANCELLED) {
        this.logger.log(`startBattle: battle ${battleId} was already cancelled, skipping`);
      }
      return;
    }

    battle.status = CoinBattleStatus.COUNTDOWN;
    battle.startedAt = new Date();
    await this.battleRepo.save(battle);

    // Send battle start with questions
    const questions = battle.selectedQuestionIds
      ? await this.questionRepo.findByIds(battle.selectedQuestionIds)
      : [];

    const questionPayloads = questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options,
    }));

    this.gateway.notifyBattleStart(battle.player1Id, battle.player2Id!, {
      battleId: battle.id,
      questions: questionPayloads,
      totalQuestions: battle.totalQuestions,
      timePerQuestion: battle.timePerQuestion,
      stake: battle.stake,
      pot: battle.pot,
      winnerPrize: battle.winnerPrize,
    });

    // After countdown, set to ACTIVE and send first question
    setTimeout(async () => {
      const b = await this.battleRepo.findOne({ where: { id: battleId } });
      if (b && b.status === CoinBattleStatus.COUNTDOWN) {
        b.status = CoinBattleStatus.ACTIVE;
        b.currentQuestionIndex = 0;
        await this.battleRepo.save(b);

        this.gateway.notifyQuestionStart(b.player1Id, b.player2Id!, {
          battleId: b.id,
          questionIndex: 0,
          player1Score: 0,
          player2Score: 0,
        });
        // Server-side timer so the battle keeps moving even if a player
        // disconnects or never answers.
        this.startQuestionTimer(b);
      }
    }, 3500);
  }

  // ─────────────────────────────────────────────
  // ANSWER SUBMISSION
  // ─────────────────────────────────────────────

  async submitAnswer(userId: string, dto: SubmitCoinBattleAnswerDto) {
    const battle = await this.battleRepo.findOne({ where: { id: dto.battleId } });
    if (!battle) throw new NotFoundException('Battle not found');
    if (battle.status !== CoinBattleStatus.ACTIVE && battle.status !== CoinBattleStatus.COUNTDOWN) {
      throw new BadRequestException('Battle is not active');
    }
    if (battle.player1Id !== userId && battle.player2Id !== userId) {
      throw new BadRequestException('You are not in this battle');
    }

    // Check if already answered. A no-answer record (selectedOption === -1)
    // created by the question-timeout can be upgraded to a real answer — but
    // only while the battle is still on this question.
    const existing = await this.answerRepo.findOne({
      where: { battleId: dto.battleId, userId, questionIndex: dto.questionIndex },
    });
    if (existing && existing.selectedOption !== -1) {
      throw new BadRequestException('Already answered this question');
    }
    if (existing && battle.currentQuestionIndex !== dto.questionIndex) {
      throw new BadRequestException('Already answered this question');
    }

    // Get correct answer
    let question: Question | null = null;
    if (battle.selectedQuestionIds && battle.selectedQuestionIds[dto.questionIndex]) {
      question = await this.questionRepo.findOne({
        where: { id: battle.selectedQuestionIds[dto.questionIndex] },
      });
    }
    if (!question) {
      throw new BadRequestException('Invalid question index');
    }

    const isCorrect = dto.selectedOption === question.correctIndex;
    const points = isCorrect ? this.calculatePoints(dto.timeTakenMs || 15000, question.difficulty) : 0;

    // Save answer (upgrades a server-recorded no-answer, if present)
    const answer = existing
      ? Object.assign(existing, {
          selectedOption: dto.selectedOption,
          isCorrect,
          timeTakenMs: dto.timeTakenMs || null,
        })
      : this.answerRepo.create({
          battleId: dto.battleId,
          userId,
          questionIndex: dto.questionIndex,
          selectedOption: dto.selectedOption,
          isCorrect,
          pointsEarned: points,
          timeTakenMs: dto.timeTakenMs || null,
        });
    await this.answerRepo.save(answer);

    // Update scores
    if (userId === battle.player1Id) {
      battle.player1Score += points;
    } else {
      battle.player2Score += points;
    }

    // Check if both answered
    const answersForQuestion = await this.answerRepo.find({
      where: { battleId: dto.battleId, questionIndex: dto.questionIndex },
    });
    const bothAnswered = answersForQuestion.length === 2;

    const player1Answered = answersForQuestion.some((a) => a.userId === battle.player1Id);
    const player2Answered = battle.player2Id
      ? answersForQuestion.some((a) => a.userId === battle.player2Id)
      : false;

    // Notify score update
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

    if (bothAnswered) {
      // If a player is still recorded as a no-answer, the question-timeout
      // grace timer is running — don't advance yet, or the other player's
      // just-in-time answer would be rejected as "already advanced". The
      // grace timer advances the battle once the window closes.
      const pendingNoAnswer = answersForQuestion.some((a) => a.selectedOption === -1);
      if (!pendingNoAnswer) {
        const nextIndex = dto.questionIndex + 1;
        if (nextIndex >= battle.totalQuestions) {
          await this.finishBattle(battle);
        } else {
          battle.currentQuestionIndex = nextIndex;
          await this.battleRepo.save(battle);

          this.gateway.notifyQuestionStart(battle.player1Id, battle.player2Id!, {
            battleId: battle.id,
            questionIndex: nextIndex,
            player1Score: battle.player1Score,
            player2Score: battle.player2Score,
          });
          // Restart the server-side question timer for the next question.
          this.startQuestionTimer(battle);
        }
      } else {
        await this.battleRepo.save(battle);
      }
    } else {
      await this.battleRepo.save(battle);
    }

    return {
      isCorrect,
      correctOption: isCorrect ? undefined : question.correctIndex,
      points,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      bothAnswered,
    };
  }

  // ─────────────────────────────────────────────
  // SETTLEMENT
  // ─────────────────────────────────────────────

  private async finishBattle(battle: CoinBattle) {
    this.logger.log(`finishBattle: starting for coin battle ${battle.id}`);
    this.clearQuestionTimer(battle.id);

    // Idempotency guard: finishBattle can be reached from both submitAnswer and
    // the question-timeout, so reload and bail out if it already finished.
    const fresh = await this.battleRepo.findOne({ where: { id: battle.id } });
    if (!fresh || fresh.status === CoinBattleStatus.FINISHED) {
      this.logger.log(`finishBattle: coin battle ${battle.id} already finished — skipping`);
      return;
    }
    battle = fresh;

    battle.status = CoinBattleStatus.FINISHED;
    battle.finishedAt = new Date();

    if (battle.player1Score > battle.player2Score) {
      battle.winnerId = battle.player1Id;
    } else if (battle.player2Score > battle.player1Score) {
      battle.winnerId = battle.player2Id;
    }
    // If tied, winnerId stays null (draw — both get refunded)

    await this.battleRepo.save(battle);

    // Settle coins
    if (battle.winnerId) {
      // Winner gets the pot minus platform fee
      await this.coinsService.creditBalance(
        battle.winnerId,
        battle.winnerPrize,
        CoinTransactionType.BATTLE_WIN,
        battle.id,
      );
      this.logger.log(`finishBattle: credited ${battle.winnerPrize} coins to winner ${battle.winnerId}`);
    } else {
      // Draw — refund both players
      await this.refundPlayer(battle.player1Id, battle.stake, `draw_${battle.id}`);
      if (battle.player2Id) {
        await this.refundPlayer(battle.player2Id, battle.stake, `draw_${battle.id}`);
      }
      this.logger.log(`finishBattle: draw — refunded both players for battle ${battle.id}`);
    }

    // Notify both players
    this.gateway.notifyBattleEnded(battle.player1Id, battle.player2Id!, {
      battleId: battle.id,
      winnerId: battle.winnerId,
      player1Score: battle.player1Score,
      player2Score: battle.player2Score,
      stake: battle.stake,
      pot: battle.pot,
      winnerPrize: battle.winnerPrize,
      platformFee: battle.platformFee,
      isDraw: battle.winnerId === null,
    });

    this.logger.log(`finishBattle: completed for coin battle ${battle.id}`);
  }

  // ─────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────

  async getActiveBattle(userId: string) {
    return this.battleRepo.findOne({
      where: [
        { player1Id: userId, status: In([CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
        { player2Id: userId, status: In([CoinBattleStatus.QUEUED, CoinBattleStatus.MATCHED, CoinBattleStatus.COUNTDOWN, CoinBattleStatus.ACTIVE]) },
      ],
      relations: ['player1', 'player2'],
    });
  }

  async getBattleHistory(userId: string, limit = 20, cursor?: string) {
    const qb = this.battleRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.player1', 'p1')
      .leftJoinAndSelect('b.player2', 'p2')
      .leftJoinAndSelect('b.winner', 'w')
      .where('(b.player1Id = :userId OR b.player2Id = :userId)', { userId })
      .andWhere('b.status = :status', { status: CoinBattleStatus.FINISHED })
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

  async getQueueStats(stake: number) {
    const queue = this.matchmakingQueues.get(stake);
    return {
      stake,
      playersInQueue: queue ? queue.size : 0,
    };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private async selectQuestions(count: number, player1Id: string, player2Id: string): Promise<Question[]> {
    const [p1, p2] = await Promise.all([
      this.userRepo.findOne({ where: { id: player1Id } }),
      this.userRepo.findOne({ where: { id: player2Id } }),
    ]);

    const deptIds = [p1?.departmentId, p2?.departmentId].filter(Boolean) as string[];
    const uniqueDeptIds = [...new Set(deptIds)];

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
    const base = difficulty === QuestionDifficulty.HARD ? 15 : difficulty === QuestionDifficulty.MEDIUM ? 10 : 5;
    const maxTimeMs = 15000;
    const speedBonus = Math.max(0, Math.round(5 * (1 - timeTakenMs / maxTimeMs)));
    return base + speedBonus;
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
}
