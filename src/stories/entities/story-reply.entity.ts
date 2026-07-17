import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Story } from './story.entity';
import { User } from '../../users/entities/user.entity';

@Entity('story_replies')
export class StoryReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Story, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @Column({ type: 'uuid' })
  storyId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
