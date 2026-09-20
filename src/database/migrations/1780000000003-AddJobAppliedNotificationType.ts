import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobAppliedNotificationType1780000000003 implements MigrationInterface {
  name = 'AddJobAppliedNotificationType1780000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'job_applied'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notifications_targetType_enum" ADD VALUE IF NOT EXISTS 'job'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
