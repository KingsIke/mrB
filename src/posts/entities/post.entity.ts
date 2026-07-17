import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PostMedia } from './post-media.entity';
import { PostTag } from './post-tag.entity';

export enum PostType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  MIXED = 'mixed',
}

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum PostVisibility {
  PUBLIC = 'public',
  SCHOOL_ONLY = 'school_only',
  FRIENDS = 'friends',
}

export enum CommentPermission {
  EVERYONE = 'everyone',
  FOLLOWERS_ONLY = 'followers_only',
  NOBODY = 'nobody',
}

export enum PostCategory {
  GENERAL = 'general',
  CAMPUS_LIFE = 'campus_life',
  ACADEMICS = 'academics',
  EVENTS = 'events',
  SPORTS = 'sports',
  OTHER = 'other',
}

@Entity('posts')
@Index(['schoolId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  hashtags: string[];

  @Column({ type: 'enum', enum: PostType, default: PostType.TEXT })
  type: PostType;

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.PUBLISHED })
  status: PostStatus;

  @Column({ type: 'enum', enum: PostVisibility, default: PostVisibility.PUBLIC })
  visibility: PostVisibility;

  @Column({ type: 'enum', enum: CommentPermission, default: CommentPermission.EVERYONE })
  commentPermission: CommentPermission;

  @Column({ type: 'boolean', default: true })
  giftsEnabled: boolean;

  @Column({ type: 'enum', enum: PostCategory, default: PostCategory.GENERAL })
  category: PostCategory;

  @Column({ type: 'varchar', length: 255, nullable: true })
  feeling: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string;

  @Column({ type: 'int', default: 0 })
  likesCount: number;

  @Column({ type: 'int', default: 0 })
  commentsCount: number;

  @Column({ type: 'int', default: 0 })
  resharesCount: number;

  @Column({ type: 'int', default: 0 })
  giftsCount: number;

  @Column({ type: 'boolean', default: false })
  isHidden: boolean;

  @Column({ type: 'boolean', default: false })
  isReported: boolean;

  @OneToMany(() => PostMedia, (media) => media.post, { cascade: true })
  media: PostMedia[];

  @OneToMany(() => PostTag, (tag) => tag.post, { cascade: true })
  tags: PostTag[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
