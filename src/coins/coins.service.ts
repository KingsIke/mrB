import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CoinBalance } from './entities/coin-balance.entity';
import { CoinTransaction, CoinTransactionType } from './entities/coin-transaction.entity';
import { CoinPurchase, CoinPurchaseStatus } from './entities/coin-purchase.entity';
import { SavedWithdrawalAccount } from './entities/saved-withdrawal-account.entity';
import { PurchaseCoinsDto, ResolveAccountDto } from './dto/purchase-coins.dto';
import { PaystackClient } from './paystack.client';
import { UsersService } from '../users/users.service';
import { OtpService } from '../otp/otp.service';
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from '../common/pagination/cursor-pagination.dto';

export const COIN_RATE_NGN = 10; // 1 Coin = 10 NGN

// Credits that land in bonusBalance ("game coins"): coins won or earned by
// playing. They are the only coins that can be staked, and they can never be
// gifted (gifts become withdrawable cash for the recipient). So purchased
// coins never enter a game and game winnings never turn into money, which
// keeps the games out of real-money gambling (App Store 5.3, Google Play).
const BONUS_CREDIT_TYPES = new Set<CoinTransactionType>([
  CoinTransactionType.BATTLE_WIN,
  CoinTransactionType.WHOT_WIN,
  CoinTransactionType.PUZZLE_HIGH_SCORE,
  CoinTransactionType.TREASURE_HUNT_REWARD,
  CoinTransactionType.LEVEL_UP_REWARD,
  CoinTransactionType.STARTER_GAME_COINS,
]);

/**
 * One-time game coins every account gets, so new players can join a table
 * (game coins can't be bought). Enough for a few games at the lowest stake.
 */
export const STARTER_GAME_COINS = 200;

// Game stakes: paid from game coins (bonusBalance) only, never purchased coins.
const STAKE_DEBIT_TYPES = new Set<CoinTransactionType>([
  CoinTransactionType.BATTLE_ENTRY,
  CoinTransactionType.WHOT_ENTRY,
]);

// Stake refunds: returned to game coins (up to stakedBonus). Stakes placed
// with purchased coins before stakes became game-coins-only refund to balance.
const STAKE_REFUND_TYPES = new Set<CoinTransactionType>([
  CoinTransactionType.BATTLE_REFUND,
  CoinTransactionType.WHOT_REFUND,
]);

/** Coins available for game stakes: game coins only (won or earned, never purchased). */
export function stakeableCoins(balance: CoinBalance): number {
  return Number(balance.bonusBalance ?? 0);
}

/** Purchased + game coins: the running total recorded on transactions. */
export function totalCoins(balance: CoinBalance): number {
  return Number(balance.balance) + Number(balance.bonusBalance ?? 0);
}

/** Shown when a player tries to stake more game coins than they have. */
export function notEnoughGameCoinsMessage(needed: number, have: number): string {
  return `Not enough game coins. You need ${needed} but have ${have}. Game coins come from wins and rewards (level-ups, puzzles, treasure hunts); purchased coins can't be staked.`;
}

/**
 * In-app purchase products (App Store / Google Play, via RevenueCat) and the
 * coins each one grants. Prices are set per store in App Store Connect and
 * Play Console, not here.
 */
export const IAP_COIN_PRODUCTS: Record<string, number> = {
  coins_50: 50,
  coins_100: 100,
  coins_250: 250,
  coins_500: 500,
  coins_1000: 1000,
};

/** The fields we use from a RevenueCat webhook event. */
export interface RevenueCatEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  transaction_id?: string;
  store?: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
  price?: number;
  price_in_purchased_currency?: number;
  currency?: string;
}

@Injectable()
export class CoinsService {
  private readonly logger = new Logger(CoinsService.name);

