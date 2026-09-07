import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFontStyleToPosts1770000000001 implements MigrationInterface {
  name = 'AddFontStyleToPosts1770000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('posts', 'fontStyle'))) {
      await queryRunner.query(
        `ALTER TABLE "posts" ADD "fontStyle" varchar(20) DEFAULT 'classic'`,
      );
    }
    if (!(await queryRunner.hasColumn('posts', 'fontSize'))) {
      await queryRunner.query(
        `ALTER TABLE "posts" ADD "fontSize" varchar(10) DEFAULT 'medium'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('posts', 'fontStyle')) {
      await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "fontStyle"`);
    }
    if (await queryRunner.hasColumn('posts', 'fontSize')) {
      await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "fontSize"`);
    }
  }
}
