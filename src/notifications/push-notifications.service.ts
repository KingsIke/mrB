import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Notification, NotificationType } from './entities/notification.entity';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_API = 'https://exp.host/--/api/v2/push/send';

const NOTIFICATION_MESSAGES: Record<
  NotificationType,
  { title: string; body: (actorName: string, extra?: string) => string }
> = {
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
    body: (actorName) => `${actorName} tagged you in a post`,
  },
  [NotificationType.PAST_QUESTION_UPLOADED]: {
    title: 'New Past Question 📝',
    body: (actorName) => `${actorName} uploaded a new past question`,
  },
  [NotificationType.WAR_CHALLENGED]: {
    title: '⚔️ Battle Challenge!',
    body: (actorName) => `${actorName} challenged you to a quiz battle!`,
  },
  [NotificationType.WAR_BATTLE_WON]: {
    title: '🏆 Victory!',
    body: (_actorName, extra) => `You won the battle! ${extra ?? ''}`,
  },
  [NotificationType.WAR_BATTLE_LOST]: {
    title: '💔 Defeated',
    body: (_actorName, extra) => `You lost the battle. ${extra ?? ''}`,
  },
  [NotificationType.WAR_BATTLE_DRAW]: {
    title: '🤝 Draw!',
    body: () => `The battle ended in a draw!`,
  },
  [NotificationType.WAR_SCHEDULED_REMINDER]: {
    title: '📅 Battle Starting Soon!',
    body: (actorName, extra) => `Your battle with ${actorName} starts${extra ? ` ${extra}` : ' in 30 minutes'}!`,
  },
  [NotificationType.TREASURE_HUNT_CREATED]: {
    title: '🗺️ Treasure Hunt!',
    body: (_actorName, extra) => `A new treasure hunt has appeared! ${extra ?? 'Open the app to find it!'}`,
  },
  [NotificationType.TREASURE_HUNT_REMINDER]: {
    title: '🗺️ Treasure Still Available!',
    body: (_actorName, extra) => `${extra ?? 'A treasure hunt is still waiting to be claimed!'}`,
  },
};

const ANDROID_CHANNEL_ID: Record<string, string> = {
  default: 'default_3',
  social: 'social_v2',
  messages: 'messages_v2',
  gifts: 'gifts_v2',
  system: 'system_v2',
  calls: 'calls_v1',
};

const CHANNEL_MAP: Record<NotificationType, string> = {
  [NotificationType.WAR_CHALLENGED]: 'default',
  [NotificationType.WAR_BATTLE_WON]: 'default',
  [NotificationType.WAR_BATTLE_LOST]: 'default',
  [NotificationType.WAR_BATTLE_DRAW]: 'default',
  [NotificationType.WAR_SCHEDULED_REMINDER]: 'default',
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
  [NotificationType.TREASURE_HUNT_CREATED]: 'system',
  [NotificationType.TREASURE_HUNT_REMINDER]: 'system',
};

/** Check if a token is an Expo push token */
function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}


