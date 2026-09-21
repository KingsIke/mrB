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

/** A bank account a user has previously withdrawn to — surfaced as a quick
 * pick in the withdraw modal instead of re-typing the same details. */
@Entity('saved_withdrawal_accounts')
@Unique(['userId', 'bankCode', 'accountNumber'])
export class SavedWithdrawalAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20 })
  bankCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 20 })
  accountNumber: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  accountName: string | null;

  @Column({ type: 'timestamptz' })
  lastUsedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
