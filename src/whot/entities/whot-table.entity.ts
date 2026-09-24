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
import { WhotTablePlayer } from './whot-table-player.entity';

export enum WhotTableStatus {
  WAITING = 'waiting', // reserved for a future direct-invite flow (v1 is queue-only)
  QUEUED = 'queued', // waiting for seats to fill
  MATCHED = 'matched', // reserved (mirrors CoinBattle's shape; unused while table fills via QUEUED)
  COUNTDOWN = 'countdown', // table full/ready, dealing + short countdown before ACTIVE
  ACTIVE = 'active', // game in progress
  FINISHED = 'finished', // game completed, coins settled
  CANCELLED = 'cancelled', // cancelled (e.g. stale queue, disconnect sweep)
  EXPIRED = 'expired', // queue timeout
}

export const WHOT_TABLE_SIZES = [2, 3, 4] as const;
export type WhotTableSize = (typeof WHOT_TABLE_SIZES)[number];

export const WHOT_PLATFORM_FEE_PERCENT = 10; // 10% platform fee, same convention as Coin Battle
export const WHOT_HAND_SIZE = 5; // Naija Whot standard opening hand

@Entity('whot_tables')
export class WhotTable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: WhotTableStatus, default: WhotTableStatus.QUEUED })
  status: WhotTableStatus;

  // ── Stake & Pot ──
  @Column({ type: 'int' })
  stake: number; // coins each player puts in

  @Column({ type: 'int', default: 0 })
  pot: number; // total coins in the pot (stake * seatsEscrowed)

  @Column({ type: 'int', default: 0 })
  platformFee: number;

  @Column({ type: 'int', default: 0 })
  winnerPrize: number;

  // ── Table shape ──
  @Column({ type: 'int' })
  maxPlayers: number; // 2-4

  @Column({ type: 'int', default: 2 })
  minPlayers: number; // minimum seats before an auto-start countdown may kick in

  // ── Game state (server-authoritative, hidden info lives on WhotTablePlayer.hand) ──
  @Column({ type: 'jsonb', default: () => "'[]'" })
  deck: string[]; // remaining draw pile, card codes like "circle-5", "whot-20"

  @Column({ type: 'jsonb', default: () => "'[]'" })
  discardPile: string[]; // top card is the last element

  @Column({ type: 'uuid', nullable: true })
  currentTurnPlayerId: string | null;

  @Column({ type: 'int', default: 1 })
  turnDirection: number; // 1 | -1

  @Column({ type: 'int', default: 0 })
  pendingPickCount: number; // accumulated Pick Two/Three stack

  @Column({ type: 'varchar', nullable: true })
  requestedShape: string | null; // set after a Whot-20 "call market" pick

  // ── Winner ──
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'winnerId' })
  winner: User | null;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string | null;

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
  @OneToMany(() => WhotTablePlayer, (player) => player.table)
  players: WhotTablePlayer[];
}
