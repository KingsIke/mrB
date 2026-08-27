import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Gift } from '../../gifts/entities/gift.entity';

@Entity('treasure_hunts')
export class TreasureHunt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The gift that will be awarded when a user claims this treasure */
  @ManyToOne(() => Gift, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'giftId' })
  gift: Gift;

  @Column({ type: 'uuid' })
  giftId: string;

  /**
   * The screen/route where the treasure is hidden.
   * Must match a route in the app, e.g. "/(tabs)/home", "/(features)/departmentWar", etc.
   */
  @Column({ type: 'varchar', length: 200 })
  route: string;

  /** Human-readable name shown in the admin panel */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Optional description shown when the user discovers the treasure */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** How many users can claim this treasure (1 = first come first served) */
  @Column({ type: 'int', default: 1 })
  maxClaims: number;

  /** Running count of how many users have claimed */
  @Column({ type: 'int', default: 0 })
  claimedCount: number;

  /** When the treasure becomes active */
  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  /** When the treasure expires (null = never) */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /** Whether this treasure hunt is currently enabled */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Optional: coin bonus on top of the gift */
  @Column({ type: 'int', default: 0 })
  bonusCoins: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
