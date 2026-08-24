import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('project_topics')
@Index(['departmentId', 'createdAt'])
export class ProjectTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  course: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  courseCode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  level: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'int', default: 0 })
  upvotes: number;

  @Column({ type: 'int', default: 0 })
  downvotes: number;

  @Column({ type: 'int', default: 0 })
  views: number;

  // ── Author ──────────────────────────────────────────────────────
  @Column({ name: 'authorId' })
  authorId: string;

  @ManyToOne(() => User, (u) => u.projectTopics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  // ── Department (denormalized from author for fast queries) ──────
  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  facultyId: string | null;

  // ── Timestamps ──────────────────────────────────────────────────
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
