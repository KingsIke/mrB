import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPastQuestionNotificationTypes1720000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'past_question_purchased'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_targetType_enum" ADD VALUE IF NOT EXISTS 'past_question'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type.
  }
}
