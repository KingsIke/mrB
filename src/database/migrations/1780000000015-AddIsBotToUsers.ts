import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsBotToUsers1780000000015 implements MigrationInterface {
  name = 'AddIsBotToUsers1780000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "isBot" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isBot"`);
  }
}
