import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MarketplaceItem } from './marketplace-item.entity';

@Entity('marketplace_likes')
@Index(['marketplaceItemId', 'userId'], { unique: true })
export class MarketplaceLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MarketplaceItem, (item) => item.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'marketplaceItemId' })
  marketplaceItem: MarketplaceItem;

  @Column({ type: 'uuid' })
  marketplaceItemId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;
}
