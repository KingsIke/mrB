import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportTargetType {
  POST = 'post',
  COMMENT = 'comment',
  ACCOUNT = 'account',
  MESSAGE = 'message',
  STORY = 'story',
  MARKETPLACE_ITEM = 'marketplace_item',
  HOSTEL_LISTING = 'hostel_listing',
  PAST_QUESTION = 'past_question',
  MATERIAL = 'material',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
}

@Entity('content_reports')
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'enum', enum: ReportTargetType })
  targetType: ReportTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ type: 'text' })
  reason: string;

  /** Who posted the reported content. Set for types reported via POST /reports. */
  @Column({ type: 'uuid', nullable: true })
  targetOwnerId: string | null;

  /** Copy of the reported content at report time (chat messages can be deleted afterwards). */
  @Column({ type: 'text', nullable: true })
  targetSnapshot: string | null;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
