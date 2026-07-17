import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReportTargetType {
  POST = 'post',
  COMMENT = 'comment',
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

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
