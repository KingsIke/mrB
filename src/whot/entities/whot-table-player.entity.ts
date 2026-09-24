import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { WhotTable } from './whot-table.entity';
import { User } from '../../users/entities/user.entity';

/**
 * A seat at a WhotTable. Structural replacement for CoinBattle's fixed
 * player1Id/player2Id columns — Whot tables have 2-4 seats.
 */
@Entity('whot_table_players')
@Index(['tableId', 'seatIndex'])
export class WhotTablePlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => WhotTable, (table) => table.players, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tableId' })
  table: WhotTable;

  @Column({ type: 'uuid' })
  tableId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  seatIndex: number;

  /** Hidden from other players — only ever sent to this seat's own socket. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  hand: string[];

  /** False once eliminated/finished (v1: game ends the instant one player empties
   * their hand, so this mostly tracks "still a live participant"). */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Whot's "last card" call rule — true once this player has called it while
   * holding exactly one card. */
  @Column({ type: 'boolean', default: false })
  hasCalledLastCard: boolean;

  /** True once this seat's stake has actually been deducted from their balance. */
  @Column({ type: 'boolean', default: false })
  escrowed: boolean;

  /** Set when this seat's socket drops mid-game, cleared on reconnect. Lets the
   * stale-turn cron auto-draw on their behalf instead of stalling the table. */
  @Column({ type: 'timestamptz', nullable: true })
  disconnectedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
