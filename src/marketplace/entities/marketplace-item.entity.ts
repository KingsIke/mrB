import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';
import { MarketplaceLike } from './marketplace-like.entity';

export enum MarketplaceStatus {
  AVAILABLE = 'available',
  TAKEN = 'taken',
  UNAVAILABLE = 'unavailable',
}

@Entity('marketplace_items')
export class MarketplaceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  condition?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  @Column({ type: 'simple-array', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'enum', enum: MarketplaceStatus, default: MarketplaceStatus.AVAILABLE })
  status!: MarketplaceStatus;

  @Column({ type: 'boolean', default: true })
  isAvailable!: boolean;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn({ name: 'sellerId' })
  seller!: User;

  @Column({ type: 'uuid' })
  sellerId!: string;

  @ManyToOne(() => School, { eager: true, nullable: true })
  @JoinColumn({ name: 'schoolId' })
  school?: School;

  @Column({ type: 'uuid', nullable: true })
  schoolId?: string;

  @OneToMany(() => MarketplaceLike, (like) => like.marketplaceItem, { cascade: true })
  likes?: MarketplaceLike[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}