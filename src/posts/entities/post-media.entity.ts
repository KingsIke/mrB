import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Post } from './post.entity';

export enum PostMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
}

@Entity('post_media')
export class PostMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Post, (post) => post.media, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'uuid' })
  postId: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'enum', enum: PostMediaType })
  mediaType: PostMediaType;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
