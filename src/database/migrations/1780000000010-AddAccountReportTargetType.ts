import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountReportTargetType1780000000010 implements MigrationInterface {
  name = 'AddAccountReportTargetType1780000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "content_reports_targettype_enum" ADD VALUE IF NOT EXISTS 'account'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres has no DROP VALUE for enums — rebuild the type without
    // 'account'. Any account reports are deleted first so the column never
    // holds a value outside the recreated enum.
    await queryRunner.query(`DELETE FROM "content_reports" WHERE "targetType" = 'account'`);
    await queryRunner.query(`ALTER TABLE "content_reports" ALTER COLUMN "targetType" TYPE character varying`);
    await queryRunner.query(`DROP TYPE "content_reports_targettype_enum"`);
    await queryRunner.query(`
      CREATE TYPE "content_reports_targettype_enum" AS ENUM ('post', 'comment')
    `);
    await queryRunner.query(`
      ALTER TABLE "content_reports"
      ALTER COLUMN "targetType" TYPE "content_reports_targettype_enum" USING "targetType"::"content_reports_targettype_enum"
    `);
  }
}
