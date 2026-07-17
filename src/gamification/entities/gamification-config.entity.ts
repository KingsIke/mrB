import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/** Single-row table: one active XP multiplier at a time (e.g. "double XP" during campus festivals). */
@Entity('gamification_config')
export class GamificationConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'real', default: 1 })
  xpMultiplier: number;

  @Column({ type: 'timestamptz', nullable: true })
  multiplierExpiresAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
