import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('coin_balances')
export class CoinBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  /** Spendable coin balance (purchased or claimed) */
  @Column({ type: 'int', default: 0 })
  balance: number;

  /** Withdrawable/convertible gift earnings (in NGN cash value) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
  earnedBalance: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastFreeGiftClaimedAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}