  constructor(
    @InjectRepository(CoinBalance)
    private readonly coinBalanceRepository: Repository<CoinBalance>,
    @InjectRepository(CoinTransaction)
    private readonly coinTransactionRepository: Repository<CoinTransaction>,
    @InjectRepository(CoinPurchase)
    private readonly coinPurchaseRepository: Repository<CoinPurchase>,
    @InjectRepository(SavedWithdrawalAccount)
    private readonly savedWithdrawalAccountRepository: Repository<SavedWithdrawalAccount>,
    private readonly paystackClient: PaystackClient,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async getOrCreateBalance(userId: string): Promise<CoinBalance> {
    let balance = await this.coinBalanceRepository.findOne({ where: { userId } });
    if (!balance) {
      balance = await this.coinBalanceRepository.save(this.coinBalanceRepository.create({ userId }));
    }
    return balance;
  }

  async getBalance(userId: string): Promise<CoinBalance> {
    const balance = await this.getOrCreateBalance(userId);
    if (!balance.starterGameCoinsGrantedAt) {
      await this.grantStarterGameCoins(userId);
      return this.getOrCreateBalance(userId);
    }
    return balance;
  }

  /** Credits STARTER_GAME_COINS once per account; safe to call concurrently. */
  private async grantStarterGameCoins(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(CoinBalance)
        .set({
          bonusBalance: () => `"bonusBalance" + ${STARTER_GAME_COINS}`,
          starterGameCoinsGrantedAt: () => 'NOW()',
        })
        .where('"userId" = :userId AND "starterGameCoinsGrantedAt" IS NULL', { userId })
        .execute();
      if (!result.affected) return;

      const balance = await manager.getRepository(CoinBalance).findOneOrFail({ where: { userId } });
      const transactionRepository = manager.getRepository(CoinTransaction);
      await transactionRepository.save(
        transactionRepository.create({
          userId,
          amount: STARTER_GAME_COINS,
          type: CoinTransactionType.STARTER_GAME_COINS,
          referenceId: null,
          balanceAfter: totalCoins(balance),
        }),
      );
    });
  }

  /** Used by GiftsService's daily free gift claim to enforce one claim per calendar day. */
  async hasClaimedFreeGiftToday(userId: string): Promise<boolean> {
    const balance = await this.getOrCreateBalance(userId);
    if (!balance.lastFreeGiftClaimedAt) return false;
    return balance.lastFreeGiftClaimedAt.toDateString() === new Date().toDateString();
  }

  async markDailyGiftClaimed(userId: string): Promise<void> {
    const balance = await this.getOrCreateBalance(userId);
    balance.lastFreeGiftClaimedAt = new Date();
    await this.coinBalanceRepository.save(balance);
  }

  async creditBalance(
    userId: string,
    amount: number,
    type: CoinTransactionType,
    referenceId?: string,
    txType?: CoinTransactionType,
  ): Promise<CoinBalance> {
    // Ensure a balance row exists before we try to lock it inside the
    // transaction (SELECT ... FOR UPDATE can't lock a row that isn't there).
    await this.getOrCreateBalance(userId);

    return this.dataSource.transaction(async (manager) => {
      const balanceRepository = manager.getRepository(CoinBalance);
      const transactionRepository = manager.getRepository(CoinTransaction);

      const balance = await balanceRepository.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Coin balance not found');
      }

      if (BONUS_CREDIT_TYPES.has(type)) {
        balance.bonusBalance = Number(balance.bonusBalance) + amount;
      } else if (STAKE_REFUND_TYPES.has(type)) {
        const toBonus = Math.min(amount, Number(balance.stakedBonus));
        balance.stakedBonus = Number(balance.stakedBonus) - toBonus;
        balance.bonusBalance = Number(balance.bonusBalance) + toBonus;
        balance.balance = Number(balance.balance) + (amount - toBonus);
      } else {
        balance.balance = Number(balance.balance) + amount;
      }
      await balanceRepository.save(balance);
      await transactionRepository.save(
        transactionRepository.create({
          userId,
          amount,
          type: txType ?? type,
          referenceId: referenceId ?? null,
          balanceAfter: totalCoins(balance),
        }),
      );
      return balance;
    });
  }

  async debitBalance(
    userId: string,
    amount: number,
    type: CoinTransactionType,
    referenceId?: string,
  ): Promise<CoinBalance> {
    // Ensure a balance row exists before we try to lock it inside the
    // transaction (SELECT ... FOR UPDATE can't lock a row that isn't there).
    await this.getOrCreateBalance(userId);

    return this.dataSource.transaction(async (manager) => {
      const balanceRepository = manager.getRepository(CoinBalance);
      const transactionRepository = manager.getRepository(CoinTransaction);

      const balance = await balanceRepository.findOne({
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) {
        throw new NotFoundException('Coin balance not found');
      }
      if (STAKE_DEBIT_TYPES.has(type)) {
        if (stakeableCoins(balance) < amount) {
          throw new BadRequestException(notEnoughGameCoinsMessage(amount, stakeableCoins(balance)));
        }
        balance.bonusBalance = Number(balance.bonusBalance) - amount;
        balance.stakedBonus = Number(balance.stakedBonus) + amount;
      } else {
        // Gifts and everything else: purchased coins only.
        if (Number(balance.balance) < amount) {
          throw new BadRequestException(
            Number(balance.bonusBalance) > 0
              ? 'Not enough purchased coins. Coins won in games can only be used in games.'
              : 'Insufficient Campus Coins balance',
          );
        }
        balance.balance = Number(balance.balance) - amount;
      }
      await balanceRepository.save(balance);
      await transactionRepository.save(
        transactionRepository.create({
          userId,
          amount: -amount,
          type,
          referenceId: referenceId ?? null,
          balanceAfter: totalCoins(balance),
        }),
      );
      return balance;
    });
  }

  /** Credits earned gift cash balance (NGN) for recipients */
  async creditEarnedBalance(
    userId: string,
    amountNgn: number,
    referenceId?: string,
    txType?: CoinTransactionType,
  ): Promise<CoinBalance> {
    const balance = await this.getOrCreateBalance(userId);
    balance.earnedBalance = Number(balance.earnedBalance) + amountNgn;
    await this.coinBalanceRepository.save(balance);

    await this.coinTransactionRepository.save(
      this.coinTransactionRepository.create({
        userId,
        amount: amountNgn,
        type: txType ?? CoinTransactionType.GIFT_RECEIVED,
        referenceId: referenceId ?? null,
        balanceAfter: balance.earnedBalance,
      }),
    );

    return balance;
  }

 /** Convert withdrawable cash balance from received gifts into spendable coins */
  async convertEarnedToCoins(
    userId: string,
    amountNgn: number,
  ): Promise<{ newBalance: CoinBalance; coinsAdded: number; reference: string }> {
    if (amountNgn <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const coinsToCredit = Math.floor(amountNgn / COIN_RATE_NGN);
    if (coinsToCredit <= 0) {
      throw new BadRequestException(`Minimum conversion amount is ${COIN_RATE_NGN} NGN`);
    }

    return this.dataSource.transaction(async (manager) => {
      const balanceRepository = manager.getRepository(CoinBalance);
      const transactionRepository = manager.getRepository(CoinTransaction);

      const balance = await balanceRepository.findOne({ where: { userId } });

      if (!balance || Number(balance.earnedBalance) < amountNgn) {
        throw new BadRequestException('Insufficient earnings balance');
      }

      // Generate reference ID for the conversion
      const reference = `convert_${userId}_${Date.now()}`;

      balance.earnedBalance = Number(balance.earnedBalance) - amountNgn;
      balance.balance = Number(balance.balance) + coinsToCredit;

      await balanceRepository.save(balance);

      await transactionRepository.save(
        transactionRepository.create({
          userId,
          amount: coinsToCredit,
          type: CoinTransactionType.CONVERT_EARNINGS,
          referenceId: reference, // Added reference link here
          balanceAfter: balance.balance,
        }),
      );

      return { newBalance: balance, coinsAdded: coinsToCredit, reference };
    });
  }

  /** Initiate cash withdrawal from earned gift balance, to one of the user's saved accounts */
  async withdrawEarnings(
    userId: string,
    amountNgn: number,
    savedAccountId: string,
  ): Promise<{ success: boolean; reference: string }> {
    if (amountNgn <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const savedAccount = await this.savedWithdrawalAccountRepository.findOne({
      where: { id: savedAccountId, userId },
    });
    if (!savedAccount) {
      throw new NotFoundException('Saved bank account not found');
    }
    const bankDetails = {
      bankCode: savedAccount.bankCode,
      bankName: savedAccount.bankName ?? undefined,
      accountNumber: savedAccount.accountNumber,
      accountName: savedAccount.accountName ?? undefined,
    };

    const result = await this.dataSource.transaction(async (manager) => {
      const balanceRepository = manager.getRepository(CoinBalance);
      const transactionRepository = manager.getRepository(CoinTransaction);

      const balance = await balanceRepository.findOne({ where: { userId } });

      if (!balance || Number(balance.earnedBalance) < amountNgn) {
        throw new BadRequestException('Insufficient earnings balance for withdrawal');
      }

      const reference = `withdraw_${userId}_${Date.now()}`;

      balance.earnedBalance = Number(balance.earnedBalance) - amountNgn;
      await balanceRepository.save(balance);

      await transactionRepository.save(
        transactionRepository.create({
          userId,
          amount: -amountNgn,
          type: CoinTransactionType.WITHDRAWAL,
          referenceId: reference,
          balanceAfter: balance.earnedBalance,
        }),
      );

      // Trigger payout integration via Paystack client here if applicable
      // await this.paystackClient.initiateTransfer(amountNgn, bankDetails, reference);

      return { success: true, reference };
    });

    // Notify the admin team (to process the payout) and the user (receipt).
    // Fired in the background, not awaited: the withdrawal is already
    // committed above, so the client must get its success response
    // immediately regardless of how long email delivery takes or whether
    // it fails (Zoho hiccups, etc.) — email is best-effort, never a
    // condition of the withdrawal itself.
    this.sendWithdrawalNotifications(userId, amountNgn, bankDetails, result.reference).catch((err) => {
      this.logger.error('Failed to send withdrawal notifications', err);
    });

    savedAccount.lastUsedAt = new Date();
    this.savedWithdrawalAccountRepository.save(savedAccount).catch((err) => {
      this.logger.error('Failed to update saved account lastUsedAt', err);
    });

    return result;
  }

  private static readonly MAX_SAVED_WITHDRAWAL_ACCOUNTS = 3;

  /** Bank accounts the user has explicitly saved as withdrawal destinations. */
  async getWithdrawalAccounts(userId: string): Promise<SavedWithdrawalAccount[]> {
    return this.savedWithdrawalAccountRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  /** Adds a new saved withdrawal account — verifies it resolves to a real
   * account holder name via Paystack before saving, and caps at 3 per user. */
  async addWithdrawalAccount(
    userId: string,
    input: { bankCode: string; bankName?: string; accountNumber: string },
  ): Promise<SavedWithdrawalAccount> {
    const existingCount = await this.savedWithdrawalAccountRepository.count({ where: { userId } });
    if (existingCount >= CoinsService.MAX_SAVED_WITHDRAWAL_ACCOUNTS) {
      throw new BadRequestException(
        `You can save up to ${CoinsService.MAX_SAVED_WITHDRAWAL_ACCOUNTS} bank accounts. Delete one before adding another.`,
      );
    }

    const duplicate = await this.savedWithdrawalAccountRepository.findOne({
      where: { userId, bankCode: input.bankCode, accountNumber: input.accountNumber },
    });
    if (duplicate) {
      throw new BadRequestException('This bank account has already been saved');
    }

    // Verify the account is real before saving it as a payout destination.
    const resolved = await this.paystackClient.resolveAccountNumber(input.accountNumber, input.bankCode);
    if (!resolved?.account_name) {
      throw new BadRequestException('Could not verify this bank account. Double-check the details and try again.');
    }

    return this.savedWithdrawalAccountRepository.save(
      this.savedWithdrawalAccountRepository.create({
        userId,
        bankCode: input.bankCode,
        bankName: input.bankName ?? null,
        accountNumber: input.accountNumber,
        accountName: resolved.account_name,
        lastUsedAt: new Date(),
      }),
    );
  }

  /** Deletes a saved withdrawal account — refuses to remove the last one on file. */
  async deleteWithdrawalAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.savedWithdrawalAccountRepository.findOne({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Saved bank account not found');
    }

    const totalCount = await this.savedWithdrawalAccountRepository.count({ where: { userId } });
    if (totalCount <= 1) {
      throw new BadRequestException('You must keep at least one saved bank account. Add another before removing this one.');
    }

    await this.savedWithdrawalAccountRepository.remove(account);
  }

  private async sendWithdrawalNotifications(
    userId: string,
    amountNgn: number,
    bankDetails: { bankCode: string; bankName?: string; accountNumber: string; accountName?: string },
    reference: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) return;

    try {
      await this.otpService.notifyAdminsOfWithdrawal(user, amountNgn, bankDetails, reference);
    } catch (err) {
      this.logger.error('Failed to notify admins of withdrawal', err);
    }
    try {
      await this.otpService.notifyUserOfWithdrawal(user, amountNgn, reference);
    } catch (err) {
      this.logger.error('Failed to send withdrawal receipt to user', err);
    }
  }

  async resolveAccountName(dto: ResolveAccountDto): Promise<{ accountName: string }> {
  const accountData = await this.paystackClient.resolveAccountNumber(
    dto.accountNumber,
    dto.bankCode,
  );

  return {
    accountName: accountData.account_name,
  }
}

  async listTransactions(
    userId: string,
    pagination: CursorPaginationDto,
  ): Promise<CursorPaginated<CoinTransaction>> {
    const limit = pagination.limit ?? 20;
    const qb = this.coinTransactionRepository
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId });

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere('(tx.createdAt < :createdAt OR (tx.createdAt = :createdAt AND tx.id < :id))', {
        createdAt,
        id,
      });
    }

    qb.orderBy('tx.createdAt', 'DESC').addOrderBy('tx.id', 'DESC').take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];

    return {
      items: page,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async purchase(userId: string, dto: PurchaseCoinsDto): Promise<{ authorizationUrl: string; reference: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const amountPaid = dto.coins * COIN_RATE_NGN;
    const reference = `coins_${userId}_${Date.now()}`;

    const { authorizationUrl } = await this.paystackClient.initializeTransaction(
      user.email,
      Math.round(amountPaid * 100), 
      reference,
      dto.returnTo === 'web'
        ? this.configService.get<string>('WEB_TOPUP_CALLBACK_URL', 'https://www.3names.ng/coins/complete')
        : undefined,
    );

    await this.coinPurchaseRepository.save(
      this.coinPurchaseRepository.create({
        userId,
        amountPaid: amountPaid.toFixed(2),
        currency: 'NGN',
        coinsCredited: dto.coins,
        paymentReference: reference,
        status: CoinPurchaseStatus.PENDING,
      }),
    );

    return { authorizationUrl, reference };
  }

  /** Lets the website show whether a Paystack payment has been credited yet. */
  async getPurchaseStatus(userId: string, reference: string) {
    const purchase = await this.coinPurchaseRepository.findOne({
      where: { paymentReference: reference, userId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return { status: purchase.status, coins: purchase.coinsCredited };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const secret = this.configService.get('PAYSTACK_SECRET_KEY', '');
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    return hash === signature;
  }

  /**
   * Paystack webhook events. Paystack retries deliveries and can send the
   * same event more than once, possibly at the same moment, so every status
   * change is a conditional update ("only if still pending"), and coins are
   * credited in the same transaction as that update. A purchase is credited
   * or refunded at most once however many times the event arrives.
   */
  async handleWebhookEvent(event: {
    event: string;
    data: { reference: string; amount?: number };
  }): Promise<void> {
    const reference = event.data?.reference;
    if (!reference) return;

    switch (event.event) {
      case 'charge.success':
        await this.completePaystackPurchase(reference, event.data.amount);
        break;
      case 'charge.failed':
        // Never overwrite a purchase that already succeeded.
        await this.coinPurchaseRepository.update(
          { paymentReference: reference, status: CoinPurchaseStatus.PENDING },
          { status: CoinPurchaseStatus.FAILED },
        );
        break;
      case 'refund.processed':
        // Conditional success → refunded, then claw back what's left.
        await this.refundIapPurchase(reference);
        break;
      default:
        break;
    }
  }

  private async completePaystackPurchase(reference: string, amountKobo?: number) {
    await this.dataSource.transaction(async (manager) => {
      const purchaseRepository = manager.getRepository(CoinPurchase);
      const purchase = await purchaseRepository.findOne({ where: { paymentReference: reference } });
      if (!purchase) return;

      // Credit only what was actually paid for.
      const expectedKobo = Math.round(Number(purchase.amountPaid) * 100);
      if (typeof amountKobo === 'number' && amountKobo < expectedKobo) {
        this.logger.error(
          `Paystack ${reference}: paid ${amountKobo} kobo, expected ${expectedKobo}. Not crediting.`,
        );
        return;
      }

      // Claim the purchase: only one delivery can move it out of pending.
      const claimed = await purchaseRepository.update(
        { id: purchase.id, status: CoinPurchaseStatus.PENDING },
        { status: CoinPurchaseStatus.SUCCESS },
      );
      if (!claimed.affected) return;

      await this.getOrCreateBalance(purchase.userId);
      const balanceRepository = manager.getRepository(CoinBalance);
      const balance = await balanceRepository.findOne({
        where: { userId: purchase.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) throw new NotFoundException('Coin balance not found');

      balance.balance = Number(balance.balance) + purchase.coinsCredited;
      await balanceRepository.save(balance);
      await manager.getRepository(CoinTransaction).save(
        manager.getRepository(CoinTransaction).create({
          userId: purchase.userId,
          amount: purchase.coinsCredited,
          type: CoinTransactionType.PURCHASE,
          referenceId: purchase.id,
          balanceAfter: totalCoins(balance),
        }),
      );
    });
  }

  // ─────────────────────────────────────────────
  // IN-APP PURCHASES (App Store / Google Play via RevenueCat)
  // ─────────────────────────────────────────────

  /**
   * Credits a verified store purchase exactly once. The store transaction id
   * is the unique paymentReference, so webhook retries can't double-credit,
   * and the purchase row and the credit commit together.
   */
  async creditIapPurchase(params: {
    userId: string;
    coins: number;
    reference: string;
    amountPaid: number;
    currency: string;
  }): Promise<'credited' | 'duplicate'> {
    await this.getOrCreateBalance(params.userId);

    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(CoinPurchase)
        .values({
          userId: params.userId,
          amountPaid: params.amountPaid.toFixed(2),
          currency: params.currency.slice(0, 10),
          coinsCredited: params.coins,
          paymentReference: params.reference,
          status: CoinPurchaseStatus.SUCCESS,
        })
        .orIgnore()
        .returning(['id'])
        .execute();
      if (!inserted.raw?.length) return 'duplicate';
      const purchaseId: string = inserted.raw[0].id;

      const balanceRepository = manager.getRepository(CoinBalance);
      const transactionRepository = manager.getRepository(CoinTransaction);
      const balance = await balanceRepository.findOne({
        where: { userId: params.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!balance) throw new NotFoundException('Coin balance not found');

      balance.balance = Number(balance.balance) + params.coins;
      await balanceRepository.save(balance);
      await transactionRepository.save(
        transactionRepository.create({
          userId: params.userId,
          amount: params.coins,
          type: CoinTransactionType.PURCHASE,
          referenceId: purchaseId,
          balanceAfter: totalCoins(balance),
        }),
      );
      return 'credited';
    });
  }

  /**
   * RevenueCat sends the Authorization header value configured in its
   * dashboard. Reject everything if it isn't configured here.
   */
  verifyRevenueCatAuth(header: string | undefined): boolean {
    const expected = this.configService.get<string>('REVENUECAT_WEBHOOK_AUTH');
    if (!expected || !header) return false;
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Handles a RevenueCat webhook event. Coin packs are consumables, which
   * RevenueCat reports as NON_RENEWING_PURCHASE; refunds arrive as
   * CANCELLATION. Anything we can't act on is logged and acknowledged so
   * RevenueCat doesn't retry it forever.
   */
  async handleRevenueCatEvent(event: RevenueCatEvent | undefined): Promise<void> {
    if (!event?.type) return;
    if (event.type === 'TEST') {
      this.logger.log('RevenueCat test webhook received');
      return;
    }
    if (event.type !== 'NON_RENEWING_PURCHASE' && event.type !== 'CANCELLATION') return;

    const coins = IAP_COIN_PRODUCTS[event.product_id ?? ''];
    if (!coins || !event.transaction_id) {
      this.logger.warn(`RevenueCat ${event.type}: unknown product "${event.product_id}" or missing transaction id`);
      return;
    }

    // App Review and TestFlight purchases are sandbox purchases. They must be
    // credited or review fails; set IAP_ALLOW_SANDBOX=false to turn them off.
    if (
      event.environment === 'SANDBOX' &&
      this.configService.get<string>('IAP_ALLOW_SANDBOX', 'true') === 'false'
    ) {
      this.logger.warn(`RevenueCat: ignoring sandbox ${event.type} ${event.transaction_id}`);
      return;
    }

    const reference = `iap_${(event.store ?? 'store').toLowerCase()}_${event.transaction_id}`;

    if (event.type === 'CANCELLATION') {
      await this.refundIapPurchase(reference);
      return;
    }

    const userId = await this.resolveRevenueCatUser(event);
    if (!userId) {
      this.logger.error(`RevenueCat purchase ${event.transaction_id}: no matching user for "${event.app_user_id}"`);
      return;
    }

    const result = await this.creditIapPurchase({
      userId,
      coins,
      reference,
      amountPaid: Number(event.price_in_purchased_currency ?? event.price ?? 0),
      currency: event.currency ?? 'USD',
    });
    this.logger.log(`RevenueCat purchase ${event.transaction_id}: ${result} ${coins} coins for ${userId}`);
  }

  /**
   * Backup to the webhook: asks RevenueCat directly for this user's coin
   * purchases and credits any that haven't been credited yet. Uses the same
   * paymentReference as the webhook, so a purchase is credited exactly once
   * whichever path gets there first. Also covers RevenueCat Test Store
   * purchases, which don't reliably send webhooks.
   *
   * Needs REVENUECAT_SECRET_KEY (a V1 secret key). Without it this is a no-op.
   */
  async syncRevenueCatPurchases(userId: string): Promise<{ credited: number }> {
    const secretKey = this.configService.get<string>('REVENUECAT_SECRET_KEY');
    if (!secretKey) return { credited: 0 };

    let body: any;
    try {
      const res = await fetch(
        `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
        {
          headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        this.logger.warn(`RevenueCat sync for ${userId}: HTTP ${res.status}`);
        return { credited: 0 };
      }
      body = await res.json();
    } catch (err) {
      this.logger.warn(`RevenueCat sync for ${userId} failed: ${err}`);
      return { credited: 0 };
    }

    const allowSandbox = this.configService.get<string>('IAP_ALLOW_SANDBOX', 'true') !== 'false';
    const nonSubscriptions: Record<string, Array<Record<string, any>>> =
      body?.subscriber?.non_subscriptions ?? {};

    let credited = 0;
    for (const [productId, purchases] of Object.entries(nonSubscriptions)) {
      const coins = IAP_COIN_PRODUCTS[productId];
      if (!coins) continue;
      for (const purchase of purchases ?? []) {
        const transactionId = purchase.store_transaction_id ?? purchase.id;
        if (!transactionId) continue;
        if (purchase.is_sandbox && !allowSandbox) continue;

        const store = String(purchase.store ?? 'store').toLowerCase();
        const result = await this.creditIapPurchase({
          userId,
          coins,
          reference: `iap_${store}_${transactionId}`,
          amountPaid: 0,
          currency: 'USD',
        });
        if (result === 'credited') {
          credited += coins;
          this.logger.log(`RevenueCat sync: credited ${coins} coins for ${userId} (${transactionId})`);
        }
      }
    }
    return { credited };
  }

  /** The app logs in to RevenueCat with our user id; fall back to aliases for purchases made before login. */
  private async resolveRevenueCatUser(event: RevenueCatEvent): Promise<string | null> {
    const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of candidates) {
      if (id && uuid.test(id) && (await this.usersService.findById(id))) return id;
    }
    return null;
  }

  /** A store refund: mark the purchase refunded and claw back what's left of its coins. */
  async refundIapPurchase(reference: string): Promise<void> {
    const purchase = await this.coinPurchaseRepository.findOne({
      where: { paymentReference: reference },
    });
    if (!purchase) return;

    // Conditional update, so a repeated refund event can't claw back twice.
    const updated = await this.coinPurchaseRepository.update(
      { id: purchase.id, status: CoinPurchaseStatus.SUCCESS },
      { status: CoinPurchaseStatus.REFUNDED },
    );
    if (!updated.affected) return;

    const balance = await this.getOrCreateBalance(purchase.userId);
    const clawback = Math.min(Number(balance.balance), purchase.coinsCredited);
    if (clawback > 0) {
      await this.debitBalance(purchase.userId, clawback, CoinTransactionType.REFUND, purchase.id);
    }
  }
}
