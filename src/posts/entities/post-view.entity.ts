import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Post } from './post.entity';
import { User } from '../../users/entities/user.entity';

@Entity('post_views')
@Unique(['postId', 'viewerId'])
export class PostView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Post, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'viewerId' })
  viewer: User;

  @Column({ type: 'uuid' })
  viewerId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
