import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BattleAnswer } from './battle-answer.entity';

export enum BattleType {
  QUICK_MATCH = 'quick_match',
  CHALLENGE = 'challenge',
  SCHEDULED = 'scheduled',
}

export enum BattleStatus {
  WAITING = 'waiting',         // waiting for opponent to accept
  PENDING = 'pending',         // both accepted, awaiting start time (scheduled)
  COUNTDOWN = 'countdown',     // 3-2-1 countdown
  ACTIVE = 'active',           // battle in progress
  FINISHED = 'finished',       // battle completed
  CANCELLED = 'cancelled',     // cancelled / opponent didn't join
  EXPIRED = 'expired',         // challenge not accepted in time
}

@Entity('wars')
export class Battle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BattleType })
  type: BattleType;

  @Column({ type: 'enum', enum: BattleStatus, default: BattleStatus.WAITING })
  status: BattleStatus;

  // ── Players ──
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'player1Id' })
  player1: User;

  @Column({ type: 'uuid' })
  player1Id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'player2Id' })
  player2: User | null;

  @Column({ type: 'uuid', nullable: true })
  player2Id: string | null;

  // ── Scores ──
  @Column({ type: 'int', default: 0 })
  player1Score: number;

  @Column({ type: 'int', default: 0 })
  player2Score: number;

  // ── Question tracking ──
  @Column({ type: 'int', default: 10 })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  currentQuestionIndex: number;

  @Column({ type: 'int', default: 15 }) // seconds per question
  timePerQuestion: number;

  // ── Winner ──
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'winnerId' })
  winner: User | null;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

  // ── Department points ──
  @Column({ type: 'int', default: 10 })
  departmentPoints: number;

  // ── Scheduled battle ──
  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'boolean', default: false })
  reminderSent: boolean;

  // ── Selected questions (stored so submitAnswer can look them up) ──
  @Column({ type: 'jsonb', nullable: true })
  selectedQuestionIds: string[] | null;

  // ── Challenge expiry ──
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  // ── Timestamps ──
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // ── Relations ──
  @OneToMany(() => BattleAnswer, (answer) => answer.battle)
  answers: BattleAnswer[];
}
