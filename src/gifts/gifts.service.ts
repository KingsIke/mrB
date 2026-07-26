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
  // Don't duplicate seed files if data already exists
  if (count > 0) return;

  const catalog = [
    // COMMON
    { name: 'Rose', emoji: '🌹', coinCost: 1, rarity: 'common', animation: 'float' },
    { name: 'Heart', emoji: '💗', coinCost: 2, rarity: 'common', animation: 'pulse' },
    { name: 'Finger Heart', emoji: '🫰', coinCost: 5, rarity: 'common', animation: 'bounce' },
    { name: 'Good Game', emoji: '🎮', coinCost: 10, rarity: 'common', animation: 'shake' },
    { name: 'Applause', emoji: '👏', coinCost: 10, rarity: 'common', animation: 'bounce' },
    { name: 'Lit / Fire', emoji: '🔥', coinCost: 3, rarity: 'common', animation: 'fire' },
    { name: 'Spicy Hot', emoji: '🌶️', coinCost: 4, rarity: 'common', animation: 'fire' },
    { name: 'Thumbs Up', emoji: '👍', coinCost: 1, rarity: 'common', animation: 'bounce' },
    { name: 'Little Star', emoji: '⭐', coinCost: 10, rarity: 'common', animation: 'sparkle' },
    { name: 'Party Balloon', emoji: '🎈', coinCost: 7, rarity: 'common', animation: 'float' },
    { name: 'Sweet Pop', emoji: '🍭', coinCost: 9, rarity: 'common', animation: 'spin' },
    { name: 'Paper Tiara', emoji: '👑', coinCost: 12, rarity: 'common', animation: 'drop' },
    { name: 'Spill the Tea', emoji: '🍵', coinCost: 15, rarity: 'common', animation: 'float' },
    { name: 'Morning Coffee', emoji: '☕', coinCost: 18, rarity: 'common', animation: 'float' },

    // RARE
    { name: 'Ice Cream Cone', emoji: '🍦', coinCost: 20, rarity: 'rare', animation: 'spin' },
    { name: 'Designer Scent', emoji: '🧴', coinCost: 50, rarity: 'rare', animation: 'sparkle' },
    { name: 'Clout Goggles', emoji: '😎', coinCost: 75, rarity: 'rare', animation: 'bounce' },
    { name: 'Golden Mic', emoji: '🎤', coinCost: 150, rarity: 'rare', animation: 'sparkle' },
    { name: 'Galaxy Donut', emoji: '🍩', coinCost: 25, rarity: 'rare', animation: 'spin' },
    { name: 'Boba Milk Tea', emoji: '🧋', coinCost: 30, rarity: 'rare', animation: 'float' },
    { name: 'Pizza Party', emoji: '🍕', coinCost: 35, rarity: 'rare', animation: 'drop' },
    { name: 'Cat Paw', emoji: '🐾', coinCost: 40, rarity: 'rare', animation: 'bounce' },
    { name: 'Hypebeast Kick', emoji: '👟', coinCost: 60, rarity: 'rare', animation: 'drive' },
    { name: 'Pro Controller', emoji: '🕹️', coinCost: 80, rarity: 'rare', animation: 'shake' },
    { name: 'Neon Glow', emoji: '💖', coinCost: 95, rarity: 'rare', animation: 'pulse' },
    { name: 'Groove Ball', emoji: '🪩', coinCost: 110, rarity: 'rare', animation: 'spin' },
    { name: 'Spellcast', emoji: '🪄', coinCost: 130, rarity: 'rare', animation: 'magic' },
    { name: 'Kickflip', emoji: '🛹', coinCost: 140, rarity: 'rare', animation: 'drive' },
    { name: 'Giant Teddy', emoji: '🧸', coinCost: 160, rarity: 'rare', animation: 'drop' },
    { name: 'Bubbly Pop', emoji: '🍾', coinCost: 188, rarity: 'rare', animation: 'explode' },

    // EPIC
    { name: 'V10 Supercar', emoji: '🏎️', coinCost: 500, rarity: 'epic', animation: 'drive' },
    { name: 'Rocket Rush', emoji: '🚀', coinCost: 800, rarity: 'epic', animation: 'rocket' },
    { name: 'Raw Diamond', emoji: '💎', coinCost: 1000, rarity: 'epic', animation: 'sparkle' },
    { name: 'Club DJ Night', emoji: '🎧', coinCost: 1200, rarity: 'epic', animation: 'shake' },
    { name: 'Cash Rain', emoji: '💸', coinCost: 250, rarity: 'epic', animation: 'rain' },
    { name: 'Lucky Zen Koi', emoji: '🎏', coinCost: 300, rarity: 'epic', animation: 'float' },
    { name: 'Rock Shredder', emoji: '🎸', coinCost: 400, rarity: 'epic', animation: 'shake' },
    { name: 'Sky Wanderer', emoji: '🎈', coinCost: 450, rarity: 'epic', animation: 'float' },
    { name: 'Cyber Chopper', emoji: '🏍️', coinCost: 600, rarity: 'epic', animation: 'drive' },
    { name: 'Maneki Neko', emoji: '🐱', coinCost: 700, rarity: 'epic', animation: 'magic' },
    { name: 'Emperor Crown', emoji: '👑', coinCost: 900, rarity: 'epic', animation: 'drop' },
    { name: 'Stardust Horn', emoji: '🦄', coinCost: 1100, rarity: 'epic', animation: 'fly' },
    { name: 'Deep Sea Dive', emoji: '🦭', coinCost: 1300, rarity: 'epic', animation: 'sail' },
    { name: 'Flawless Ring', emoji: '💍', coinCost: 1450, rarity: 'epic', animation: 'spin' },

    // LEGENDARY
    { name: 'Hyper Yacht', emoji: '🚢', coinCost: 3000, rarity: 'legendary', animation: 'sail' },
    { name: 'The TikTok Lion', emoji: '🦁', coinCost: 5000, rarity: 'legendary', animation: 'shake' },
    { name: 'Sky High Palace', emoji: '🏰', coinCost: 7000, rarity: 'legendary', animation: 'drop' },
    { name: 'Ancient Dragon', emoji: '🐉', coinCost: 8888, rarity: 'legendary', animation: 'fly' },
    { name: 'Gulfstream Jet', emoji: '🛩️', coinCost: 2000, rarity: 'legendary', animation: 'fly' },
    { name: 'Ocean Titan', emoji: '🛳️', coinCost: 2500, rarity: 'legendary', animation: 'sail' },
    { name: 'Astral Pegasus', emoji: '🦄', coinCost: 3500, rarity: 'legendary', animation: 'fly' },
    { name: 'Apex Chopper', emoji: '🚁', coinCost: 4000, rarity: 'legendary', animation: 'fly' },
    { name: 'Deep Blue Splash', emoji: '🐋', coinCost: 4500, rarity: 'legendary', animation: 'float' },
    { name: 'Imperial Statue', emoji: '🏆', coinCost: 5500, rarity: 'legendary', animation: 'drop' },
    { name: 'Desert Riddle', emoji: '🗿', coinCost: 6000, rarity: 'legendary', animation: 'drop' },
    { name: 'Lava Eruption', emoji: '🌋', coinCost: 6666, rarity: 'legendary', animation: 'explode' },
    { name: 'Firebirds Return', emoji: '🔥', coinCost: 8000, rarity: 'legendary', animation: 'fire' },
    { name: 'Olympus Shock', emoji: '⚡', coinCost: 9500, rarity: 'legendary', animation: 'magic' },

    // MYTHIC
    { name: 'Supernova Galaxy', emoji: '🌌', coinCost: 10000, rarity: 'mythic', animation: 'cosmic' },
    { name: 'Golden Phoenix', emoji: '🦅', coinCost: 15000, rarity: 'mythic', animation: 'fire' },
    { name: 'Wormhole Portal', emoji: '🪐', coinCost: 20000, rarity: 'mythic', animation: 'cosmic' },
    { name: 'Neo-Tokyo City', emoji: '🏙️', coinCost: 25000, rarity: 'mythic', animation: 'magic' },
    { name: 'Cosmic Singularity', emoji: '🕳️', coinCost: 30000, rarity: 'mythic', animation: 'cosmic' },
    { name: 'Solar Storm Lights', emoji: '✨', coinCost: 35000, rarity: 'mythic', animation: 'sparkle' },
    { name: 'Chronos Drive', emoji: '⏳', coinCost: 40000, rarity: 'mythic', animation: 'magic' },
    { name: 'Digital Rebirth', emoji: '💾', coinCost: 45000, rarity: 'mythic', animation: 'magic' },
    { name: 'Sunken Continent', emoji: '🔱', coinCost: 50000, rarity: 'mythic', animation: 'sail' },
    { name: 'Zodiac Alignment', emoji: '☄️', coinCost: 60000, rarity: 'mythic', animation: 'cosmic' },
    { name: 'Star Destroyer', emoji: '💥', coinCost: 75000, rarity: 'mythic', animation: 'explode' },
    { name: 'Cosmic Origin', emoji: '⚛️', coinCost: 99999, rarity: 'mythic', animation: 'cosmic' }
  ];

  for (const item of catalog) {
    // isActive true confirms they surface in queries immediately
    await this.giftRepository.save(
      this.giftRepository.create({
        ...item,
        isActive: true
      })
    );
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
    const xpAwarded = coinsCost;
    await this.gamificationService.awardXp(senderId, XpSource.GIFT_GIVEN_BONUS, xpAwarded, transaction.id);
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
