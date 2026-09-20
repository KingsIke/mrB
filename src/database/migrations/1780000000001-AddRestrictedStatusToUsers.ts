import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRestrictedStatusToUsers1780000000001 implements MigrationInterface {
  name = 'AddRestrictedStatusToUsers1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "users_status_enum" ADD VALUE IF NOT EXISTS 'restricted'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Postgres has no DROP VALUE for enums — rebuild the type without
    // 'restricted'. Any restricted rows are demoted to 'active' first so the
    // column never holds a value outside the recreated enum.
    await queryRunner.query(`UPDATE "users" SET "status" = 'active' WHERE "status" = 'restricted'`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE character varying`);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
    await queryRunner.query(`
      CREATE TYPE "users_status_enum" AS ENUM (
        'pending_verification', 'pending_onboarding', 'active', 'suspended', 'banned'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "status" TYPE "users_status_enum" USING "status"::"users_status_enum"
    `);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending_verification'`);
  }
}
