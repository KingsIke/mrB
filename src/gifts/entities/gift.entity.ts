import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('gifts')
export class Gift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  animationUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  videoUrl: string | null;

  @Column({ type: 'int' })
  coinCost: number;

  @Column({ type: 'int', nullable: true })
  discountPercent: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  discountExpiresAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  bundleId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
