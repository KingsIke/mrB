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
import { CoinBattleAnswer } from './coin-battle-answer.entity';

export enum CoinBattleStatus {
  WAITING = 'waiting',         // challenge sent, awaiting opponent acceptance
  QUEUED = 'queued',           // waiting in matchmaking queue
  MATCHED = 'matched',         // opponent found, countdown starting
  COUNTDOWN = 'countdown',     // 3-2-1 countdown
  ACTIVE = 'active',           // battle in progress
  FINISHED = 'finished',       // battle completed, coins settled
  CANCELLED = 'cancelled',     // cancelled (e.g. opponent disconnected)
  EXPIRED = 'expired',         // queue timeout
}

export const COIN_BATTLE_STAKES = [50, 100, 250, 500] as const;
export type CoinBattleStake = (typeof COIN_BATTLE_STAKES)[number];

export const PLATFORM_FEE_PERCENT = 10; // 10% platform fee

@Entity('coin_battles')
export class CoinBattle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: CoinBattleStatus, default: CoinBattleStatus.QUEUED })
  status: CoinBattleStatus;

  // ── Stake & Pot ──
  @Column({ type: 'int' })
  stake: number; // coins each player puts in

  @Column({ type: 'int', default: 0 })
  pot: number; // total coins in the pot (stake * 2)

  @Column({ type: 'int', default: 0 })
  platformFee: number; // coins the platform keeps

  @Column({ type: 'int', default: 0 })
  winnerPrize: number; // coins the winner receives

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

  @Column({ type: 'int', default: 15 })
  timePerQuestion: number;

  // ── Winner ──
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'winnerId' })
  winner: User | null;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

  // ── Escrow tracking ──
  @Column({ type: 'boolean', default: false })
  player1Escrowed: boolean; // player1's coins have been deducted

  @Column({ type: 'boolean', default: false })
  player2Escrowed: boolean; // player2's coins have been deducted

  // ── Selected questions ──
  @Column({ type: 'jsonb', nullable: true })
  selectedQuestionIds: string[] | null;

  // ── Timestamps ──
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  queuedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // ── Relations ──
  @OneToMany(() => CoinBattleAnswer, (answer) => answer.battle)
  answers: CoinBattleAnswer[];
}
