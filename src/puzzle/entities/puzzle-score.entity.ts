import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

// Milestone tiles that earn a one-time XP bonus the first time a player
// reaches them, regardless of how many games they've played since.
export const PUZZLE_MILESTONES = [128, 256, 512, 1024, 2048] as const;

@Entity('puzzle_scores')
export class PuzzleScore {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', default: 0 })
  bestScore: number;

  @Column({ type: 'int', default: 0 })
  highestTile: number;

  @Column({ type: 'int', default: 0 })
  gamesPlayed: number;

  // Milestone tiles already rewarded, so replaying never re-awards the same
  // one. `simple-json` (not `simple-array`) so entries round-trip as real
  // numbers — simple-array would give back strings and break `.includes()`.
  @Column({ type: 'simple-json', default: '[]' })
  milestonesAwarded: number[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
