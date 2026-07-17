import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { CoinBalance } from './entities/coin-balance.entity';
import { CoinTransaction, CoinTransactionType } from './entities/coin-transaction.entity';
import { CoinPurchase, CoinPurchaseStatus } from './entities/coin-purchase.entity';
import { PurchaseCoinsDto } from './dto/purchase-coins.dto';
import { PaystackClient } from './paystack.client';
import { UsersService } from '../users/users.service';
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from '../common/pagination/cursor-pagination.dto';

const COIN_RATE_NGN = 10; // ₦10 per Campus Coin — placeholder pricing, tune before launch.

@Injectable()
export class CoinsService {
  constructor(
    @InjectRepository(CoinBalance)
    private readonly coinBalanceRepository: Repository<CoinBalance>,
    @InjectRepository(CoinTransaction)
    private readonly coinTransactionRepository: Repository<CoinTransaction>,
    @InjectRepository(CoinPurchase)
    private readonly coinPurchaseRepository: Repository<CoinPurchase>,
    private readonly paystackClient: PaystackClient,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
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
  ): Promise<CoinBalance> {
    const balance = await this.getOrCreateBalance(userId);
    balance.balance += amount;
    await this.coinBalanceRepository.save(balance);
    await this.coinTransactionRepository.save(
      this.coinTransactionRepository.create({
        userId,
        amount,
        type,
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
    if (balance.balance < amount) {
      throw new BadRequestException('Insufficient Campus Coins balance');
    }
    balance.balance -= amount;
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
      Math.round(amountPaid * 100), // Paystack expects the amount in kobo
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
        // Only claw back coins still available — a user may have already spent them on gifts.
        const balance = await this.getOrCreateBalance(purchase.userId);
        const clawback = Math.min(balance.balance, purchase.coinsCredited);
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
