import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export const MAX_GUESSES = 6;

@Entity('word_game_attempts')
@Unique(['userId', 'puzzleNumber'])
@Index(['userId'])
export class WordGameAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  // Deterministic day index — same puzzleNumber means the same word for
  // every player, with no need for a cron job to "set" the daily word.
  @Column({ type: 'int' })
  puzzleNumber: number;

  // Words guessed so far this attempt, in order. Feedback (green/yellow/gray)
  // is derived on read, never stored, so it can't drift from the word list.
  @Column({ type: 'simple-json', default: '[]' })
  guesses: string[];

  @Column({ type: 'boolean', default: false })
  won: boolean;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
