import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { PostComment } from './post-comment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comment_likes')
@Unique(['commentId', 'userId'])
export class CommentLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PostComment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment: PostComment;

  @Column({ type: 'uuid' })
  commentId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