@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  onModuleInit() {
    this.logger.log('[Push] Push notification service ready (Expo Push API)');
  }

  /**
   * Save or update a user's push token.
   * Disassociates this token from any other accounts on the same device.
   */
  async registerToken(userId: string, pushToken: string): Promise<{ success: boolean }> {
    this.logger.log(`[Push] Registering token for user ${userId}: ${pushToken.substring(0, 30)}...`);

    // 1. Clear token from any other user accounts using this same physical device
    await this.userRepository.update(
      { pushToken, id: Not(userId) },
      { pushToken: null },
    );

    // 2. Assign the token to the current user
    await this.userRepository.update(userId, { pushToken });

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'pushToken'],
    });

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
    actorId?: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'pushToken', 'notificationPreferences'],
    });

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

    const payloadData: Record<string, string> = {
      type,
      title: messageConfig.title,
      body: messageConfig.body(actorName, extra),
      senderName: actorName,
      ...(actorId ? { senderId: actorId } : {}),
      ...Object.entries(data ?? {}).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
    };

    const channelId = ANDROID_CHANNEL_ID[CHANNEL_MAP[type] ?? 'default'];

    await this.sendExpoSingle(
      user.pushToken,
      messageConfig.title,
      messageConfig.body(actorName, extra),
      payloadData,
      channelId,
    );
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
    actorId?: string,
  ): Promise<void> {
    if (!userIds.length) return;

    const users = await this.userRepository.find({
      where: userIds.map((id) => ({ id })),
      select: ['id', 'pushToken'],
    });

    const messageConfig = NOTIFICATION_MESSAGES[type];
    if (!messageConfig) return;

    const channelId = ANDROID_CHANNEL_ID[CHANNEL_MAP[type] ?? 'default'];

    const payloadData = {
      type,
      ...(actorId ? { senderId: actorId } : {}),
      ...(data ?? {}),
    };

    const tokens = users
      .filter((u) => u.pushToken)
      .map((u) => u.pushToken!);

    const skipped = users.length - tokens.length;
    if (skipped > 0) {
      this.logger.warn(`[Push] ${skipped}/${users.length} users had no push token for ${type}`);
    }

    if (tokens.length) {
      const expoData: Record<string, string> = {
        type,
        title: messageConfig.title,
        body: messageConfig.body(actorName, extra),
        senderName: actorName,
        ...(actorId ? { senderId: actorId } : {}),
        ...Object.entries(data ?? {}).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
      };
      await this.sendExpoBatch(
        tokens,
        messageConfig.title,
        messageConfig.body(actorName, extra),
        expoData,
        channelId,
      );
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

    const expoData: Record<string, string> = data
      ? Object.entries(data).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
      : {};

    await this.sendExpoSingle(
      user.pushToken,
      title,
      body,
      expoData,
      ANDROID_CHANNEL_ID.default,
    );
  }

  /**
   * Send a push notification to a single device via Expo Push Service.
   */
  private async sendExpoSingle(
    token: string,
    title: string,
    body: string,
    data: Record<string, string>,
    channelId: string = 'default_3',
  ): Promise<void> {
    try {
      const payload: Record<string, any> = {
        to: token,
        title,
        body,
        data,
        priority: 'high',
        ...(channelId ? { channelId } : {}),
      };

      const response = await fetch(EXPO_PUSH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json() as any;

      if (result.data?.id) {
        this.logger.log(`[Push] Expo ticket: ${result.data.id}`);
      }

      // Handle errors — Expo returns per-ticket errors
      if (result.data?.status === 'error') {
        const error = result.data;
        if (
          error.message?.includes('InvalidCredentials') ||
          error.message?.includes('DeviceNotRegistered')
        ) {
          this.logger.log(`[Push] Removing invalid Expo token: ${token.substring(0, 30)}...`);
          await this.userRepository.update({ pushToken: token }, { pushToken: null });
        } else {
          this.logger.warn(`[Push] Expo push error: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to send Expo push notification', error);
    }
  }

  /**
   * Send batch of messages via Expo Push Service.
   * Expo allows up to 100 messages per batch.
   */
  private async sendExpoBatch(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, string>,
    channelId: string = 'default_3',
  ): Promise<void> {
    for (let i = 0; i < tokens.length; i += 100) {
      const chunk = tokens.slice(i, i + 100);
      try {
        this.logger.log(`[Push] Sending Expo batch to ${chunk.length} devices`);

        const messages = chunk.map((token) => ({
          to: token,
          title,
          body,
          data,
          priority: 'high',
          ...(channelId ? { channelId } : {}),
        }));

        const response = await fetch(EXPO_PUSH_BATCH_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });

        const result = await response.json() as any;
        const tickets = result.data || [];

        // Handle per-ticket errors
        for (let idx = 0; idx < tickets.length; idx++) {
          const ticket = tickets[idx];
          if (ticket.status === 'error') {
            const error = ticket.message || ticket.details?.error;
            if (
              error === 'DeviceNotRegistered' ||
              error === 'InvalidCredentials'
            ) {
              this.logger.log(`[Push] Removing invalid Expo token: ${chunk[idx].substring(0, 30)}...`);
              await this.userRepository.update({ pushToken: chunk[idx] }, { pushToken: null });
            } else {
              this.logger.warn(`[Push] Expo error for token: ${error}`);
            }
          }
        }

        const successCount = tickets.filter((t: any) => t.status === 'ok').length;
        this.logger.log(`[Push] Expo: ${successCount}/${chunk.length} sent successfully`);
      } catch (error) {
        this.logger.error('Failed to send Expo push notifications', error);
      }
    }
  }
}
