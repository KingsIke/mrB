import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationTargetType, NotificationType } from './entities/notification.entity';
import {
  CursorPaginated,
  CursorPaginationDto,
  decodeCursor,
  encodeCursor,
} from '../common/pagination/cursor-pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async notify(
    recipientId: string,
    actorId: string | null,
    type: NotificationType,
    targetType?: NotificationTargetType,
    targetId?: string,
  ): Promise<void> {
    // No self-notifications (e.g. liking your own post/comment).
    if (recipientId === actorId) return;

    const notification = this.notificationRepository.create({
      recipientId,
      actorId,
      type,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
    });
    await this.notificationRepository.save(notification);
  }

  async list(userId: string, pagination: CursorPaginationDto): Promise<CursorPaginated<Notification>> {
    const limit = pagination.limit ?? 20;
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
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
}
