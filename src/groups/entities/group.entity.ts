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
import { User } from '../../users/entities/user.entity';

export enum GroupType {
  SCHOOL = 'school',
  FACULTY = 'faculty',
  DEPARTMENT = 'department',
  CUSTOM = 'custom',
}

@Entity('groups')
@Unique(['type', 'sourceId'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  iconUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: GroupType, default: GroupType.CUSTOM })
  type: GroupType;

  @Column({ type: 'uuid', nullable: true })
  sourceId: string | null;

  @Column({ type: 'boolean', default: false })
  isSystemManaged: boolean;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({ type: 'int', default: 0 })
  membersCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
