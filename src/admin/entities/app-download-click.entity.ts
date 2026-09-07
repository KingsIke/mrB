import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('appDownloadClicks')
@Index(['createdAt'])
export class AppDownloadClick {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Where the click came from: 'landing', 'navbar', 'footer', 'about', 'unknown' */
  @Column({ type: 'varchar', length: 32, default: 'unknown' })
  source: string;

  /** Optional: the path of the page where the click happened (e.g. '/') */
  @Column({ type: 'varchar', length: 255, nullable: true })
  pageUrl: string | null;

  /** hashed IP for deduplication / unique-click counts (no raw IPs stored) */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ipHash: string | null;

  /** Truncated User-Agent string for device/browser breakdown */
  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  /** If the visitor was logged in, the user id (nullable for anonymous visitors) */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
