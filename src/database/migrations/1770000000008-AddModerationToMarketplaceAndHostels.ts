import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketplace items and hostel listings now require admin approval before
 * they're publicly listed. New submissions explicitly set 'pending' in
 * application code (see MarketplaceService.create / HostelsService.create)
 * and are only visible to their own seller until an admin approves (or
 * rejects) them via the admin dashboard.
 *
 * The column default itself is 'approved', not 'pending' — so backfilling
 * this column onto listings that already existed (and were already live)
 * doesn't retroactively hide them.
 *
 * Note: this project runs with `synchronize: true` in development
 * (see src/config/database.config.ts), so the running app already applies
 * schema changes like this directly — this migration exists for parity with
 * any environment that runs with `synchronize: false` (e.g. production).
 */
export class AddModerationToMarketplaceAndHostels1770000000008
  implements MigrationInterface
{
  name = 'AddModerationToMarketplaceAndHostels1770000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Notification types for the approve/reject decision
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'marketplace_item_approved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'marketplace_item_rejected'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'hostel_approved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'hostel_rejected'`,
    );

    // Marketplace items
    if (!(await queryRunner.hasColumn('marketplace_items', 'moderationStatus'))) {
      await queryRunner.query(
        `CREATE TYPE "marketplace_items_moderationstatus_enum" AS ENUM ('pending', 'approved', 'rejected')`,
      );
      await queryRunner.query(
        `ALTER TABLE "marketplace_items" ADD "moderationStatus" "marketplace_items_moderationstatus_enum" NOT NULL DEFAULT 'approved'`,
      );
    }
    if (!(await queryRunner.hasColumn('marketplace_items', 'rejectionReason'))) {
      await queryRunner.query(
        `ALTER TABLE "marketplace_items" ADD "rejectionReason" character varying(500)`,
      );
    }

    // Hostel listings
    if (!(await queryRunner.hasColumn('hostel_listings', 'moderationStatus'))) {
      await queryRunner.query(
        `CREATE TYPE "hostel_listings_moderationstatus_enum" AS ENUM ('pending', 'approved', 'rejected')`,
      );
      await queryRunner.query(
        `ALTER TABLE "hostel_listings" ADD "moderationStatus" "hostel_listings_moderationstatus_enum" NOT NULL DEFAULT 'approved'`,
      );
    }
    if (!(await queryRunner.hasColumn('hostel_listings', 'rejectionReason'))) {
      await queryRunner.query(
        `ALTER TABLE "hostel_listings" ADD "rejectionReason" character varying(500)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('marketplace_items', 'rejectionReason')) {
      await queryRunner.query(`ALTER TABLE "marketplace_items" DROP COLUMN "rejectionReason"`);
    }
    if (await queryRunner.hasColumn('marketplace_items', 'moderationStatus')) {
      await queryRunner.query(`ALTER TABLE "marketplace_items" DROP COLUMN "moderationStatus"`);
      await queryRunner.query(`DROP TYPE "marketplace_items_moderationstatus_enum"`);
    }

    if (await queryRunner.hasColumn('hostel_listings', 'rejectionReason')) {
      await queryRunner.query(`ALTER TABLE "hostel_listings" DROP COLUMN "rejectionReason"`);
    }
    if (await queryRunner.hasColumn('hostel_listings', 'moderationStatus')) {
      await queryRunner.query(`ALTER TABLE "hostel_listings" DROP COLUMN "moderationStatus"`);
      await queryRunner.query(`DROP TYPE "hostel_listings_moderationstatus_enum"`);
    }

    // PostgreSQL doesn't support removing individual enum values from
    // notifications_type_enum — a full enum recreation would be needed.
  }
}
