import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminStatusAndFeaturedToJobs1756300000000
  implements MigrationInterface
{
  name = 'AddAdminStatusAndFeaturedToJobs1756300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'admin' value to the jobs status enum
    await queryRunner.query(
      `ALTER TYPE "jobs_status_enum" ADD VALUE IF NOT EXISTS 'admin'`,
    );

    // Add 'featured' boolean column (default false)
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD COLUMN "featured" boolean NOT NULL DEFAULT false`,
    );

    // Add an index so featured jobs can be fetched quickly
    await queryRunner.query(
      `CREATE INDEX "IDX_jobs_featured" ON "jobs" ("featured") WHERE "featured" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the partial index
    await queryRunner.query(`DROP INDEX "IDX_jobs_featured"`);

    // Drop the featured column
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "featured"`);

    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed to remove 'admin'.
  }
}
