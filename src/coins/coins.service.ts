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
    return this.getOrCreateBalance(userId);
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
    const balance = await this.getOrCreateBalance(userId);
    balance.balance = Number(balance.balance) + amount;
    await this.coinBalanceRepository.save(balance);
    await this.coinTransactionRepository.save(
      this.coinTransactionRepository.create({
        userId,
        amount,
        type: txType ?? type,
        referenceId: referenceId ?? null,
        balanceAfter: balance.balance,
      }),
    );
    return balance;
  }

  async debitBalance(
    userId: string,
    amount: number,
    type: CoinTransactionType,
    referenceId?: string,
  ): Promise<CoinBalance> {
    const balance = await this.getOrCreateBalance(userId);
    if (Number(balance.balance) < amount) {
      throw new BadRequestException('Insufficient Campus Coins balance');
    }
    balance.balance = Number(balance.balance) - amount;
    await this.coinBalanceRepository.save(balance);
    await this.coinTransactionRepository.save(
      this.coinTransactionRepository.create({
        userId,
        amount: -amount,
        type,
        referenceId: referenceId ?? null,
        balanceAfter: balance.balance,
      }),
    );
    return balance;
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

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const secret = this.configService.get('PAYSTACK_SECRET_KEY', '');
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    return hash === signature;
  }

  async handleWebhookEvent(event: { event: string; data: { reference: string } }): Promise<void> {
    const purchase = await this.coinPurchaseRepository.findOne({
      where: { paymentReference: event.data.reference },
    });
    if (!purchase) return;

    switch (event.event) {
      case 'charge.success': {
        if (purchase.status !== CoinPurchaseStatus.PENDING) return;
        purchase.status = CoinPurchaseStatus.SUCCESS;
        await this.coinPurchaseRepository.save(purchase);
        await this.creditBalance(
          purchase.userId,
          purchase.coinsCredited,
          CoinTransactionType.PURCHASE,
          purchase.id,
        );
        break;
      }
      case 'charge.failed': {
        purchase.status = CoinPurchaseStatus.FAILED;
        await this.coinPurchaseRepository.save(purchase);
        break;
      }
      case 'refund.processed': {
        if (purchase.status !== CoinPurchaseStatus.SUCCESS) return;
        purchase.status = CoinPurchaseStatus.REFUNDED;
        await this.coinPurchaseRepository.save(purchase);
        const balance = await this.getOrCreateBalance(purchase.userId);
        const clawback = Math.min(Number(balance.balance), purchase.coinsCredited);
        if (clawback > 0) {
          await this.debitBalance(purchase.userId, clawback, CoinTransactionType.REFUND, purchase.id);
        }
        break;
      }
      default:
        break;
    }
  }
}