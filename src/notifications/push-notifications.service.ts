import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NotificationType } from './entities/notification.entity';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const NOTIFICATION_MESSAGES: Record<NotificationType, { title: string; body: (actorName: string, extra?: string) => string }> = {
  [NotificationType.POST_LIKED]: {
    title: 'New Like ❤️',
    body: (actorName) => `${actorName} liked your post`,
  },
  [NotificationType.POST_COMMENTED]: {
    title: 'New Comment 💬',
    body: (actorName) => `${actorName} commented on your post`,
  },
  [NotificationType.POST_RESHARED]: {
    title: 'Post Reshared 🔁',
    body: (actorName) => `${actorName} reshared your post`,
  },
  [NotificationType.COMMENT_LIKED]: {
    title: 'Comment Liked ❤️',
    body: (actorName) => `${actorName} liked your comment`,
  },
  [NotificationType.COMMENT_REPLIED]: {
    title: 'Reply to Comment 💬',
    body: (actorName) => `${actorName} replied to your comment`,
  },
  [NotificationType.GIFT_RECEIVED]: {
    title: 'Gift Received 🎁',
    body: (actorName) => `${actorName} sent you a gift!`,
  },
  [NotificationType.LEVEL_UP]: {
    title: 'Level Up! 🎉',
    body: (_actorName, extra) => `You reached ${extra ?? 'a new level'}!`,
  },
  [NotificationType.STORY_REPLY]: {
    title: 'Story Reply 💬',
    body: (actorName) => `${actorName} replied to your story`,
  },
  [NotificationType.STORY_REACTION]: {
    title: 'Story Reaction ❤️',
    body: (actorName) => `${actorName} reacted to your story`,
  },
  [NotificationType.GROUP_MESSAGE]: {
    title: 'New Message 💬',
    body: (actorName) => `${actorName} sent you a message`,
  },
  [NotificationType.PAST_QUESTION_PURCHASED]: {
    title: 'Purchase Confirmed ✅',
    body: () => `Your past question purchase was successful`,
  },
  [NotificationType.HOSTEL_LIKED]: {
    title: 'Listing Liked ❤️',
    body: (actorName) => `${actorName} liked your hostel listing`,
  },
  [NotificationType.MARKETPLACE_LIKED]: {
    title: 'Listing Liked ❤️',
    body: (actorName) => `${actorName} liked your marketplace item`,
  },
  [NotificationType.EVENT_RSVP]: {
    title: 'Event RSVP 📅',
    body: (actorName, extra) => `${actorName} RSVP'd to ${extra ?? 'an event'}`,
  },
  [NotificationType.NEW_FOLLOWER]: {
    title: 'New Follower 👤',
    body: (actorName) => `${actorName} started following you`,
  },
  [NotificationType.MARKETPLACE_ITEM_LISTED]: {
    title: 'New Marketplace Listing 🛒',
    body: (actorName) => `${actorName} listed a new item on the marketplace`,
  },
  [NotificationType.HOSTEL_LISTED]: {
    title: 'New Hostel Listing 🏠',
    body: (actorName) => `${actorName} posted a new hostel listing`,
  },
  [NotificationType.EVENT_CREATED]: {
    title: 'New Event 📅',
    body: (actorName) => `${actorName} created a new event`,
  },
  [NotificationType.POST_TAGGED]: {
    title: 'You Were Tagged 🏷️',
    body: (actorName) => actorName + ' tagged you in a post',
  },
  [NotificationType.PAST_QUESTION_UPLOADED]: {
    title: 'New Past Question 📝',
    body: (actorName) => `${actorName} uploaded a new past question`,
  },
};

/**
 * Maps each notification type to an Android notification channel.
 * The channel determines the sound & vibration pattern on Android.
 *
 * Channels must match the IDs created on the client in usePushNotifications.ts:
 *   "default"  – general
 *   "social"   – likes, comments, follows, shares, story reactions
 *   "messages" – group / DM messages
 *   "gifts"    – gift received
 *   "system"   – level ups, purchases, uploads
 */
