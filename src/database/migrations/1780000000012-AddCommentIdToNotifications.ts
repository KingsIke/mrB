import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCommentIdToNotifications1780000000012 implements MigrationInterface {
  name = 'AddCommentIdToNotifications1780000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" ADD COLUMN "commentId" uuid NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "commentId"`);
  }
}
