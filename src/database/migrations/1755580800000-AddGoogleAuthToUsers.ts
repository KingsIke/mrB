import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGoogleAuthToUsers1755580800000 implements MigrationInterface {
  name = "AddGoogleAuthToUsers1755580800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add googleId column (nullable)
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleId" varchar(255) NULL`
    );

    // Make password nullable for Google-only users
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert password to NOT NULL
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`
    );

    // Remove googleId column
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "googleId"`
    );
  }
}
