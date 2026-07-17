import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Gift } from './gift.entity';
import { User } from '../../users/entities/user.entity';

export enum GiftTargetType {
  POST = 'post',
  STORY = 'story',
}

@Entity('gift_transactions')
export class GiftTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Gift, { nullable: false })
  @JoinColumn({ name: 'giftId' })
  gift: Gift;

  @Column({ type: 'uuid' })
  giftId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'uuid' })
  recipientId: string;

  @Column({ type: 'enum', enum: GiftTargetType })
  targetType: GiftTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ type: 'int' })
  coinsCost: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
