import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentVerificationNotificationTypes1770000005 implements MigrationInterface {
  name = 'AddStudentVerificationNotificationTypes1770000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'student_verification_approved'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'student_verification_rejected'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
