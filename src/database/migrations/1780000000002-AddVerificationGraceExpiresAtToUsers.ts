import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerificationGraceExpiresAtToUsers1780000000002 implements MigrationInterface {
  name = 'AddVerificationGraceExpiresAtToUsers1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "verificationGraceExpiresAt" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "verificationGraceExpiresAt"`);
  }
}
