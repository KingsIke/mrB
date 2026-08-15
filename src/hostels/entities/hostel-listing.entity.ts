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
import { HostelLike } from './hostel-like.entity';

export enum HostelStatus {
  AVAILABLE = 'available',
  TAKEN = 'taken',
  UNAVAILABLE = 'unavailable',
}

@Entity('hostel_listings')
export class HostelListing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  hostelName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Location details
  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state?: string;

  // Pricing & Financials
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyRent?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, default: 0 })
  serviceCharge?: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, default: 0 })
  cautionFee?: number;

  // Room details
  @Column({ type: 'varchar', length: 100, nullable: true })
  roomType?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gender?: string;

  @Column({ type: 'int', nullable: true })
  capacity?: number;

  @Column({ type: 'int', nullable: true, default: 1 })
  availableRooms?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bedrooms?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bathrooms?: string;

  // Amenities & Rules
  @Column({ type: 'simple-array', nullable: true })
  amenities?: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  curfew?: string;

  @Column({ type: 'boolean', default: false })
  visitorsAllowed!: boolean;

  @Column({ type: 'boolean', default: false })
  petsAllowed!: boolean;

  @Column({ type: 'boolean', default: false })
  smokingAllowed!: boolean;

  @Column({ type: 'boolean', default: false })
  lookingForRoommate!: boolean;

  // Contact Info
  @Column({ type: 'varchar', length: 150, nullable: true })
  contactName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  whatsapp?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  // Media & Metadata
  @Column({ type: 'simple-array', nullable: true })
  imageUrls?: string[];

  @Column({ type: 'enum', enum: HostelStatus, default: HostelStatus.AVAILABLE })
  status!: HostelStatus;

  @Column({ type: 'boolean', default: true })
  isAvailable!: boolean;

  // Relations
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

  @OneToMany(() => HostelLike, (like) => like.hostelListing, { cascade: true })
  likes?: HostelLike[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}