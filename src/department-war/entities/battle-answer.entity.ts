import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Battle } from './battle.entity';
import { User } from '../../users/entities/user.entity';

@Entity('war_answers')
export class BattleAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Battle, (battle) => battle.answers, { nullable: false })
  @JoinColumn({ name: 'battleId' })
  battle: Battle;

  @Column({ type: 'uuid' })
  battleId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  questionIndex: number;

  @Column({ type: 'int', nullable: true })
  selectedOption: number | null; // 0-3, null if timed out

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'int', default: 0 })
  timeTakenMs: number; // milliseconds to answer

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
