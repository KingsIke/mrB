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

  /** Purchased coins (plus converted earnings). The only coins that can be gifted. */
  @Column({ type: 'int', default: 0 })
  balance: number;

  /**
   * Coins won or earned in games and rewards. They can be staked and spent in
   * games but never gifted, so game winnings can't be turned into cash
   * (gifts pay out to the recipient's withdrawable earned balance).
   */
  @Column({ type: 'int', default: 0 })
  bonusBalance: number;

  /**
   * Bonus coins currently tied up in game stakes. Stake refunds go back to
   * bonusBalance up to this amount, so a refund can never move bonus coins
   * into the giftable balance.
   */
  @Column({ type: 'int', default: 0 })
  stakedBonus: number;

  /** Withdrawable/convertible gift earnings (in NGN cash value) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.00 })
  earnedBalance: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastFreeGiftClaimedAt: Date | null;

  /** When the one-time starter game coins were granted (null = not yet). */
  @Column({ type: 'timestamptz', nullable: true })
  starterGameCoinsGrantedAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}