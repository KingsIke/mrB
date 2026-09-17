import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentUnionNotificationTypes1770000000004 implements MigrationInterface {
  name = 'AddStudentUnionNotificationTypes1770000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'student_union_verified'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'student_union_rejected'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
