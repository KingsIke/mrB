import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gift } from './entities/gift.entity';
import { GiftTransaction, GiftTargetType } from './entities/gift-transaction.entity';
import { SendGiftDto } from './dto/send-gift.dto';
import { CoinsService, COIN_RATE_NGN } from '../coins/coins.service';
import { CoinTransactionType } from '../coins/entities/coin-transaction.entity';
import { GamificationService } from '../gamification/gamification.service';
import { XpSource } from '../gamification/entities/xp-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationTargetType, NotificationType } from '../notifications/entities/notification.entity';
import { PostsService } from '../posts/posts.service';
import { StoriesService } from '../stories/stories.service';
import { FollowsService } from '../follows/follows.service';
import { GroupsService } from '../groups/groups.service';
import { GroupsGateway } from '../groups/groups.gateway';
import { PostsGateway } from '../posts/posts.gateway';
import { CreateGiftDto } from './dto/create-gift.dto';
import { GroupMember } from '../groups/entities/group-member.entity';
import { User } from '../users/entities/user.entity';

const RECIPIENT_SHARE = 0.5; 
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
    private readonly groupsService: GroupsService,
    private readonly groupsGateway: GroupsGateway,
    private readonly postsGateway: PostsGateway,
    @InjectRepository(GroupMember)
    private readonly groupMemberRepository: Repository<GroupMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async listGifts(): Promise<Gift[]> {
    return this.giftRepository.find({ where: { isActive: true } });
  }

  async seedGifts(): Promise<void> {
    const count = await this.giftRepository.count();
    if (count > 0) return;

  const catalog = [
  // COMMON
  { name: 'Rose', coinCost: 1, rarity: 'common', animation: 'float', videoUrl: 'https://res.cloudinary.com/dyz7znlj0/video/upload/v1786898988/WhatsApp_Video_2026-08-16_at_17.31.44_bsjcmf.mp4' },
  { name: 'Heart', coinCost: 2, rarity: 'common', animation: 'pulse', videoUrl: 'https://res.cloudinary.com/dyz7znlj0/video/upload/v1786899004/WhatsApp_Video_2026-08-16_at_17.31.41_e106mr.mp4' },
  { name: 'Finger Heart', coinCost: 5, rarity: 'common', animation: 'bounce', videoUrl: 'https://res.cloudinary.com/dyz7znlj0/video/upload/v1786899863/WhatsApp_Video_2026-08-16_at_17.52.43_pfrsve.mp4' },
  { name: 'Good Game', coinCost: 10, rarity: 'common', animation: 'shake', videoUrl: 'https://assets.app.com/gifts/videos/common/good-game.mp4' },
  { name: 'Applause', coinCost: 10, rarity: 'common', animation: 'bounce', videoUrl: 'https://assets.app.com/gifts/videos/common/applause.mp4' },
  { name: 'Lit / Fire', coinCost: 3, rarity: 'common', animation: 'fire', videoUrl: 'https://assets.app.com/gifts/videos/common/lit-fire.mp4' },
  { name: 'Spicy Hot', coinCost: 4, rarity: 'common', animation: 'fire', videoUrl: 'https://assets.app.com/gifts/videos/common/spicy-hot.mp4' },
  { name: 'Thumbs Up', coinCost: 1, rarity: 'common', animation: 'bounce', videoUrl: 'https://assets.app.com/gifts/videos/common/thumbs-up.mp4' },
  { name: 'Little Star', coinCost: 10, rarity: 'common', animation: 'sparkle', videoUrl: 'https://assets.app.com/gifts/videos/common/little-star.mp4' },
  { name: 'Party Balloon', coinCost: 7, rarity: 'common', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/common/party-balloon.mp4' },
  { name: 'Sweet Pop', coinCost: 9, rarity: 'common', animation: 'spin', videoUrl: 'https://assets.app.com/gifts/videos/common/sweet-pop.mp4' },
  { name: 'Paper Tiara', coinCost: 12, rarity: 'common', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/common/paper-tiara.mp4' },
  { name: 'Spill the Tea', coinCost: 15, rarity: 'common', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/common/spill-tea.mp4' },
  { name: 'Morning Coffee', coinCost: 18, rarity: 'common', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/common/morning-coffee.mp4' },

  // RARE
  { name: 'Ice Cream Cone', coinCost: 20, rarity: 'rare', animation: 'spin', videoUrl: 'https://assets.app.com/gifts/videos/rare/ice-cream-cone.mp4' },
  { name: 'Designer Scent', coinCost: 50, rarity: 'rare', animation: 'sparkle', videoUrl: 'https://assets.app.com/gifts/videos/rare/designer-scent.mp4' },
  { name: 'Clout Goggles', coinCost: 75, rarity: 'rare', animation: 'bounce', videoUrl: 'https://assets.app.com/gifts/videos/rare/clout-goggles.mp4' },
  { name: 'Golden Mic', coinCost: 150, rarity: 'rare', animation: 'sparkle', videoUrl: 'https://assets.app.com/gifts/videos/rare/golden-mic.mp4' },
  { name: 'Galaxy Donut', coinCost: 25, rarity: 'rare', animation: 'spin', videoUrl: 'https://assets.app.com/gifts/videos/rare/galaxy-donut.mp4' },
  { name: 'Boba Milk Tea', coinCost: 30, rarity: 'rare', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/rare/boba-milk-tea.mp4' },
  { name: 'Pizza Party', coinCost: 35, rarity: 'rare', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/rare/pizza-party.mp4' },
  { name: 'Cat Paw', coinCost: 40, rarity: 'rare', animation: 'bounce', videoUrl: 'https://assets.app.com/gifts/videos/rare/cat-paw.mp4' },
  { name: 'Hypebeast Kick', coinCost: 60, rarity: 'rare', animation: 'drive', videoUrl: 'https://assets.app.com/gifts/videos/rare/hypebeast-kick.mp4' },
  { name: 'Pro Controller', coinCost: 80, rarity: 'rare', animation: 'shake', videoUrl: 'https://assets.app.com/gifts/videos/rare/pro-controller.mp4' },
  { name: 'Neon Glow', coinCost: 95, rarity: 'rare', animation: 'pulse', videoUrl: 'https://assets.app.com/gifts/videos/rare/neon-glow.mp4' },
  { name: 'Groove Ball', coinCost: 110, rarity: 'rare', animation: 'spin', videoUrl: 'https://assets.app.com/gifts/videos/rare/groove-ball.mp4' },
  { name: 'Spellcast', coinCost: 130, rarity: 'rare', animation: 'magic', videoUrl: 'https://assets.app.com/gifts/videos/rare/spellcast.mp4' },
  { name: 'Kickflip', coinCost: 140, rarity: 'rare', animation: 'drive', videoUrl: 'https://assets.app.com/gifts/videos/rare/kickflip.mp4' },
  { name: 'Giant Teddy', coinCost: 160, rarity: 'rare', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/rare/giant-teddy.mp4' },
  { name: 'Bubbly Pop', coinCost: 188, rarity: 'rare', animation: 'explode', videoUrl: 'https://assets.app.com/gifts/videos/rare/bubbly-pop.mp4' },

  // EPIC
  { name: 'V10 Supercar', coinCost: 500, rarity: 'epic', animation: 'drive', videoUrl: 'https://assets.app.com/gifts/videos/epic/v10-supercar.mp4' },
  { name: 'Rocket Rush', coinCost: 800, rarity: 'epic', animation: 'rocket', videoUrl: 'https://assets.app.com/gifts/videos/epic/rocket-rush.mp4' },
  { name: 'Raw Diamond', coinCost: 1000, rarity: 'epic', animation: 'sparkle', videoUrl: 'https://assets.app.com/gifts/videos/epic/raw-diamond.mp4' },
  { name: 'Club DJ Night', coinCost: 1200, rarity: 'epic', animation: 'shake', videoUrl: 'https://assets.app.com/gifts/videos/epic/club-dj-night.mp4' },
  { name: 'Cash Rain', coinCost: 250, rarity: 'epic', animation: 'rain', videoUrl: 'https://assets.app.com/gifts/videos/epic/cash-rain.mp4' },
  { name: 'Lucky Zen Koi', coinCost: 300, rarity: 'epic', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/epic/lucky-zen-koi.mp4' },
  { name: 'Rock Shredder', coinCost: 400, rarity: 'epic', animation: 'shake', videoUrl: 'https://assets.app.com/gifts/videos/epic/rock-shredder.mp4' },
  { name: 'Sky Wanderer', coinCost: 450, rarity: 'epic', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/epic/sky-wanderer.mp4' },
  { name: 'Cyber Chopper', coinCost: 600, rarity: 'epic', animation: 'drive', videoUrl: 'https://assets.app.com/gifts/videos/epic/cyber-chopper.mp4' },
  { name: 'Maneki Neko', coinCost: 700, rarity: 'epic', animation: 'magic', videoUrl: 'https://assets.app.com/gifts/videos/epic/maneki-neko.mp4' },
  { name: 'Emperor Crown', coinCost: 900, rarity: 'epic', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/epic/emperor-crown.mp4' },
  { name: 'Stardust Horn', coinCost: 1100, rarity: 'epic', animation: 'fly', videoUrl: 'https://assets.app.com/gifts/videos/epic/stardust-horn.mp4' },
  { name: 'Deep Sea Dive', coinCost: 1300, rarity: 'epic', animation: 'sail', videoUrl: 'https://assets.app.com/gifts/videos/epic/deep-sea-dive.mp4' },
  { name: 'Flawless Ring', coinCost: 1450, rarity: 'epic', animation: 'spin', videoUrl: 'https://assets.app.com/gifts/videos/epic/flawless-ring.mp4' },

  // LEGENDARY
  { name: 'Hyper Yacht', coinCost: 3000, rarity: 'legendary', animation: 'sail', videoUrl: 'https://assets.app.com/gifts/videos/legendary/hyper-yacht.mp4' },
  { name: 'The TikTok Lion', coinCost: 5000, rarity: 'legendary', animation: 'shake', videoUrl: 'https://assets.app.com/gifts/videos/legendary/tiktok-lion.mp4' },
  { name: 'Sky High Palace', coinCost: 7000, rarity: 'legendary', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/legendary/sky-high-palace.mp4' },
  { name: 'Ancient Dragon', coinCost: 8888, rarity: 'legendary', animation: 'fly', videoUrl: 'https://assets.app.com/gifts/videos/legendary/ancient-dragon.mp4' },
  { name: 'Gulfstream Jet', coinCost: 2000, rarity: 'legendary', animation: 'fly', videoUrl: 'https://assets.app.com/gifts/videos/legendary/gulfstream-jet.mp4' },
  { name: 'Ocean Titan', coinCost: 2500, rarity: 'legendary', animation: 'sail', videoUrl: 'https://assets.app.com/gifts/videos/legendary/ocean-titan.mp4' },
  { name: 'Astral Pegasus', coinCost: 3500, rarity: 'legendary', animation: 'fly', videoUrl: 'https://assets.app.com/gifts/videos/legendary/astral-pegasus.mp4' },
  { name: 'Apex Chopper', coinCost: 4000, rarity: 'legendary', animation: 'fly', videoUrl: 'https://assets.app.com/gifts/videos/legendary/apex-chopper.mp4' },
  { name: 'Deep Blue Splash', coinCost: 4500, rarity: 'legendary', animation: 'float', videoUrl: 'https://assets.app.com/gifts/videos/legendary/deep-blue-splash.mp4' },
  { name: 'Imperial Statue', coinCost: 5500, rarity: 'legendary', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/legendary/imperial-statue.mp4' },
  { name: 'Desert Riddle', coinCost: 6000, rarity: 'legendary', animation: 'drop', videoUrl: 'https://assets.app.com/gifts/videos/legendary/desert-riddle.mp4' },
  { name: 'Lava Eruption', coinCost: 6666, rarity: 'legendary', animation: 'explode', videoUrl: 'https://assets.app.com/gifts/videos/legendary/lava-eruption.mp4' },
  { name: 'Firebirds Return', coinCost: 8000, rarity: 'legendary', animation: 'fire', videoUrl: 'https://assets.app.com/gifts/videos/legendary/firebirds-return.mp4' },
  { name: 'Olympus Shock', coinCost: 9500, rarity: 'legendary', animation: 'magic', videoUrl: 'https://assets.app.com/gifts/videos/legendary/olympus-shock.mp4' },

  // MYTHIC
  { name: 'Supernova Galaxy', coinCost: 10000, rarity: 'mythic', animation: 'cosmic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/supernova-galaxy.mp4' },
  { name: 'Golden Phoenix', coinCost: 15000, rarity: 'mythic', animation: 'fire', videoUrl: 'https://assets.app.com/gifts/videos/mythic/golden-phoenix.mp4' },
  { name: 'Wormhole Portal', coinCost: 20000, rarity: 'mythic', animation: 'cosmic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/wormhole-portal.mp4' },
  { name: 'Neo-Tokyo City', coinCost: 25000, rarity: 'mythic', animation: 'magic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/neo-tokyo-city.mp4' },
  { name: 'Cosmic Singularity', coinCost: 30000, rarity: 'mythic', animation: 'cosmic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/cosmic-singularity.mp4' },
  { name: 'Solar Storm Lights', coinCost: 35000, rarity: 'mythic', animation: 'sparkle', videoUrl: 'https://assets.app.com/gifts/videos/mythic/solar-storm-lights.mp4' },
  { name: 'Chronos Drive', coinCost: 40000, rarity: 'mythic', animation: 'magic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/chronos-drive.mp4' },
  { name: 'Digital Rebirth', coinCost: 45000, rarity: 'mythic', animation: 'magic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/digital-rebirth.mp4' },
  { name: 'Sunken Continent', coinCost: 50000, rarity: 'mythic', animation: 'sail', videoUrl: 'https://assets.app.com/gifts/videos/mythic/sunken-continent.mp4' },
  { name: 'Zodiac Alignment', coinCost: 60000, rarity: 'mythic', animation: 'cosmic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/zodiac-alignment.mp4' },
  { name: 'Star Destroyer', coinCost: 75000, rarity: 'mythic', animation: 'explode', videoUrl: 'https://assets.app.com/gifts/videos/mythic/star-destroyer.mp4' },
  { name: 'Cosmic Origin', coinCost: 99999, rarity: 'mythic', animation: 'cosmic', videoUrl: 'https://assets.app.com/gifts/videos/mythic/cosmic-origin.mp4' }
];

    for (const item of catalog) {
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
    } else if (dto.targetType === GiftTargetType.STORY) {
      const target = await this.storiesService.getGiftTarget(dto.targetId);
      recipientId = target.recipientId;
    } else if (dto.targetType === GiftTargetType.GROUP) {
      // targetId = groupId, recipientId = the member being gifted
      if (!dto.recipientId) {
        throw new BadRequestException('recipientId is required for group gifts');
      }
      // Validate the recipient is a member of this group
      const membership = await this.groupMemberRepository.findOne({
        where: { groupId: dto.targetId, userId: dto.recipientId },
      });
      if (!membership) {
        throw new BadRequestException('Recipient is not a member of this group');
      }
      recipientId = dto.recipientId;
    } else if (dto.targetType === GiftTargetType.DM) {
      // targetId = conversationId, recipientId = the other user
      if (!dto.recipientId) {
        throw new BadRequestException('recipientId is required for DM gifts');
      }
      recipientId = dto.recipientId;
    } else {
      throw new BadRequestException('Invalid target type');
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

    // 1. Debit purchasing coin balance from sender
    await this.coinsService.debitBalance(senderId, coinsCost, CoinTransactionType.GIFT_SENT, transaction.id);

    // 2. Calculate recipient cash share (NGN)
    const recipientCoins = Math.floor(coinsCost * RECIPIENT_SHARE);
    const recipientCashShareNgn = recipientCoins * COIN_RATE_NGN;

    // 3. Credit withdrawable earned gift balance
    if (recipientCashShareNgn > 0) {
      await this.coinsService.creditEarnedBalance(
        recipientId,
        recipientCashShareNgn,
        transaction.id,
      );
    }

    if (dto.targetType === GiftTargetType.POST) {
      await this.postsService.incrementGiftsCount(dto.targetId);
    } else if (dto.targetType === GiftTargetType.STORY) {
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
      dto.targetType === GiftTargetType.POST ? NotificationTargetType.POST : dto.targetType === GiftTargetType.DM ? NotificationTargetType.POST : NotificationTargetType.STORY,
      dto.targetId,
      undefined, // actorName — resolved inside notify()
      undefined, // extra
      {
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: '🎁',
        giftVideoUrl: gift.videoUrl || '',
        giftAnimationUrl: gift.animationUrl || '',
        giftCoinCost: gift.coinCost,
        giftRarity: gift.coinCost >= 1000 ? 'legendary' : gift.coinCost >= 100 ? 'epic' : 'rare',
        senderId,
        groupId: dto.targetType === GiftTargetType.GROUP || dto.targetType === GiftTargetType.DM ? dto.targetId : undefined,
      },
    );

    // Build the broadcast payload (shared across all target types)
    const buildBroadcastPayload = (senderUser: any) => ({
      senderId,
      senderName: senderUser?.username || 'Someone',
      gift: {
        id: gift.id,
        name: gift.name,
        icon: '🎁',
        coinCost: gift.coinCost,
        rarity: gift.coinCost >= 1000 ? 'legendary' : gift.coinCost >= 100 ? 'epic' : 'rare',
        animationUrl: gift.animationUrl,
        videoUrl: gift.videoUrl,
      },
      recipientId,
      comboCount: dto.comboCount ?? 1,
    });

    // Broadcast gift:sent to the appropriate room in real-time.
    // Fire-and-forget via setImmediate so the HTTP response isn't delayed
    // by the user lookup or WebSocket emit, which could otherwise cause
    // client-side ping timeouts when the event loop is busy.
    setImmediate(async () => {
      try {
        const senderUser = await this.userRepository.findOne({
          where: { id: senderId },
          select: ['id', 'username', 'profilePictureUrl'],
        });
        const payload = buildBroadcastPayload(senderUser);

        if (dto.targetType === GiftTargetType.POST) {
          this.postsGateway.broadcastToPostRoom(dto.targetId, 'gift:sent' as any, payload);
        } else if (
          dto.targetType === GiftTargetType.GROUP ||
          dto.targetType === GiftTargetType.DM
        ) {
          // Broadcast gift:sent to ALL online members in the room (overlay animation)
          this.groupsGateway.broadcastToGroup(dto.targetId, 'gift:sent' as any, payload);

          // Also send gift_received ONLY to the recipient so the client can
          // distinguish sender vs receiver (e.g. to show the received-gift
          // indicator, update coin balance, etc.).
          this.groupsGateway.sendToUser(recipientId, 'gift_received' as any, payload);
        }
      } catch (err) {
        // Non-critical: don't fail the transaction if broadcast fails
      }
    });

    return transaction;
  }


  async createGift(dto: CreateGiftDto): Promise<Gift> {
    const gift = this.giftRepository.create({
      ...dto,
      isActive: dto.isActive ?? true,
    });
    return this.giftRepository.save(gift);
  }
  async claimDaily(userId: string): Promise<void> {
    if (await this.coinsService.hasClaimedFreeGiftToday(userId)) {
      throw new BadRequestException('Daily free gift already claimed today');
    }
    await this.coinsService.creditBalance(userId, DAILY_FREE_GIFT_COINS, CoinTransactionType.DAILY_FREE_GIFT);
    await this.coinsService.markDailyGiftClaimed(userId);
  }
}
