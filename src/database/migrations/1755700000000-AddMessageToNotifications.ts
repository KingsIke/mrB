import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageToNotifications1755700000000 implements MigrationInterface {
  name = 'AddMessageToNotifications1755700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('notifications', 'message'))) {
      await queryRunner.query(
        `ALTER TABLE "notifications" ADD "message" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('notifications', 'message')) {
      await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN "message"`);
    }
  }
}
