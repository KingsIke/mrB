import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Job } from './job.entity';

export enum ApplicationStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  SHORTLISTED = 'shortlisted',
  REJECTED = 'rejected',
  ACCEPTED = 'accepted',
}

@Entity('job_applications')
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  jobId!: string;

  @ManyToOne(() => Job, (job) => job.applications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job?: Job;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'text', nullable: true })
  coverLetter?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resumeUrl?: string;

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status!: ApplicationStatus;

  @CreateDateColumn()
  createdAt!: Date;
}