const CHANNEL_MAP: Record<NotificationType, string> = {
  [NotificationType.POST_LIKED]: 'social',
  [NotificationType.POST_COMMENTED]: 'social',
  [NotificationType.POST_RESHARED]: 'social',
  [NotificationType.COMMENT_LIKED]: 'social',
  [NotificationType.COMMENT_REPLIED]: 'social',
  [NotificationType.GIFT_RECEIVED]: 'gifts',
  [NotificationType.LEVEL_UP]: 'system',
  [NotificationType.STORY_REPLY]: 'social',
  [NotificationType.STORY_REACTION]: 'social',
  [NotificationType.GROUP_MESSAGE]: 'messages',
  [NotificationType.PAST_QUESTION_PURCHASED]: 'system',
  [NotificationType.HOSTEL_LIKED]: 'social',
  [NotificationType.MARKETPLACE_LIKED]: 'social',
  [NotificationType.EVENT_RSVP]: 'social',
  [NotificationType.NEW_FOLLOWER]: 'social',
  [NotificationType.MARKETPLACE_ITEM_LISTED]: 'social',
  [NotificationType.HOSTEL_LISTED]: 'social',
  [NotificationType.EVENT_CREATED]: 'social',
  [NotificationType.POST_TAGGED]: 'social',
  [NotificationType.PAST_QUESTION_UPLOADED]: 'system',
};

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  badge?: number;
  data?: Record<string, unknown>;
  channelId?: string;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Save or update a user's Expo push token.
   */
  async registerToken(userId: string, pushToken: string): Promise<{ success: boolean }> {
    this.logger.log(`[Push] Registering token for user ${userId}: ${pushToken.substring(0, 30)}...`);
    await this.userRepository.update(userId, { pushToken });
    const user = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'pushToken', 'notificationPreferences'] });
    if (user?.pushToken === pushToken) {
      this.logger.log(`[Push] Token verified in DB for user ${userId}`);
    } else {
      this.logger.warn(`[Push] Token verification FAILED for user ${userId}. DB has: ${user?.pushToken ?? 'null'}`);
    }
    return { success: true };
  }

  /**
   * Remove a user's push token (e.g. on logout).
   */
  async unregisterToken(userId: string): Promise<{ success: boolean }> {
    this.logger.log(`[Push] Unregistering token for user ${userId}`);
    await this.userRepository.update(userId, { pushToken: null });
    return { success: true };
  }

  /**
   * Send a push notification to a single user.
   */
  async sendToUser(
    userId: string,
    type: NotificationType,
    actorName: string,
    extra?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'pushToken'] });
    if (!user?.pushToken) {
      this.logger.warn(`[Push] No push token for user ${userId} — skipping push for ${type}`);
      return;
    }

    // Check user notification preferences
    const prefs = user.notificationPreferences;
    if (prefs) {
      if (prefs.pushEnabled === false) return;
      const channel = CHANNEL_MAP[type] ?? 'default';
      if (prefs[channel] === false) {
        this.logger.log(`[Push] User ${userId} has ${channel} channel muted - skipping ${type}`);
        return;
      }
    }

    this.logger.log(`[Push] Sending ${type} to user ${userId} via token ${user.pushToken.substring(0, 30)}...`);

    const messageConfig = NOTIFICATION_MESSAGES[type];
    if (!messageConfig) {
      this.logger.warn(`[Push] No message config for notification type: ${type}`);
      return;
    }

    const message: ExpoPushMessage = {
      to: user.pushToken,
      title: messageConfig.title,
      body: messageConfig.body(actorName, extra),
      sound: 'default',
      channelId: CHANNEL_MAP[type] ?? 'default',
      data: data ?? { type },
    };

    await this.sendBatch([message]);
  }

  /**
   * Send push notifications to multiple users at once.
   */
  async sendToUsers(
    userIds: string[],
    type: NotificationType,
    actorName: string,
    extra?: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!userIds.length) return;

    const users = await this.userRepository.find({
      where: { id: { $in: userIds } as any },
      select: ['id', 'pushToken'],
    });

    const messageConfig = NOTIFICATION_MESSAGES[type];
    if (!messageConfig) return;

    const channelId = CHANNEL_MAP[type] ?? 'default';

    const messages: ExpoPushMessage[] = users
      .filter((u) => u.pushToken)
      .map((u) => ({
        to: u.pushToken!,
        title: messageConfig.title,
        body: messageConfig.body(actorName, extra),
        sound: 'default',
        channelId,
        data: data ?? { type },
      }));

    const skipped = users.length - messages.length;
    if (skipped > 0) {
      this.logger.warn(`[Push] ${skipped}/${users.length} users had no push token for ${type}`);
    }

    if (messages.length) {
      await this.sendBatch(messages);
    }
  }

  /**
   * Send a custom push notification.
   */
  async sendCustom(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId }, select: ['id', 'pushToken'] });
    if (!user?.pushToken) {
      this.logger.warn(`[Push] No push token for user ${userId} — skipping custom push`);
      return;
    }

    await this.sendBatch([
      {
        to: user.pushToken,
        title,
        body,
        sound: 'default',
        channelId: 'default',
        data,
      },
    ]);
  }

  /**
   * Send batch of messages to Expo Push API.
   * Expo allows up to 100 messages per request.
   */
  private async sendBatch(messages: ExpoPushMessage[]): Promise<void> {
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        this.logger.log(`[Push] Sending batch of ${chunk.length} messages to Expo`);
        const response = await axios.post(EXPO_PUSH_URL, chunk, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.data?.data) {
          const errors = response.data.data.filter((r: any) => r.status === 'error');
          if (errors.length) {
            this.logger.warn(`Expo push errors: ${JSON.stringify(errors)}`);
            for (const err of errors) {
              if (err.message?.includes('InvalidCredentials') || err.message?.includes('DeviceNotRegistered')) {
                const token = err.to;
                if (token) {
                  await this.userRepository.update({ pushToken: token }, { pushToken: null });
                  this.logger.log(`Removed invalid push token: ${token}`);
                }
              }
            }
          } else {
            this.logger.log(`[Push] All ${chunk.length} messages accepted by Expo`);
          }
        }
      } catch (error) {
        this.logger.error('Failed to send Expo push notifications', error);
      }
    }
  }
}
