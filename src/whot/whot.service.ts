import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  WhotTable,
  WhotTableStatus,
  WHOT_PLATFORM_FEE_PERCENT,
  WHOT_HAND_SIZE,
} from './entities/whot-table.entity';
import { WhotTablePlayer } from './entities/whot-table-player.entity';
import { CoinsService, notEnoughGameCoinsMessage, stakeableCoins } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { WhotGateway } from './whot.gateway';
import { User, UserStatus } from '../users/entities/user.entity';
import {
  buildStandardDeck,
  shuffleDeck,
  parseCard,
  isPickCard,
  pickAmount,
  isLegalPlay,
  WhotShape,
} from './whot-deck';

// Fixed system account for the "play vs computer" opponent — created lazily
// on first use, never a real student sign-up.
const WHOT_BOT_EMAIL = 'whot-bot@system.internal';

const ACTIVE_TABLE_STATUSES = [
  WhotTableStatus.WAITING,
  WhotTableStatus.QUEUED,
  WhotTableStatus.MATCHED,
  WhotTableStatus.COUNTDOWN,
  WhotTableStatus.ACTIVE,
];

@Injectable()
export class WhotService {
  private readonly logger = new Logger(WhotService.name);

  // How long a table can sit QUEUED without reaching minPlayers before it's
  // cancelled and everyone refunded.
  private readonly QUEUE_TIMEOUT_MS = 3 * 60 * 1000;
  // How long to wait for extra seats once minPlayers is reached before
  // auto-starting with whoever is present.
  private readonly AUTO_START_WAIT_MS = 20 * 1000;
  // How long a table can sit COUNTDOWN before we force it ACTIVE (covers a
  // server restart losing the in-process setTimeout).
  private readonly COUNTDOWN_TIMEOUT_MS = 15 * 1000;
  // How long an ACTIVE table can go without a move before it's treated as
  // abandoned (disconnect without reconnect) and refunded.
  private readonly STALE_ACTIVE_MS = 5 * 60 * 1000;
  // How long a disconnected player's own turn can sit before the stale-turn
  // sweep auto-draws on their behalf, so the table isn't stuck waiting on them.
  private readonly DISCONNECT_TURN_GRACE_MS = 45 * 1000;

  constructor(
    @InjectRepository(WhotTable) private tableRepo: Repository<WhotTable>,
    @InjectRepository(WhotTablePlayer) private playerRepo: Repository<WhotTablePlayer>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private coinsService: CoinsService,
    private gateway: WhotGateway,
    private dataSource: DataSource,
  ) {
    this.gateway.setOnDisconnectCallback((userId) => this.handleDisconnect(userId));
  }

  // ─────────────────────────────────────────────
  // QUEUE / MATCHMAKING (DB-table based — no in-memory queue needed since
  // matching is just "find an open table for this (stake, maxPlayers) pair")
  // ─────────────────────────────────────────────

  async createOrJoinTable(userId: string, stake: number, maxPlayers: number) {
    const existingSeat = await this.findActiveSeat(userId);
    if (existingSeat) {
      throw new BadRequestException('You are already at a table or in a queue');
    }

    const balance = await this.coinsService.getBalance(userId);
    if (stakeableCoins(balance) < stake) {
      throw new BadRequestException(notEnoughGameCoinsMessage(stake, stakeableCoins(balance)));
    }

    // Atomically find an open seat at an existing QUEUED table for this
    // (stake, maxPlayers) pair, or create a new table and take seat 0.
    const { table, seatIndex, isNewTable } = await this.dataSource.transaction(async (manager) => {
      const tableRepo = manager.getRepository(WhotTable);
      const playerRepo = manager.getRepository(WhotTablePlayer);

      const candidates = await tableRepo
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.status = :status', { status: WhotTableStatus.QUEUED })
        .andWhere('t.stake = :stake', { stake })
        .andWhere('t.maxPlayers = :maxPlayers', { maxPlayers })
        .orderBy('t.queuedAt', 'ASC')
        .getMany();

      for (const candidate of candidates) {
        const count = await playerRepo.count({ where: { tableId: candidate.id } });
        if (count < maxPlayers) {
          const seat = playerRepo.create({ tableId: candidate.id, userId, seatIndex: count });
          await playerRepo.save(seat);
          return { table: candidate, seatIndex: count, isNewTable: false };
        }
      }

      const created = tableRepo.create({
        status: WhotTableStatus.QUEUED,
        stake,
        maxPlayers,
        minPlayers: 2,
        queuedAt: new Date(),
      });
      const savedTable = await tableRepo.save(created);
      const seat = playerRepo.create({ tableId: savedTable.id, userId, seatIndex: 0 });
      await playerRepo.save(seat);
      return { table: savedTable, seatIndex: 0, isNewTable: true };
    });

    // Debit the stake now that a seat is claimed. debitBalance owns its own
    // transaction (see coins.service.ts), so this can't be composed into the
    // seat-claim transaction above — instead, treat the seat claim as
    // provisional and compensate (release it) if the debit fails, so a debit
    // never happens without a claimed seat and a claimed seat never survives
    // a failed debit.
    try {
      await this.coinsService.debitBalance(userId, stake, CoinTransactionType.WHOT_ENTRY, table.id);
    } catch (err) {
      await this.playerRepo.delete({ tableId: table.id, userId });
      if (isNewTable) {
        await this.tableRepo.delete({ id: table.id });
      }
      throw err;
    }

    await this.playerRepo.update({ tableId: table.id, userId }, { escrowed: true });
    const seatsFilled = await this.playerRepo.count({ where: { tableId: table.id } });
    table.pot = stake * seatsFilled;
    await this.tableRepo.save(table);

    const players = await this.findPlayersWithUser(table.id);

    this.gateway.notifyQueueJoined(userId, {
      tableId: table.id,
      stake,
      maxPlayers,
      seatIndex,
      status: table.status,
      seatsFilled,
    });
    this.gateway.notifyTableUpdate(table.id, this.publicTableSummary(table, players));

    if (seatsFilled === maxPlayers) {
      setTimeout(() => {
        this.startTable(table.id).catch((err) =>
          this.logger.error(`createOrJoinTable: startTable failed for ${table.id}: ${err}`),
        );
      }, 1200);
    }

    return { tableId: table.id, stake, maxPlayers, status: table.status, seatIndex, seatsFilled };
  }

