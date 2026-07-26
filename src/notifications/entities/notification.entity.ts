import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  POST_LIKED = 'post_liked',
  POST_COMMENTED = 'post_commented',
  POST_RESHARED = 'post_reshared',
  COMMENT_LIKED = 'comment_liked',
  GIFT_RECEIVED = 'gift_received',
  LEVEL_UP = 'level_up',
  STORY_REPLY = 'story_reply',
  STORY_REACTION = 'story_reaction',
  GROUP_MESSAGE = 'group_message',
}

export enum NotificationTargetType {
  POST = 'post',
  COMMENT = 'comment',
  STORY = 'story',
  GROUP = 'group',
}

@Entity('notifications')
@Index(['recipientId', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient: User;

  @Column({ type: 'uuid' })
  recipientId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationTargetType, nullable: true })
  targetType: NotificationTargetType | null;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
