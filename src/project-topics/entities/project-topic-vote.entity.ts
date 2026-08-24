import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProjectTopic } from './project-topic.entity';

export enum VoteType {
  UP = 'up',
  DOWN = 'down',
}

@Entity('project_topic_votes')
@Unique(['userId', 'topicId'])
export class ProjectTopicVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  topicId: string;

  @ManyToOne(() => ProjectTopic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topicId' })
  topic: ProjectTopic;

  @Column({ type: 'enum', enum: VoteType })
  type: VoteType;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