  async leaveQueue(userId: string) {
    const seat = await this.findQueuedSeat(userId);
    if (!seat) {
      throw new BadRequestException('You are not in any queue');
    }
    const table = seat.table;

    if (seat.escrowed) {
      await this.refundPlayer(userId, table.stake, `leave_queue_${table.id}`);
    }
    await this.playerRepo.delete({ id: seat.id });

    const remaining = await this.playerRepo.count({ where: { tableId: table.id } });
    if (remaining === 0) {
      table.status = WhotTableStatus.CANCELLED;
      table.finishedAt = new Date();
      await this.tableRepo.save(table);
    } else {
      table.pot = table.stake * remaining;
      await this.tableRepo.save(table);
      const players = await this.findPlayersWithUser(table.id);
      this.gateway.notifyTableUpdate(table.id, this.publicTableSummary(table, players));
    }

    this.gateway.notifyQueueLeft(userId, { tableId: table.id, status: 'cancelled' });
    return { success: true };
  }

  // ─────────────────────────────────────────────
  // PLAY VS COMPUTER
  // ─────────────────────────────────────────────

  /**
   * Starts a 1v1 table against the "Computer" bot user, skipping matchmaking
   * entirely. The bot never actually holds or pays coins — only the human's
   * stake is debited, and the pot is sized as if both sides staked, so a win
   * pays out the full (house-funded) prize same as a real 2-player table.
   */
  async startBotTable(userId: string, stake: number) {
    const existingSeat = await this.findActiveSeat(userId);
    if (existingSeat) {
      throw new BadRequestException('You are already at a table or in a queue');
    }

    const balance = await this.coinsService.getBalance(userId);
    if (stakeableCoins(balance) < stake) {
      throw new BadRequestException(notEnoughGameCoinsMessage(stake, stakeableCoins(balance)));
    }

    const bot = await this.getOrCreateBotUser();

    const table = await this.dataSource.transaction(async (manager) => {
      const tableRepo = manager.getRepository(WhotTable);
      const playerRepo = manager.getRepository(WhotTablePlayer);

      const created = tableRepo.create({
        status: WhotTableStatus.QUEUED,
        stake,
        maxPlayers: 2,
        minPlayers: 2,
        queuedAt: new Date(),
      });
      const savedTable = await tableRepo.save(created);
      await playerRepo.save(playerRepo.create({ tableId: savedTable.id, userId, seatIndex: 0 }));
      // The bot's "seat" never actually escrows real coins (see class doc above).
      await playerRepo.save(
        playerRepo.create({ tableId: savedTable.id, userId: bot.id, seatIndex: 1, escrowed: true }),
      );
      return savedTable;
    });

    try {
      await this.coinsService.debitBalance(userId, stake, CoinTransactionType.WHOT_ENTRY, table.id);
    } catch (err) {
      await this.playerRepo.delete({ tableId: table.id });
      await this.tableRepo.delete({ id: table.id });
      throw err;
    }

    await this.playerRepo.update({ tableId: table.id, userId }, { escrowed: true });
    table.pot = stake * 2;
    await this.tableRepo.save(table);

    // Deferred like createOrJoinTable's auto-start, so the client has time to
    // join the table's socket room before notifyTableStart fires.
    setTimeout(() => {
      this.startTable(table.id).catch((err) =>
        this.logger.error(`startBotTable: startTable failed for ${table.id}: ${err}`),
      );
    }, 1200);

    return { tableId: table.id, stake, maxPlayers: 2, status: table.status };
  }

