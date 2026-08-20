import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreferencesToUsers1756100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "notificationPreferences" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "notificationPreferences"`,
    );
  }
}
