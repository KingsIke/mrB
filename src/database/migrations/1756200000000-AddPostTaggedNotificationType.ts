import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostTaggedNotificationType1756200000000 implements MigrationInterface {
  name = 'AddPostTaggedNotificationType1756200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'post_tagged'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
