import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CoinBattle } from './coin-battle.entity';

@Entity('coin_battle_answers')
export class CoinBattleAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CoinBattle, (battle) => battle.answers, { nullable: false })
  @JoinColumn({ name: 'battleId' })
  battle: CoinBattle;

  @Column({ type: 'uuid' })
  battleId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  questionIndex: number;

  @Column({ type: 'int' })
  selectedOption: number; // 0-3, or -1 for no answer (timeout)

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'int', default: 0 })
  pointsEarned: number;

  @Column({ type: 'int', nullable: true })
  timeTakenMs: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
