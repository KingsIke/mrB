import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropEmojiFromGifts1740000000000 implements MigrationInterface {
  name = 'DropEmojiFromGifts1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('gifts', 'emoji')) {
      await queryRunner.query(`ALTER TABLE "gifts" DROP COLUMN "emoji"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('gifts', 'emoji'))) {
      await queryRunner.query(
        `ALTER TABLE "gifts" ADD "emoji" character varying(10)`,
      );
    }
  }
}
