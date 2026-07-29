import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { GroupMessage } from './group-message.entity';
import { User } from '../../users/entities/user.entity';

@Entity('message_reactions')
@Unique(['messageId', 'userId'])
export class MessageReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GroupMessage, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: GroupMessage;

  @Column({ type: 'uuid' })
  messageId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  emoji: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
