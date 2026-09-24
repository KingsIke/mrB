import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageReportTargetType1780000000019 implements MigrationInterface {
  name = 'AddMessageReportTargetType1780000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "content_reports_targettype_enum" ADD VALUE IF NOT EXISTS 'message'`);
    await queryRunner.query(`ALTER TABLE "content_reports" ADD COLUMN IF NOT EXISTS "targetSnapshot" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "content_reports" DROP COLUMN IF EXISTS "targetSnapshot"`);
    // Postgres has no DROP VALUE for enums — rebuild the type without
    // 'message', deleting message reports first.
    await queryRunner.query(`DELETE FROM "content_reports" WHERE "targetType" = 'message'`);
    await queryRunner.query(`ALTER TABLE "content_reports" ALTER COLUMN "targetType" TYPE character varying`);
    await queryRunner.query(`DROP TYPE "content_reports_targettype_enum"`);
    await queryRunner.query(`
      CREATE TYPE "content_reports_targettype_enum" AS ENUM ('post', 'comment', 'account')
    `);
    await queryRunner.query(`
      ALTER TABLE "content_reports"
      ALTER COLUMN "targetType" TYPE "content_reports_targettype_enum" USING "targetType"::"content_reports_targettype_enum"
    `);
  }
}
