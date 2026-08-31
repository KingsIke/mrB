import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CallType {
  VIDEO = 'video',
  AUDIO = 'audio',
}

export enum CallStatus {
  MISSED = 'missed',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted',
  CANCELLED = 'cancelled',
}

@Entity('call_history')
@Index(['callerId', 'createdAt'])
@Index(['calleeId', 'createdAt'])
@Index(['status'])
export class CallHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The user who initiated the call
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'callerId' })
  caller: User;

  @Column({ type: 'uuid' })
  callerId: string;

  // The user who received the call
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'calleeId' })
  callee: User;

  @Column({ type: 'uuid' })
  calleeId: string;

  // Stream call ID (for reference/debugging)
  @Column({ type: 'varchar', length: 255, nullable: true })
  streamCallId: string | null;

  @Column({ type: 'enum', enum: CallType, default: CallType.VIDEO })
  callType: CallType;

  @Column({ type: 'enum', enum: CallStatus, default: CallStatus.MISSED })
  status: CallStatus;

  // Duration in seconds (0 if missed/rejected/cancelled)
  @Column({ type: 'int', default: 0 })
  duration: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // When the call actually started (accepted)
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  // When the call ended
  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
