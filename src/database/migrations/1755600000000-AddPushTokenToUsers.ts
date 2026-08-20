import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushTokenToUsers1755600000000 implements MigrationInterface {
  name = 'AddPushTokenToUsers1755600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "pushToken" varchar(255)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "pushToken"`,
    );
  }
}
