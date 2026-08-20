import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentRepliedNotificationType1756000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'comment_replied'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
  }
}
