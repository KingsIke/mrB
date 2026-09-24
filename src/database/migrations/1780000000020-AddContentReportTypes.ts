import { MigrationInterface, QueryRunner } from 'typeorm';

const NEW_TYPES = ['story', 'marketplace_item', 'hostel_listing', 'past_question', 'material'];

export class AddContentReportTypes1780000000020 implements MigrationInterface {
  name = 'AddContentReportTypes1780000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const type of NEW_TYPES) {
      await queryRunner.query(`ALTER TYPE "content_reports_targettype_enum" ADD VALUE IF NOT EXISTS '${type}'`);
    }
    await queryRunner.query(`ALTER TABLE "content_reports" ADD COLUMN IF NOT EXISTS "targetOwnerId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_reports" DROP COLUMN IF EXISTS "targetOwnerId"`);
    // Postgres has no DROP VALUE for enums — rebuild the type without the new
    // values, deleting those reports first.
    await queryRunner.query(`DELETE FROM "content_reports" WHERE "targetType"::text = ANY($1)`, [NEW_TYPES]);
    await queryRunner.query(`ALTER TABLE "content_reports" ALTER COLUMN "targetType" TYPE character varying`);
    await queryRunner.query(`DROP TYPE "content_reports_targettype_enum"`);
    await queryRunner.query(`
      CREATE TYPE "content_reports_targettype_enum" AS ENUM ('post', 'comment', 'account', 'message')
    `);
    await queryRunner.query(`
      ALTER TABLE "content_reports"
      ALTER COLUMN "targetType" TYPE "content_reports_targettype_enum" USING "targetType"::"content_reports_targettype_enum"
    `);
  }
}
