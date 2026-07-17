import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Post } from './post.entity';
import { User } from '../../users/entities/user.entity';

@Entity('post_tags')
@Unique(['postId', 'taggedUserId'])
export class PostTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Post, (post) => post.tags, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @Column({ type: 'uuid' })
  postId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'taggedUserId' })
  taggedUser: User;

  @Column({ type: 'uuid' })
  taggedUserId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
