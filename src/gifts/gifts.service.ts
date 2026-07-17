import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gift } from './entities/gift.entity';
import { GiftTransaction, GiftTargetType } from './entities/gift-transaction.entity';
import { SendGiftDto } from './dto/send-gift.dto';
import { CoinsService } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { GamificationService } from '../gamification/gamification.service';
import { XpSource } from '../gamification/entities/xp-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType, NotificationType } from '../notifications/entities/notification.entity';
import { PostsService } from '../posts/posts.service';
import { StoriesService } from '../stories/stories.service';
import { FollowsService } from '../follows/follows.service';

const RECIPIENT_SHARE = 0.5; // Placeholder split — tune before launch.
const DAILY_FREE_GIFT_COINS = 1;

@Injectable()
export class GiftsService {
  constructor(
    @InjectRepository(Gift)
    private readonly giftRepository: Repository<Gift>,
    @InjectRepository(GiftTransaction)
    private readonly giftTransactionRepository: Repository<GiftTransaction>,
    private readonly coinsService: CoinsService,
    private readonly gamificationService: GamificationService,
    private readonly notificationsService: NotificationsService,
    private readonly postsService: PostsService,
    private readonly storiesService: StoriesService,
    private readonly followsService: FollowsService,
  ) {}

  async listGifts(): Promise<Gift[]> {
    return this.giftRepository.find({ where: { isActive: true } });
  }

  async seedGifts(): Promise<void> {
    const count = await this.giftRepository.count();
    if (count > 0) return;

    const catalog = [
      { name: 'Rose', emoji: '🌹', coinCost: 10 },
      { name: 'Clap', emoji: '👏', coinCost: 25 },
      { name: 'Trophy', emoji: '🏆', coinCost: 100 },
      { name: 'Crown', emoji: '👑', coinCost: 500 },
      { name: 'Rocket', emoji: '🚀', coinCost: 1000 },
    ];
    for (const item of catalog) {
      await this.giftRepository.save(this.giftRepository.create(item));
    }
  }

  private effectiveCost(gift: Gift): number {
    if (gift.discountPercent && (!gift.discountExpiresAt || gift.discountExpiresAt > new Date())) {
      return Math.round(gift.coinCost * (1 - gift.discountPercent / 100));
    }
    return gift.coinCost;
  }

  async sendGift(senderId: string, dto: SendGiftDto): Promise<GiftTransaction> {
    const gift = await this.giftRepository.findOne({ where: { id: dto.giftId, isActive: true } });
    if (!gift) {
      throw new NotFoundException('Gift not found');
    }

    let recipientId: string;
    if (dto.targetType === GiftTargetType.POST) {
      const target = await this.postsService.getGiftTarget(dto.targetId);
      if (!target.giftsEnabled) {
        throw new ForbiddenException('Gifts are disabled on this post');
      }
      recipientId = target.recipientId;
    } else {
      const target = await this.storiesService.getGiftTarget(dto.targetId);
      recipientId = target.recipientId;
    }

    if (recipientId === senderId) {
      throw new BadRequestException('You cannot gift your own content');
    }
    if (await this.followsService.isBlocked(senderId, recipientId)) {
      throw new ForbiddenException('You cannot gift this content');
    }

    const coinsCost = this.effectiveCost(gift);

    const transaction = await this.giftTransactionRepository.save(
      this.giftTransactionRepository.create({
        giftId: gift.id,
        senderId,
        recipientId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        coinsCost,
      }),
    );

    await this.coinsService.debitBalance(senderId, coinsCost, CoinTransactionType.GIFT_SENT, transaction.id);
    const recipientShare = Math.floor(coinsCost * RECIPIENT_SHARE);
    if (recipientShare > 0) {
      await this.coinsService.creditBalance(
        recipientId,
        recipientShare,
        CoinTransactionType.GIFT_RECEIVED_CREDIT,
        transaction.id,
      );
    }

    if (dto.targetType === GiftTargetType.POST) {
      await this.postsService.incrementGiftsCount(dto.targetId);
    } else {
      await this.storiesService.incrementGiftsCount(dto.targetId);
    }

    await this.gamificationService.awardXp(senderId, XpSource.GIFT_GIVEN_BONUS, 5, transaction.id);
    await this.gamificationService.recordGiftGiven(senderId);
    await this.gamificationService.recordGiftReceived(recipientId);

    await this.notificationsService.notify(
      recipientId,
      senderId,
      NotificationType.GIFT_RECEIVED,
      dto.targetType === GiftTargetType.POST ? NotificationTargetType.POST : NotificationTargetType.STORY,
      dto.targetId,
    );

    return transaction;
  }

  async claimDaily(userId: string): Promise<void> {
    if (await this.coinsService.hasClaimedFreeGiftToday(userId)) {
      throw new BadRequestException('Daily free gift already claimed today');
    }
    await this.coinsService.creditBalance(userId, DAILY_FREE_GIFT_COINS, CoinTransactionType.DAILY_FREE_GIFT);
    await this.coinsService.markDailyGiftClaimed(userId);
  }
}
