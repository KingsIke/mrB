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
import { Faculty } from '../../faculties/entities/faculty.entity';

@Entity('departments')
@Unique(['facultyId', 'name'])
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ManyToOne(() => Faculty, (faculty) => faculty.departments, { nullable: false })
  @JoinColumn({ name: 'facultyId' })
  faculty: Faculty;

  @Column({ type: 'uuid' })
  facultyId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
