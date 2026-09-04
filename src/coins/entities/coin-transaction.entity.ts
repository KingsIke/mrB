import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CoinTransactionType {
  PURCHASE = 'purchase',
  GIFT_SENT = 'gift_sent',
  GIFT_RECEIVED = 'gift_received',
  GIFT_RECEIVED_CREDIT = 'gift_received_credit',
  REFUND = 'refund',
  LEVEL_UP_REWARD = 'level_up_reward',
  DAILY_FREE_GIFT = 'daily_free_gift',
  CONVERT_EARNINGS = 'convert_earnings',
  WITHDRAWAL = 'withdrawal',
  TREASURE_HUNT_REWARD = 'treasure_hunt_reward',
  BATTLE_ENTRY = 'battle_entry',
  BATTLE_WIN = 'battle_win',
  BATTLE_REFUND = 'battle_refund',
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

  /** Represents amount credited (+) or debited (-). Allows decimal values for cash earnings. */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: CoinTransactionType })
  type: CoinTransactionType;

  /** Dynamic string identifier for external references (e.g. withdrawal ref, purchase UUID) */
  @Column({ type: 'varchar', nullable: true })
  referenceId: string | null;

  /** Balance after transaction completion (coin count or earned monetary balance depending on type) */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balanceAfter: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}