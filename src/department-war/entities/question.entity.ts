import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';

export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Entity('war_questions')
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  questionText: string;

  @Column({ type: 'jsonb' })
  options: string[]; // [optionA, optionB, optionC, optionD]

  @Column({ type: 'int' })
  correctIndex: number; // 0-3

  @Column({ type: 'enum', enum: QuestionDifficulty, default: QuestionDifficulty.MEDIUM })
  difficulty: QuestionDifficulty;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string; // e.g. 'general', 'department_specific'

  // nullable = general question available to all departments
  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department | null;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
