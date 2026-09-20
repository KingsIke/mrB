import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBannedStatusAndReasonToUsers1780000000000 implements MigrationInterface {
  name = 'AddBannedStatusAndReasonToUsers1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_status_enum" ADD VALUE IF NOT EXISTS 'banned'`);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "statusReason" character varying(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "statusReason"`);

    // Postgres has no DROP VALUE for enums — rebuild the type without
    // 'banned'. Any banned rows are demoted to 'suspended' first so the
    // column never holds a value outside the recreated enum.
    await queryRunner.query(`UPDATE "users" SET "status" = 'suspended' WHERE "status" = 'banned'`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE character varying`);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
    await queryRunner.query(`
      CREATE TYPE "users_status_enum" AS ENUM (
        'pending_verification', 'pending_onboarding', 'active', 'suspended'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE "users_status_enum" USING "status"::"users_status_enum"
    `);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending_verification'`);
  }
}
