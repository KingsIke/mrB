import { Entity, PrimaryColumn, Column } from 'typeorm';

// One row per user per calendar day (UTC), tracking total coins staked that
// day so a single user's worst-case daily exposure/extraction is bounded
// regardless of how skilled (or scripted) their tapping is.
@Entity('precision_tap_daily_usage')
export class PrecisionTapDailyUsage {
  @PrimaryColumn('uuid')
  userId: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  date: string; // YYYY-MM-DD (UTC)

  @Column({ type: 'int', default: 0 })
  totalStaked: number;
}
