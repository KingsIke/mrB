import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_war_stats')
@Unique(['userId'])
export class UserWarStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int', default: 0 })
  totalBattles: number;

  @Column({ type: 'int', default: 0 })
  wins: number;

  @Column({ type: 'int', default: 0 })
  losses: number;

  @Column({ type: 'int', default: 0 })
  draws: number;

  @Column({ type: 'int', default: 0 })
  totalPointsEarned: number;

  @Column({ type: 'int', default: 0 })
  currentWinStreak: number;

  @Column({ type: 'int', default: 0 })
  bestWinStreak: number;

  @Column({ type: 'int', default: 0 })
  totalCorrectAnswers: number;

  @Column({ type: 'int', default: 0 })
  totalAnswersGiven: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastBattleAt: Date | null;

  // Cooldown: prevent rapid rematching
  @Column({ type: 'timestamptz', nullable: true })
  lastBattleWithUserId: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastOpponentId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  get accuracy(): number {
    if (this.totalAnswersGiven === 0) return 0;
    return Math.round((this.totalCorrectAnswers / this.totalAnswersGiven) * 100);
  }
}
