import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { TreasureHunt } from './treasure-hunt.entity';

@Entity('treasure_claims')
@Unique(['userId', 'treasureHuntId'])
export class TreasureClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => TreasureHunt, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treasureHuntId' })
  treasureHunt: TreasureHunt;

  @Column({ type: 'uuid' })
  treasureHuntId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  claimedAt: Date;
}
