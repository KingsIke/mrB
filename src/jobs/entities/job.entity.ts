import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { School } from '../../schools/entities/school.entity';
import { JobApplication } from './job-application.entity';

export enum JobType {
  INTERNSHIP = 'internship',
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  REMOTE = 'remote',
  NYSC = 'nysc',
  FREELANCE = 'freelance',
}

export enum JobStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  FILLED = 'filled',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255 })
  company!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  companyLogo?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ type: 'enum', enum: JobType, default: JobType.FULL_TIME })
  type!: JobType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  salary?: string;

  @Column({ type: 'simple-array', nullable: true })
  requirements?: string[];

  @Column({ type: 'simple-array', nullable: true })
  benefits?: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contactPhone?: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.OPEN })
  status!: JobStatus;

  @Column({ type: 'int', default: 0 })
  applicationsCount!: number;

  @Column({ type: 'uuid' })
  postedById!: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'postedById' })
  postedBy?: User;

  @Column({ type: 'uuid', nullable: true })
  schoolId?: string;

  @ManyToOne(() => School, { nullable: true })
  @JoinColumn({ name: 'schoolId' })
  school?: School;

  @OneToMany(() => JobApplication, (app) => app.job)
  applications?: JobApplication[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
