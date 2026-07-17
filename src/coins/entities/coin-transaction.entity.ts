import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CoinTransactionType {
  PURCHASE = 'purchase',
  GIFT_SENT = 'gift_sent',
  GIFT_RECEIVED_CREDIT = 'gift_received_credit',
  REFUND = 'refund',
  LEVEL_UP_REWARD = 'level_up_reward',
  DAILY_FREE_GIFT = 'daily_free_gift',
}

@Entity('coin_transactions')
export class CoinTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: CoinTransactionType })
  type: CoinTransactionType;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'int' })
  balanceAfter: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
