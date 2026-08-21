import { User } from '../../users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('past_questions')
export class PastQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  level: string;

  @Column({ type: 'varchar', length: 255 })
  course: string;

  //   @Column({ type: 'varchar', length: 255 })
  // courseCode: string;

  @Column({ type: 'varchar', length: 50 })
  session: string;

  @Column({ type: 'varchar', length: 50 })
  semester: string;

  @Column({ type: 'json', nullable: true })
  files: { name: string; uri: string; size?: number }[];

  @Column({ name: 'uploaderId' })
  uploaderId: string;

  @ManyToOne(() => User, (u) => u.pastQuestions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  @Column({ type: 'int', default: 0 })
  priceCoins: number;

  @Column({ type: 'int', default: 0 })
  downloadsCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
