import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectionFieldsToUsers1770000000006 implements MigrationInterface {
  name = 'AddRejectionFieldsToUsers1770000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add rejectionReason column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "rejectionReason" character varying(500) NULL
    `);

    // Add isStudentIdRejected column (default false)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "isStudentIdRejected" boolean NOT NULL DEFAULT false
    `);

    // Add isAdmissionLetterRejected column (default false)
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "isAdmissionLetterRejected" boolean NOT NULL DEFAULT false
    `);

    // Create index on rejectionReason for faster lookups
    await queryRunner.query(`
      CREATE INDEX "idx_users_rejectionReason" ON "users" ("rejectionReason")
      WHERE "rejectionReason" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_rejectionReason"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isAdmissionLetterRejected"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isStudentIdRejected"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "rejectionReason"`);
  }
}
