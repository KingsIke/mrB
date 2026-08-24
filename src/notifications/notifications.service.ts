import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Notification, NotificationTargetType, NotificationType } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { PushNotificationsService } from './push-notifications.service';
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from '../common/pagination/cursor-pagination.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  /**
   * Derive a display name from a User row.
   * Always use the username for notifications.
   */
  private getActorDisplayName(user: User): string {
    return user.username ?? 'Someone';
  }

  /**
   * Build a human-readable notification message from type + actor name.
   */
  private buildMessage(
    type: NotificationType,
    actorName: string,
  ): string {
    switch (type) {
      case NotificationType.POST_LIKED:
        return `${actorName} liked your post`;
      case NotificationType.POST_COMMENTED:
        return `${actorName} commented on your post`;
      case NotificationType.POST_RESHARED:
        return `${actorName} reshared your post`;
      case NotificationType.COMMENT_LIKED:
        return `${actorName} liked your comment`;
      case NotificationType.COMMENT_REPLIED:
        return `${actorName} replied to your comment`;
      case NotificationType.GIFT_RECEIVED:
        return `${actorName} sent you a gift`;
      case NotificationType.LEVEL_UP:
        return `You leveled up!`;
      case NotificationType.STORY_REPLY:
        return `${actorName} replied to your story`;
      case NotificationType.STORY_REACTION:
        return `${actorName} reacted to your story`;
      case NotificationType.GROUP_MESSAGE:
        return `${actorName} sent you a message`;
      case NotificationType.PAST_QUESTION_PURCHASED:
        return `${actorName} purchased your past question`;
      case NotificationType.HOSTEL_LIKED:
        return `${actorName} liked your hostel listing`;
      case NotificationType.MARKETPLACE_LIKED:
        return `${actorName} liked your marketplace item`;
      case NotificationType.EVENT_RSVP:
        return `${actorName} RSVP'd to your event`;
      case NotificationType.NEW_FOLLOWER:
        return `${actorName} started following you`;
      case NotificationType.MARKETPLACE_ITEM_LISTED:
        return `${actorName} listed a new item on the marketplace`;
      case NotificationType.HOSTEL_LISTED:
        return `${actorName} posted a new hostel listing`;
      case NotificationType.EVENT_CREATED:
        return `${actorName} created a new event`;
      case NotificationType.POST_TAGGED:
        return `${actorName} tagged you in a post`;
      case NotificationType.PAST_QUESTION_UPLOADED:
        return `${actorName} uploaded a new past question`;
      default:
        return `${actorName} interacted with your content`;
    }
  }

  /**
   * @param pushData  Optional extra key/value pairs merged into the Expo push
   *                  notification `data` payload (e.g. `{ isDM: true }`).
   *                  The base payload always includes { notificationId, type, targetType, targetId }.
   */
  async notify(
    recipientId: string,
    actorId: string | null,
    type: NotificationType,
    targetType?: NotificationTargetType,
    targetId?: string,
    actorName?: string,
    extra?: string,
    pushData?: Record<string, unknown>,
  ): Promise<void> {
    // No self-notifications (e.g. liking your own post/comment).
    if (recipientId === actorId) return;

    // Resolve actor display name (used for both message and push)
    let resolvedName = actorName;
    if (!resolvedName && actorId) {
      try {
        const actor = await this.userRepository.findOne({
          where: { id: actorId },
          select: ['id', 'firstName', 'lastName', 'username'],
        });
        if (actor) resolvedName = this.getActorDisplayName(actor);
      } catch {
        // best-effort — push is optional
      }
    }

    const notification = this.notificationRepository.create({
      recipientId,
      actorId,
      type,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      message: resolvedName ? this.buildMessage(type, resolvedName) : null,
    });
    await this.notificationRepository.save(notification);

    // Send push notification when we have a name to show
    if (resolvedName) {
      try {
        await this.pushNotificationsService.sendToUser(
          recipientId,
          type,
          resolvedName,
          extra,
          { notificationId: notification.id, type, targetType, targetId, ...pushData },
        );
      } catch (err) {
        this.logger.warn(`Failed to send push notification: ${err}`);
      }
    }
  }

  async getUserPreferences(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'notificationPreferences'],
    });
  }

  async updateUserPreferences(userId: string, preferences: Record<string, boolean>): Promise<{ success: boolean }> {
    await this.userRepository.update(userId, { notificationPreferences: preferences });
    return { success: true };
  }

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPaginated<Notification>> {
    const limit = pagination.limit ?? 20;
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.actor', 'actor')
      .addSelect([
        'actor.firstName',
        'actor.lastName',
        'actor.username',
        'actor.profilePictureUrl',
      ])
      .where('notification.recipientId = :userId', { userId });

    if (pagination.cursor) {
      const { createdAt, id } = decodeCursor(pagination.cursor);
      qb.andWhere(
        '(notification.createdAt < :createdAt OR (notification.createdAt = :createdAt AND notification.id < :id))',
        { createdAt, id },
      );
    }

    qb.orderBy('notification.createdAt', 'DESC').addOrderBy('notification.id', 'DESC').take(limit + 1);

    const items = await qb.getMany();
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];

    return {
      items: page,
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({ where: { recipientId: userId, isRead: false } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    notification.isRead = true;
    await this.notificationRepository.save(notification);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ recipientId: userId, isRead: false }, { isRead: true });
  }

  /**
   * Notify every user in the same department as the actor, excluding the actor
   * themselves. Used for department-scoped items (past questions).
   */
  async notifyDepartmentmates(
    actorId: string,
    type: NotificationType,
    targetType: NotificationTargetType,
    targetId: string,
  ): Promise<void> {
    const actor = await this.userRepository.findOne({
      where: { id: actorId },
      select: ['id', 'departmentId', 'firstName', 'lastName', 'username'],
    });
    if (!actor?.departmentId) return;

    const actorName = this.getActorDisplayName(actor);

    const departmentmates = await this.userRepository.find({
      where: {
        departmentId: actor.departmentId,
        id: Not(actorId),
      },
      select: ['id'],
      take: 500,
    });

    if (departmentmates.length === 0) return;

    const message = this.buildMessage(type, actorName);
    const ids = departmentmates.map((u) => u.id);

    const notifications = ids.map((recipientId) =>
      this.notificationRepository.create({
        recipientId,
        actorId,
        type,
        targetType,
        targetId,
        message,
      }),
    );
    await this.notificationRepository.save(notifications);

    for (const n of notifications) {
      try {
        await this.pushNotificationsService.sendToUser(
          n.recipientId,
          type,
          actorName,
          undefined,
          { notificationId: n.id, type, targetType, targetId },
        );
      } catch (err) {
        this.logger.warn(`Failed to send push notification: ${err}`);
      }
    }
  }

  /**
   * Notify every user in the same school as the actor, excluding the actor
   * themselves. Used for school-wide listings (marketplace, hostels, events).
   */
  async notifySchoolmates(
    actorId: string,
    type: NotificationType,
    targetType: NotificationTargetType,
    targetId: string,
  ): Promise<void> {
    const actor = await this.userRepository.findOne({
      where: { id: actorId },
      select: ['id', 'schoolId', 'firstName', 'lastName', 'username'],
    });
    if (!actor?.schoolId) return;

    const actorName = this.getActorDisplayName(actor);

    const schoolmates = await this.userRepository.find({
      where: {
        schoolId: actor.schoolId,
        id: Not(actorId),
      },
      select: ['id'],
      take: 500,
    });

    if (schoolmates.length === 0) return;

    const message = this.buildMessage(type, actorName);
    const schoolmateIds = schoolmates.map((u) => u.id);

    const notifications = schoolmateIds.map((recipientId) =>
      this.notificationRepository.create({
        recipientId,
        actorId,
        type,
        targetType,
        targetId,
        message,
      }),
    );
    await this.notificationRepository.save(notifications);

    for (const n of notifications) {
      try {
        await this.pushNotificationsService.sendToUser(
          n.recipientId,
          type,
          actorName,
          undefined,
          { notificationId: n.id, type, targetType, targetId },
        );
      } catch (err) {
        this.logger.warn(`Failed to send push notification: ${err}`);
      }
    }
  }
}
