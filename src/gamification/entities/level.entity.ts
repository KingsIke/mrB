import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('levels')
export class Level {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', unique: true })
  level: number;

  @Column({ type: 'varchar', length: 50 })
  title: string;

  @Column({ type: 'varchar', length: 10 })
  emoji: string;

  @Column({ type: 'int' })
  minXp: number;

  @Column({ type: 'int', nullable: true })
  maxXp: number | null;

  @Column({ type: 'varchar', length: 50 })
  badge: string;

  @Column({ type: 'varchar', length: 20 })
  color: string;

  @Column({ type: 'int', default: 0 })
  rewardCoins: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  perks: string[];
}
