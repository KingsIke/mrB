import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Story } from './story.entity';
import { User } from '../../users/entities/user.entity';

export const ALLOWED_STORY_REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👏', '🔥'] as const;

@Entity('story_reactions')
@Unique(['storyId', 'userId'])
export class StoryReaction {
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

  @Column({ type: 'varchar', length: 10 })
  emoji: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
