import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('word_game_stats')
export class WordGameStats {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int', default: 0 })
  currentStreak: number;

  @Column({ type: 'int', default: 0 })
  longestStreak: number;

  @Column({ type: 'int', default: 0 })
  totalPlayed: number;

  @Column({ type: 'int', default: 0 })
  totalWon: number;

  // Index 0 = won in 1 guess ... index 5 = won in 6 guesses.
  @Column({ type: 'simple-json', default: '[0,0,0,0,0,0]' })
  guessDistribution: number[];

  // The last puzzleNumber this user completed — used to tell whether
  // today's puzzle is the very next day (streak continues) or a gap
  // (streak resets), without needing a separate date column.
  @Column({ type: 'int', nullable: true })
  lastPuzzleNumber: number | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
