import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GroupMessage } from './group-message.entity';

export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

@Entity('message_attachments')
export class MessageAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => GroupMessage, (message) => message.attachments, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: GroupMessage;

  @Column({ type: 'uuid' })
  messageId: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'enum', enum: AttachmentType })
  type: AttachmentType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  filename: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  size: number | null;

  @Column({ type: 'int', default: 0 })
  order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
