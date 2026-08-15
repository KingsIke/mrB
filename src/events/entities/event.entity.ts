import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EventCategory {
  ALL = 'All',
  ACADEMIC = 'Academic',
  SOCIAL = 'Social',
  SPORTS = 'Sports',
  ARTS = 'Arts',
  PROFESSIONAL = 'Professional',
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  creatorId: string;

  @Column()
  schoolId: string; 

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ nullable: true })
  coverImage: string;

  @Column()
  date: string;

  @Column()
  time: string;

  @Column()
  location: string;

  @Column({
    type: 'enum',
    enum: EventCategory,
    default: EventCategory.ACADEMIC,
  })
  category: EventCategory;

  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isPast: boolean;

  @Column({ default: 0 })
  goingCount: number;

  @Column({ default: 0 })
  interestedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}