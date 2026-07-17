import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Story } from './story.entity';
import { User } from '../../users/entities/user.entity';

@Entity('story_views')
@Unique(['storyId', 'viewerId'])
export class StoryView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Story, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storyId' })
  story: Story;

  @Column({ type: 'uuid' })
  storyId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'viewerId' })
  viewer: User;

  @Column({ type: 'uuid' })
  viewerId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
