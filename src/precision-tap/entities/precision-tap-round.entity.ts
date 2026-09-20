import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type PrecisionTapZone = 'bullseye' | 'good' | 'miss' | 'abandoned';

@Entity('precision_tap_rounds')
@Index(['userId', 'status'])
export class PrecisionTapRound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  stake: number;

  // Full back-and-forth sweep duration in ms — lower = faster = harder.
  // Sent to the client so it can render the identical animation, and used
  // server-side (with startedAt) to compute the marker's authoritative
  // position at the moment a tap is received.
  @Column({ type: 'int' })
  periodMs: number;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: 'active' | 'resolved';

  @Column({ type: 'varchar', length: 20, nullable: true })
  zone: PrecisionTapZone | null;

  @Column({ type: 'int', nullable: true })
  payout: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
