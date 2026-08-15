import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialNotificationTypes1720000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'hostel_liked'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'marketplace_liked'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'event_rsvp'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'new_follower'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_targetType_enum" ADD VALUE IF NOT EXISTS 'hostel'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_targetType_enum" ADD VALUE IF NOT EXISTS 'marketplace_item'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_targetType_enum" ADD VALUE IF NOT EXISTS 'event'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_targetType_enum" ADD VALUE IF NOT EXISTS 'user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
  }
}
