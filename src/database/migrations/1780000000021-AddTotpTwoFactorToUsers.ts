import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Authenticator-app (TOTP) two-factor authentication.
 *
 * `twoFactorMethod` picks which second factor the user must pass at login
 * ('email' keeps the existing emailed OTP flow), and `twoFactorSecret` holds
 * the base32 shared secret scanned into Google Authenticator / Authy / etc.
 */
export class AddTotpTwoFactorToUsers1780000000021 implements MigrationInterface {
  name = 'AddTotpTwoFactorToUsers1780000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "twoFactorMethod" character varying(16) NOT NULL DEFAULT 'email'
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "twoFactorSecret" character varying(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorSecret"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "twoFactorMethod"`);
  }
}
