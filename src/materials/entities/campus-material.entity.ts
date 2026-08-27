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

export enum MaterialCategory {
  LECTURE_NOTES = 'lecture_notes',
  TEXTBOOKS = 'textbooks',
  ASSIGNMENTS = 'assignments',
  PRACTICALS = 'practicals',
  COURSES = 'courses',
}

@Entity('campus_materials')
@Index(['category', 'departmentId', 'createdAt'])
export class CampusMaterial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: MaterialCategory,
  })
  category: MaterialCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  course: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  courseCode: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  level: string | null;

  /** For textbooks — author name */
  @Column({ type: 'varchar', length: 255, nullable: true })
  author: string | null;

  /** For textbooks — ISBN */
  @Column({ type: 'varchar', length: 50, nullable: true })
  isbn: string | null;

  /** For assignments — due date */
  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  /** For practicals — lab/session info */
  @Column({ type: 'varchar', length: 100, nullable: true })
  labSession: string | null;

  /** File attachments (Cloudinary URLs) */
  @Column({ type: 'json', nullable: true })
  files: { name: string; uri: string; size?: number }[];

  /** Cover image URL */
  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage: string | null;

  /** External link (e.g. for textbook purchase) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  externalLink: string | null;

  /** Price in coins to access (0 = free) */
  @Column({ type: 'int', default: 0 })
  priceCoins: number;

  @Column({ type: 'int', default: 0 })
  downloadsCount: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  // ── Relationships ──────────────────────────────────────────────

  @Column({ name: 'uploaderId' })
  uploaderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  /** Department (denormalized from uploader for fast queries) */
  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @Column({ type: 'uuid', nullable: true })
  facultyId: string | null;

  @Column({ type: 'uuid', nullable: true })
  schoolId: string | null;

  // ── Timestamps ──────────────────────────────────────────────────

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
