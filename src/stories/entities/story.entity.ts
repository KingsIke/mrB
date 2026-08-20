import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum StoryMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  TEXT = 'text',
}

@Entity('stories')
@Index(['schoolId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  mediaUrl: string | null;

  @Column({ type: 'enum', enum: StoryMediaType })
  mediaType: StoryMediaType;

  @Column({ type: 'text', nullable: true })
  textContent: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  backgroundColor: string | null;

  @Column({ type: 'varchar', length: 10, default: 'center' })
  textAlign: 'left' | 'center' | 'right';

  @Column({ type: 'uuid', nullable: true })
  schoolId: string;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ type: 'int', default: 0 })
  reactionsCount: number;

  @Column({ type: 'int', default: 0 })
  giftsCount: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isHighlighted: boolean;

  @Column({ type: 'boolean', default: false })
  isHidden: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}