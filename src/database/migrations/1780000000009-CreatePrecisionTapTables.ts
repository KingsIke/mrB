import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrecisionTapTables1780000000009 implements MigrationInterface {
  name = 'CreatePrecisionTapTables1780000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "precision_tap_rounds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "stake" integer NOT NULL,
        "periodMs" integer NOT NULL,
        "startedAt" TIMESTAMPTZ NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "zone" character varying(20),
        "payout" integer,
        "resolvedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_precision_tap_rounds_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_precision_tap_rounds_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_precision_tap_rounds_userId_status" ON "precision_tap_rounds" ("userId", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "precision_tap_daily_usage" (
        "userId" uuid NOT NULL,
        "date" character varying(10) NOT NULL,
        "totalStaked" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_precision_tap_daily_usage" PRIMARY KEY ("userId", "date"),
        CONSTRAINT "FK_precision_tap_daily_usage_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "precision_tap_daily_usage"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_precision_tap_rounds_userId_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "precision_tap_rounds"`);
  }
}
