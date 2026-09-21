import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostViews1780000000011 implements MigrationInterface {
  name = 'AddPostViews1780000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "posts" ADD COLUMN "viewsCount" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE "post_views" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "postId" uuid NOT NULL,
        "viewerId" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_views_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_views_postId_viewerId" UNIQUE ("postId", "viewerId"),
        CONSTRAINT "FK_post_views_postId" FOREIGN KEY ("postId")
          REFERENCES "posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_post_views_viewerId" FOREIGN KEY ("viewerId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_post_views_postId" ON "post_views" ("postId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_post_views_postId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_views"`);
    await queryRunner.query(`ALTER TABLE "posts" DROP COLUMN IF EXISTS "viewsCount"`);
  }
}
