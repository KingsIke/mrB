import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  POST_LIKED = 'post_liked',
  POST_COMMENTED = 'post_commented',
  POST_RESHARED = 'post_reshared',
  COMMENT_LIKED = 'comment_liked',
  COMMENT_REPLIED = 'comment_replied',
  GIFT_RECEIVED = 'gift_received',
  LEVEL_UP = 'level_up',
  STORY_REPLY = 'story_reply',
  STORY_REACTION = 'story_reaction',
  GROUP_MESSAGE = 'group_message',
  PAST_QUESTION_PURCHASED = 'past_question_purchased',
  HOSTEL_LIKED = 'hostel_liked',
  MARKETPLACE_LIKED = 'marketplace_liked',
  EVENT_RSVP = 'event_rsvp',
  NEW_FOLLOWER = 'new_follower',
  MARKETPLACE_ITEM_LISTED = 'marketplace_item_listed',
  HOSTEL_LISTED = 'hostel_listed',
  EVENT_CREATED = 'event_created',
  POST_TAGGED = 'post_tagged',
  PAST_QUESTION_UPLOADED = 'past_question_uploaded',
  WAR_CHALLENGED = 'war_challenged',
  WAR_BATTLE_WON = 'war_battle_won',
  WAR_BATTLE_LOST = 'war_battle_lost',
  WAR_BATTLE_DRAW = 'war_battle_draw',
  WAR_SCHEDULED_REMINDER = 'war_scheduled_reminder',
  TREASURE_HUNT_CREATED = 'treasure_hunt_created',
  TREASURE_HUNT_REMINDER = 'treasure_hunt_reminder',
}

export enum NotificationTargetType {
  POST = 'post',
  COMMENT = 'comment',
  STORY = 'story',
  GROUP = 'group',
  PAST_QUESTION = 'past_question',
  HOSTEL = 'hostel',
  MARKETPLACE_ITEM = 'marketplace_item',
  EVENT = 'event',
  USER = 'user',
  WAR = 'war',
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

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
