import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Department } from '../../departments/entities/department.entity';

@Entity('faculties')
@Unique(['schoolId', 'name'])
export class Faculty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ManyToOne(() => School, { nullable: false })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ type: 'uuid' })
  schoolId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Department, (department) => department.faculty)
  departments: Department[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
