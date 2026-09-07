import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTextStyleToPosts1770000000000 implements MigrationInterface {
  name = 'AddTextStyleToPosts1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('posts', 'backgroundColor'))) {
      await queryRunner.query(
        `ALTER TABLE "posts" ADD "backgroundColor" varchar(7)`,
      );
    }
    if (!(await queryRunner.hasColumn('posts', 'textAlign'))) {
      await queryRunner.query(
        `ALTER TABLE "posts" ADD "textAlign" varchar(10) DEFAULT 'center'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('posts', 'backgroundColor')) {
      await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "backgroundColor"`);
    }
    if (await queryRunner.hasColumn('posts', 'textAlign')) {
      await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "textAlign"`);
    }
  }
}
