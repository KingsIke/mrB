import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum XpSource {
  POST_CREATED = 'post_created',
  LIKE_RECEIVED = 'like_received',
  COMMENT_RECEIVED = 'comment_received',
  RESHARE_RECEIVED = 'reshare_received',
  DAILY_LOGIN = 'daily_login',
  STREAK_BONUS = 'streak_bonus',
  GIFT_GIVEN_BONUS = 'gift_given_bonus',
}

@Entity('xp_transactions')
export class XpTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: XpSource })
  source: XpSource;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