  private async getOrCreateBotUser(): Promise<User> {
    let bot = await this.userRepo.findOne({ where: { email: WHOT_BOT_EMAIL } });
    if (!bot) {
      bot = await this.userRepo.save(
        this.userRepo.create({
          email: WHOT_BOT_EMAIL,
          username: 'Computer',
          firstName: 'Computer',
          isEmailVerified: true,
          isOnboardingComplete: true,
          status: UserStatus.ACTIVE,
          isBot: true,
        }),
      );
    }
    return bot;
  }

  // ─────────────────────────────────────────────
  // TABLE START
  // ─────────────────────────────────────────────

  private async startTable(tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table || table.status !== WhotTableStatus.QUEUED) return;

    const players = await this.findPlayersWithUser(tableId, { escrowed: true });
    if (players.length < 2) {
      // Not enough escrowed players yet — leave it queued for the cron to retry/expire.
      return;
    }

    let deck = shuffleDeck(buildStandardDeck());

    for (const player of players) {
      player.hand = deck.splice(0, WHOT_HAND_SIZE);
    }

    // Flip the first discard card — redraw (and reshuffle it back in) if it's a wild.
    let firstCard = deck.shift() as string;
    let guard = 0;
    while (parseCard(firstCard).isWild && guard < 20) {
      deck.push(firstCard);
      deck = shuffleDeck(deck);
      firstCard = deck.shift() as string;
      guard++;
    }

    table.deck = deck;
    table.discardPile = [firstCard];
    table.currentTurnPlayerId = players[0].userId;
    table.turnDirection = 1;
    table.pendingPickCount = 0;
    table.requestedShape = null;
    table.status = WhotTableStatus.COUNTDOWN;
    table.startedAt = new Date();
    table.pot = table.stake * players.length;
    table.platformFee = Math.floor((table.pot * WHOT_PLATFORM_FEE_PERCENT) / 100);
    table.winnerPrize = table.pot - table.platformFee;

    await this.tableRepo.save(table);
    await this.playerRepo.save(players);

    this.gateway.notifyTableStart(
      players.map((p) => ({ userId: p.userId, hand: p.hand })),
      {
        tableId: table.id,
        status: table.status,
        topCard: table.discardPile[table.discardPile.length - 1],
        deckCount: table.deck.length,
        stake: table.stake,
        pot: table.pot,
        winnerPrize: table.winnerPrize,
        platformFee: table.platformFee,
        currentTurnPlayerId: table.currentTurnPlayerId,
        turnDirection: table.turnDirection,
        seats: players.map((p) => this.publicPlayer(p)),
      },
    );

