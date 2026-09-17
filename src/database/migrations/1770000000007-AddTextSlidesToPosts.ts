import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTextSlidesToPosts1770000000007 implements MigrationInterface {
  name = 'AddTextSlidesToPosts1770000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('posts', 'textSlides'))) {
      await queryRunner.query(
        `ALTER TABLE "posts" ADD "textSlides" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('posts', 'textSlides')) {
      await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN "textSlides"`);
    }
  }
}
