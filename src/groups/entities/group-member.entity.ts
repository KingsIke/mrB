import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Group } from './group.entity';
import { User } from '../../users/entities/user.entity';

export enum GroupMemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('group_members')
@Unique(['groupId', 'userId'])
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Group, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: Group;

  @Column({ type: 'uuid' })
  groupId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: GroupMemberRole, default: GroupMemberRole.MEMBER })
  role: GroupMemberRole;

  @Column({ type: 'boolean', default: false })
  isMuted: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;
}