    setTimeout(() => {
      this.activateTable(table.id).catch((err) =>
        this.logger.error(`startTable: activateTable failed for ${table.id}: ${err}`),
      );
    }, 3000);
  }

  private async activateTable(tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table || table.status !== WhotTableStatus.COUNTDOWN) return;
    table.status = WhotTableStatus.ACTIVE;
    await this.tableRepo.save(table);
    this.gateway.notifyTurnChanged(table.id, {
      tableId: table.id,
      currentTurnPlayerId: table.currentTurnPlayerId,
      turnDirection: table.turnDirection,
      pendingPickCount: table.pendingPickCount,
      requestedShape: table.requestedShape,
    });
    this.maybeScheduleBotMove(table.id);
  }

  // ─────────────────────────────────────────────
  // GAMEPLAY
  // ─────────────────────────────────────────────

  async playCard(userId: string, tableId: string, card: string, calledShape?: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table not found');
    if (table.status !== WhotTableStatus.ACTIVE) {
      throw new BadRequestException('Table is not active');
    }
    if (table.currentTurnPlayerId !== userId) {
      throw new BadRequestException('It is not your turn');
    }

    const players = await this.findPlayersWithUser(table.id);
    const player = players.find((p) => p.userId === userId);
    if (!player) throw new BadRequestException('You are not seated at this table');

    const handIdx = player.hand.indexOf(card);
    if (handIdx === -1) throw new BadRequestException('You do not have that card');

    const topCard = table.discardPile[table.discardPile.length - 1];
    if (
      !isLegalPlay({
        card,
        topCard,
        requestedShape: table.requestedShape,
        pendingPickCount: table.pendingPickCount,
      })
    ) {
      throw new BadRequestException('That card cannot be played right now');
    }

    const parsed = parseCard(card);
    if (parsed.isWild && !calledShape) {
      throw new BadRequestException('You must call a shape when playing a Whot-20');
    }

    player.hand.splice(handIdx, 1);
    table.discardPile = [...table.discardPile, card];

    // An emptied hand ends the game immediately, regardless of the card's effect.
    if (player.hand.length === 0) {
      await this.playerRepo.save(player);
      await this.tableRepo.save(table);
      this.gateway.notifyCardPlayed(table.id, {
        tableId: table.id,
        userId,
        card,
        topCard: card,
        calledShape: null,
        currentTurnPlayerId: null,
        turnDirection: table.turnDirection,
        pendingPickCount: 0,
        requestedShape: null,
        winnerId: userId,
        deckCount: table.deck.length,
        seats: players.map((p) => this.publicPlayer(p)),
      });
      await this.finishTable(table.id, userId);
      return { success: true, won: true, tableId: table.id };
    }

    let steps = 1;
    table.requestedShape = null;

    if (parsed.isWild) {
      table.requestedShape = calledShape as string;
    } else if (parsed.number === 1) {
      steps = 0; // Hold On — same player goes again
    } else if (isPickCard(parsed.number)) {
      table.pendingPickCount += pickAmount(parsed.number);
    } else if (parsed.number === 8) {
      steps = 2; // Suspension — skip the next player
    } else if (parsed.number === 14) {
      // General Market — every OTHER player draws one card each. No reshuffle:
      // if the market runs dry partway through, whoever hasn't drawn yet just
      // gets fewer cards, and the shared exhaustion check below ends the game
      // right there. The player who played it always continues (goes again),
      // same as Hold On, regardless of table size.
      steps = 0;
      const others = players.filter((p) => p.userId !== userId);
      for (const other of others) {
        if (table.deck.length === 0) break;
        other.hand.push(table.deck.shift() as string);
      }
      if (others.length > 0) {
        await this.playerRepo.save(others);
        for (const other of others) {
          this.gateway.notifyHandUpdate(other.userId, {
            tableId: table.id,
            userId: other.userId,
            cardCount: other.hand.length,
            yourHand: other.hand,
            pendingPickCount: table.pendingPickCount,
            currentTurnPlayerId: table.currentTurnPlayerId,
            deckCount: table.deck.length,
            seats: players.map((p) => this.publicPlayer(p)),
            reason: 'general_market',
          });
        }
      }
    }

    // The market (draw pile — no reshuffle) is empty, whether it already was
    // or just ran out from the General Market effect above: the game ends
    // right here instead of advancing to a next turn.
    if (this.isMarketExhausted(table)) {
      await this.playerRepo.save(player);
      await this.tableRepo.save(table);
      this.gateway.notifyCardPlayed(table.id, {
        tableId: table.id,
        userId,
        card,
        topCard: card,
        calledShape: table.requestedShape,
        currentTurnPlayerId: null,
        turnDirection: table.turnDirection,
        pendingPickCount: table.pendingPickCount,
        requestedShape: table.requestedShape,
        winnerId: null,
        deckCount: 0,
        seats: players.map((p) => this.publicPlayer(p)),
      });
      await this.finishByFewestCards(table.id);
      return { success: true, tableId: table.id, marketExhausted: true };
    }

    const currentIdx = players.findIndex((p) => p.userId === userId);
    const nextIdx = this.advanceIndex(currentIdx, steps, table.turnDirection, players.length);
    table.currentTurnPlayerId = players[nextIdx].userId;

    await this.playerRepo.save(player);
    await this.tableRepo.save(table);

    this.gateway.notifyCardPlayed(table.id, {
      tableId: table.id,
      userId,
      card,
      topCard: card,
      calledShape: table.requestedShape,
      currentTurnPlayerId: table.currentTurnPlayerId,
      turnDirection: table.turnDirection,
      pendingPickCount: table.pendingPickCount,
      requestedShape: table.requestedShape,
      winnerId: null,
      deckCount: table.deck.length,
      seats: players.map((p) => this.publicPlayer(p)),
    });
    this.gateway.notifyTurnChanged(table.id, {
      tableId: table.id,
      currentTurnPlayerId: table.currentTurnPlayerId,
      turnDirection: table.turnDirection,
      pendingPickCount: table.pendingPickCount,
      requestedShape: table.requestedShape,
    });
    this.maybeScheduleBotMove(table.id);

    return { success: true, tableId: table.id, currentTurnPlayerId: table.currentTurnPlayerId };
  }

  async drawCard(userId: string, tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table) throw new NotFoundException('Table not found');
    if (table.status !== WhotTableStatus.ACTIVE) {
      throw new BadRequestException('Table is not active');
    }
    if (table.currentTurnPlayerId !== userId) {
      throw new BadRequestException('It is not your turn');
    }

    // The market (draw pile — no reshuffle) is empty — no one can draw any
    // further, so the game ends now instead of a silent no-op draw.
    if (this.isMarketExhausted(table)) {
      await this.finishByFewestCards(table.id);
      return { success: true, tableId: table.id, marketExhausted: true };
    }

    const players = await this.findPlayersWithUser(table.id);
    const player = players.find((p) => p.userId === userId);
    if (!player) throw new BadRequestException('You are not seated at this table');

    const drawCount = table.pendingPickCount > 0 ? table.pendingPickCount : 1;
    const drawn: string[] = [];
    for (let i = 0; i < drawCount && table.deck.length > 0; i++) {
      drawn.push(table.deck.shift() as string);
    }
    player.hand.push(...drawn);
    table.pendingPickCount = 0;

    const seats = players.map((p) => this.publicPlayer(p));

    // Ran dry mid-draw (e.g. owed a Pick 2 with only one card left in the
    // pile): end the game right here instead of advancing to a next turn.
    if (this.isMarketExhausted(table)) {
      await this.playerRepo.save(player);
      await this.tableRepo.save(table);
      this.gateway.notifyHandUpdate(userId, {
        tableId: table.id,
        userId,
        cardCount: player.hand.length,
        yourHand: player.hand,
        pendingPickCount: table.pendingPickCount,
        currentTurnPlayerId: table.currentTurnPlayerId,
        deckCount: 0,
        seats,
      });
      this.gateway.notifyCardDrawnPublic(table.id, {
        tableId: table.id,
        userId,
        cardCount: player.hand.length,
        pendingPickCount: table.pendingPickCount,
        currentTurnPlayerId: table.currentTurnPlayerId,
        deckCount: 0,
        seats,
      });
      await this.finishByFewestCards(table.id);
      return { success: true, tableId: table.id, drawnCount: drawn.length, marketExhausted: true };
    }

    const currentIdx = players.findIndex((p) => p.userId === userId);
    const nextIdx = this.advanceIndex(currentIdx, 1, table.turnDirection, players.length);
    table.currentTurnPlayerId = players[nextIdx].userId;

    await this.playerRepo.save(player);
    await this.tableRepo.save(table);

    this.gateway.notifyHandUpdate(userId, {
      tableId: table.id,
      userId,
      cardCount: player.hand.length,
      yourHand: player.hand,
      pendingPickCount: table.pendingPickCount,
      currentTurnPlayerId: table.currentTurnPlayerId,
      deckCount: table.deck.length,
      seats,
    });
    this.gateway.notifyCardDrawnPublic(table.id, {
      tableId: table.id,
      userId,
      cardCount: player.hand.length,
      pendingPickCount: table.pendingPickCount,
      currentTurnPlayerId: table.currentTurnPlayerId,
      deckCount: table.deck.length,
      seats,
    });
    this.gateway.notifyTurnChanged(table.id, {
      tableId: table.id,
      currentTurnPlayerId: table.currentTurnPlayerId,
      turnDirection: table.turnDirection,
      pendingPickCount: table.pendingPickCount,
      requestedShape: table.requestedShape,
    });
    this.maybeScheduleBotMove(table.id);

    return {
      success: true,
      tableId: table.id,
      drawnCount: drawn.length,
      currentTurnPlayerId: table.currentTurnPlayerId,
    };
  }

  // ─────────────────────────────────────────────
  // SETTLEMENT
  // ─────────────────────────────────────────────

  private async finishTable(tableId: string, winnerId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table || table.status === WhotTableStatus.FINISHED) {
      return; // idempotency guard
    }

    table.status = WhotTableStatus.FINISHED;
    table.finishedAt = new Date();
    table.winnerId = winnerId;
    if (!table.winnerPrize) {
      table.platformFee = Math.floor((table.pot * WHOT_PLATFORM_FEE_PERCENT) / 100);
      table.winnerPrize = table.pot - table.platformFee;
    }
    await this.tableRepo.save(table);
    await this.playerRepo.update({ tableId }, { isActive: false });

    await this.coinsService.creditBalance(winnerId, table.winnerPrize, CoinTransactionType.WHOT_WIN, table.id);
    this.logger.log(`finishTable: credited ${table.winnerPrize} coins to whot winner ${winnerId}`);

    const players = await this.findPlayersWithUser(tableId);
    this.gateway.notifyTableEnded(tableId, {
      tableId,
      winnerId,
      stake: table.stake,
      pot: table.pot,
      winnerPrize: table.winnerPrize,
      platformFee: table.platformFee,
      seats: players.map((p) => this.publicPlayer(p)),
    });
  }

  /** True once the draw pile is empty. No reshuffle: the discard pile is
   * never recycled back in, so this simply means "nothing left to deal out." */
  private isMarketExhausted(table: WhotTable): boolean {
    return table.deck.length === 0;
  }

  /** Ends the table when the market runs out: whoever holds the fewest cards
   * wins outright, or a tie for fewest splits the winner's prize evenly. */
  private async finishByFewestCards(tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table || table.status === WhotTableStatus.FINISHED) return;

    const players = await this.findPlayersWithUser(tableId);
    const minCount = Math.min(...players.map((p) => p.hand.length));
    const leaders = players.filter((p) => p.hand.length === minCount);

    if (leaders.length === 1) {
      await this.finishTable(tableId, leaders[0].userId);
    } else {
      await this.finishTableSplit(tableId, leaders.map((p) => p.userId));
    }
  }

  /** Settlement for a tied "fewest cards" ending — splits the winner's prize
   * evenly across the tied leaders instead of crediting a single winner. */
  private async finishTableSplit(tableId: string, winnerIds: string[]) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table || table.status === WhotTableStatus.FINISHED) return;

    table.status = WhotTableStatus.FINISHED;
    table.finishedAt = new Date();
    table.winnerId = null;
    if (!table.winnerPrize) {
      table.platformFee = Math.floor((table.pot * WHOT_PLATFORM_FEE_PERCENT) / 100);
      table.winnerPrize = table.pot - table.platformFee;
    }
    await this.tableRepo.save(table);
    await this.playerRepo.update({ tableId }, { isActive: false });

    const share = Math.floor(table.winnerPrize / winnerIds.length);
    for (const winnerId of winnerIds) {
      await this.coinsService.creditBalance(winnerId, share, CoinTransactionType.WHOT_WIN, table.id);
    }
    this.logger.log(
      `finishTableSplit: split ${table.winnerPrize} coins between ${winnerIds.length} tied winners for table ${tableId}`,
    );

    const players = await this.findPlayersWithUser(tableId);
    this.gateway.notifyTableEnded(tableId, {
      tableId,
      winnerId: null,
      winnerIds,
      stake: table.stake,
      pot: table.pot,
      winnerPrize: table.winnerPrize,
      platformFee: table.platformFee,
      seats: players.map((p) => this.publicPlayer(p)),
    });
  }

  // ─────────────────────────────────────────────
  // DISCONNECT HANDLER
  // ─────────────────────────────────────────────

  private async handleDisconnect(userId: string) {
    const seat = await this.findActiveSeat(userId);
    if (!seat) return;
    const table = seat.table;

    if (table.status === WhotTableStatus.QUEUED) {
      // Pre-game: drop them from the table immediately and refund.
      if (seat.escrowed) {
        await this.refundPlayer(userId, table.stake, `disconnect_${table.id}`);
      }
      await this.playerRepo.delete({ id: seat.id });

      const remaining = await this.playerRepo.count({ where: { tableId: table.id } });
      if (remaining === 0) {
        table.status = WhotTableStatus.CANCELLED;
        table.finishedAt = new Date();
        await this.tableRepo.save(table);
      } else {
        table.pot = table.stake * remaining;
        await this.tableRepo.save(table);
        const players = await this.findPlayersWithUser(table.id);
        this.gateway.notifyTableUpdate(table.id, this.publicTableSummary(table, players));
      }
      return;
    }

    // COUNTDOWN/ACTIVE: don't forfeit an in-progress game over a brief network
    // blip. Mark when they dropped so the stale-turn cron can auto-draw on
    // their behalf if it's their turn once the grace period passes; the
    // whole-table stale-active cron still sweeps up a fully abandoned game.
    await this.playerRepo.update({ id: seat.id }, { disconnectedAt: new Date() });
    this.gateway.notifyPlayerDisconnected(table.id, { tableId: table.id, userId });
  }

  // ─────────────────────────────────────────────
  // CRON: AUTO-DRAW FOR A DISCONNECTED PLAYER'S OWN TURN
  // ─────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleDisconnectedPlayerTurns() {
    const cutoff = new Date(Date.now() - this.DISCONNECT_TURN_GRACE_MS);

    const stuckSeats = await this.playerRepo
      .createQueryBuilder('p')
      .innerJoin('p.table', 't')
      .where('t.status = :status', { status: WhotTableStatus.ACTIVE })
      .andWhere('t."currentTurnPlayerId" = p."userId"')
      .andWhere('p."disconnectedAt" IS NOT NULL')
      .andWhere('p."disconnectedAt" < :cutoff', { cutoff })
      .select(['p.userId', 'p.tableId'])
      .getMany();

    for (const seat of stuckSeats) {
      this.logger.log(`[Whot Cron] Auto-drawing for disconnected player ${seat.userId} at table ${seat.tableId}`);
      try {
        await this.drawCard(seat.userId, seat.tableId);
      } catch (err) {
        this.logger.error(`[Whot Cron] Auto-draw failed for ${seat.userId} at ${seat.tableId}: ${err}`);
      }
    }
  }

  // ─────────────────────────────────────────────
  // CRON: AUTO-START / AUTO-REFUND STALE TABLES
  // ─────────────────────────────────────────────

  @Cron(CronExpression.EVERY_MINUTE)
  async handleStaleWhotTables() {
    const now = Date.now();

    // 1. Auto-start partially filled QUEUED tables past the grace window, or
    //    cancel+refund ones that never reached minPlayers within the queue timeout.
    const queuedTables = await this.tableRepo.find({ where: { status: WhotTableStatus.QUEUED } });
    for (const table of queuedTables) {
      if (!table.queuedAt) continue;
      const age = now - table.queuedAt.getTime();
      const seatsFilled = await this.playerRepo.count({ where: { tableId: table.id, escrowed: true } });

      if (seatsFilled >= table.minPlayers && seatsFilled < table.maxPlayers && age > this.AUTO_START_WAIT_MS) {
        this.logger.log(`[Whot Cron] Auto-starting partially filled table ${table.id} (${seatsFilled}/${table.maxPlayers})`);
        await this.startTable(table.id);
      } else if (age > this.QUEUE_TIMEOUT_MS) {
        this.logger.log(`[Whot Cron] Cancelling stale QUEUED table ${table.id}`);
        await this.cancelAndRefundTable(table, 'queue_timeout');
      }
    }

    // 2. Force-activate tables stuck in COUNTDOWN (e.g. after a server restart
    //    lost the in-process setTimeout).
    const staleCountdown = await this.tableRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: WhotTableStatus.COUNTDOWN })
      .andWhere('t."startedAt" < :cutoff', { cutoff: new Date(now - this.COUNTDOWN_TIMEOUT_MS) })
      .getMany();
    for (const table of staleCountdown) {
      this.logger.log(`[Whot Cron] Force-activating stuck COUNTDOWN table ${table.id}`);
      await this.activateTable(table.id);
    }

    // 3. Cancel+refund ACTIVE tables with no activity for a long time — covers
    //    a mid-game disconnect where nobody reconnects to keep the game moving.
    const staleActive = await this.tableRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: WhotTableStatus.ACTIVE })
      .andWhere('t."updatedAt" < :cutoff', { cutoff: new Date(now - this.STALE_ACTIVE_MS) })
      .getMany();
    for (const table of staleActive) {
      this.logger.log(`[Whot Cron] Cancelling stale ACTIVE table ${table.id} (inactive)`);
      await this.cancelAndRefundTable(table, 'inactivity_timeout');
    }
  }

  private async cancelAndRefundTable(table: WhotTable, reason: string) {
    table.status = WhotTableStatus.CANCELLED;
    table.finishedAt = new Date();
    await this.tableRepo.save(table);

    const players = await this.findPlayersWithUser(table.id);
    for (const player of players) {
      if (player.escrowed) {
        await this.refundPlayer(player.userId, table.stake, `${reason}_${table.id}`);
      }
    }
    this.gateway.notifyTableEnded(table.id, {
      tableId: table.id,
      cancelled: true,
      reason,
      stake: table.stake,
      pot: table.pot,
      seats: players.map((p) => this.publicPlayer(p)),
    });
  }

  private async refundPlayer(userId: string, amount: number, reason: string) {
    try {
      await this.coinsService.creditBalance(userId, amount, CoinTransactionType.WHOT_REFUND, reason);
    } catch (err) {
      this.logger.error(`refundPlayer: failed to refund ${userId}: ${err}`);
    }
  }

  // ─────────────────────────────────────────────
  // QUERIES
  // ─────────────────────────────────────────────

  async getActiveTable(userId: string) {
    const seat = await this.findActiveSeat(userId);
    if (!seat) return null;
    const table = seat.table;
    const players = await this.findPlayersWithUser(table.id);
    return this.publicTableSummary(table, players, userId);
  }

  async getHistory(userId: string, limit = 20, cursor?: string) {
    const qb = this.playerRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.table', 't')
      .where('p.userId = :userId', { userId })
      .andWhere('t.status = :status', { status: WhotTableStatus.FINISHED })
      .orderBy('t.finishedAt', 'DESC')
      .take(limit + 1);

    if (cursor) {
      qb.andWhere('t.finishedAt < :cursor', { cursor });
    }

    const seats = await qb.getMany();
    const hasMore = seats.length > limit;
    if (hasMore) seats.pop();

    const tables = await Promise.all(
      seats.map(async (seat) => {
        const players = await this.findPlayersWithUser(seat.tableId);
        return this.publicTableSummary(seat.table, players, userId);
      }),
    );

    return {
      tables,
      nextCursor: hasMore ? seats[seats.length - 1].table.finishedAt : null,
    };
  }

  async getQueueStats(stake: number, maxPlayers: number) {
    const tables = await this.tableRepo.find({ where: { status: WhotTableStatus.QUEUED, stake, maxPlayers } });
    let playersInQueue = 0;
    for (const t of tables) {
      playersInQueue += await this.playerRepo.count({ where: { tableId: t.id } });
    }
    return { stake, maxPlayers, playersInQueue };
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private async findActiveSeat(userId: string): Promise<WhotTablePlayer | null> {
    return this.playerRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.table', 't')
      .where('p.userId = :userId', { userId })
      .andWhere('t.status IN (:...statuses)', { statuses: ACTIVE_TABLE_STATUSES })
      .getOne();
  }

  private async findQueuedSeat(userId: string): Promise<WhotTablePlayer | null> {
    return this.playerRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.table', 't')
      .where('p.userId = :userId', { userId })
      .andWhere('t.status = :status', { status: WhotTableStatus.QUEUED })
      .getOne();
  }

  private advanceIndex(currentIdx: number, steps: number, direction: number, n: number): number {
    return (((currentIdx + steps * direction) % n) + n) % n;
  }

  // ─────────────────────────────────────────────
  // BOT AI (drives the "Computer" seat's turns)
  // ─────────────────────────────────────────────

  /** If it's now the bot's turn on an active table, schedule its move after a
   * short human-like delay. Safe to call unconditionally after any turn change —
   * playBotTurn re-checks the table's current state before acting. */
  private maybeScheduleBotMove(tableId: string) {
    setTimeout(() => {
      this.playBotTurn(tableId).catch((err) =>
        this.logger.error(`playBotTurn failed for table ${tableId}: ${err}`),
      );
    }, 900 + Math.floor(Math.random() * 900));
  }

  private async playBotTurn(tableId: string) {
    const table = await this.tableRepo.findOne({ where: { id: tableId } });
    if (!table || table.status !== WhotTableStatus.ACTIVE || !table.currentTurnPlayerId) return;

    const player = await this.playerRepo.findOne({
      where: { tableId, userId: table.currentTurnPlayerId },
      relations: { user: true },
    });
    if (!player?.user?.isBot) return;

    const topCard = table.discardPile[table.discardPile.length - 1];
    const legalCards = player.hand.filter((card) =>
      isLegalPlay({
        card,
        topCard,
        requestedShape: table.requestedShape,
        pendingPickCount: table.pendingPickCount,
      }),
    );

    if (legalCards.length === 0) {
      await this.drawCard(player.userId, tableId);
      return;
    }

    // Prefer a non-wild legal card, saving Whot-20s for when nothing else works.
    const choice = legalCards.find((c) => !parseCard(c).isWild) ?? legalCards[0];
    const parsed = parseCard(choice);
    const calledShape = parsed.isWild
      ? this.mostCommonShape(player.hand.filter((c) => c !== choice))
      : undefined;

    await this.playCard(player.userId, tableId, choice, calledShape);
  }

  /** Picks the shape the bot holds most of, so a called Whot-20 stays useful next turn. */
  private mostCommonShape(hand: string[]): WhotShape {
    const shapes: WhotShape[] = ['circle', 'triangle', 'cross', 'square', 'star'];
    const counts: Record<string, number> = {};
    for (const card of hand) {
      const parsed = parseCard(card);
      if (!parsed.isWild) counts[parsed.shape] = (counts[parsed.shape] ?? 0) + 1;
    }
    return shapes.reduce((best, s) => ((counts[s] ?? 0) > (counts[best] ?? 0) ? s : best), shapes[0]);
  }

  /** Always fetch table players through this helper (not a bare playerRepo.find)
   * so every public payload has the joined user profile fields available —
   * restricted to the columns the mobile client's WhotSeat type needs, never
   * the full User entity (password hash etc. must never reach the client). */
  private async findPlayersWithUser(tableId: string, extraWhere: Record<string, unknown> = {}) {
    return this.playerRepo.find({
      where: { tableId, ...extraWhere },
      order: { seatIndex: 'ASC' },
      relations: { user: true },
      select: {
        id: true,
        tableId: true,
        userId: true,
        seatIndex: true,
        hand: true,
        isActive: true,
        hasCalledLastCard: true,
        escrowed: true,
        joinedAt: true,
        user: { id: true, username: true, firstName: true, lastName: true, profilePictureUrl: true },
      },
    });
  }

  private publicPlayer(p: WhotTablePlayer) {
    return {
      userId: p.userId,
      username: p.user?.username ?? null,
      firstName: p.user?.firstName ?? null,
      lastName: p.user?.lastName ?? null,
      profilePictureUrl: p.user?.profilePictureUrl ?? null,
      seatIndex: p.seatIndex,
      cardCount: p.hand.length,
      isActive: p.isActive,
      hasCalledLastCard: p.hasCalledLastCard,
    };
  }

  private publicTableSummary(table: WhotTable, players: WhotTablePlayer[], forUserId?: string) {
    const mine = forUserId ? players.find((p) => p.userId === forUserId) : undefined;
    return {
      id: table.id,
      tableId: table.id,
      status: table.status,
      stake: table.stake,
      maxPlayers: table.maxPlayers,
      minPlayers: table.minPlayers,
      pot: table.pot,
      platformFee: table.platformFee,
      winnerPrize: table.winnerPrize,
      winnerId: table.winnerId,
      topCard: table.discardPile.length ? table.discardPile[table.discardPile.length - 1] : null,
      deckCount: table.deck.length,
      currentTurnPlayerId: table.currentTurnPlayerId,
      turnDirection: table.turnDirection,
      pendingPickCount: table.pendingPickCount,
      requestedShape: table.requestedShape,
      seats: players.map((p) => this.publicPlayer(p)),
      yourHand: mine ? mine.hand : undefined,
      createdAt: table.createdAt,
      startedAt: table.startedAt,
      queuedAt: table.queuedAt,
      finishedAt: table.finishedAt,
    };
  }
}
