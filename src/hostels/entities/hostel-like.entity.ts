import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HostelListing } from './hostel-listing.entity';

@Entity('hostel_likes')
@Index(['hostelId', 'userId'], { unique: true })
export class HostelLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => HostelListing, (hostel) => hostel.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hostelId' })
  hostelListing: HostelListing;

  @Column({ type: 'uuid' })
  hostelId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;
}
