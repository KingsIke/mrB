import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhotTables1780000000014 implements MigrationInterface {
  name = 'AddWhotTables1780000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── New CoinTransactionType values for Whot entry/win/refund ──
    await queryRunner.query(`ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'whot_entry'`);
    await queryRunner.query(`ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'whot_win'`);
    await queryRunner.query(`ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'whot_refund'`);

    // ── whot_tables ──
    await queryRunner.query(`
      CREATE TYPE "whot_tables_status_enum" AS ENUM (
        'waiting', 'queued', 'matched', 'countdown', 'active', 'finished', 'cancelled', 'expired'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "whot_tables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" "whot_tables_status_enum" NOT NULL DEFAULT 'queued',
        "stake" integer NOT NULL,
        "pot" integer NOT NULL DEFAULT 0,
        "platformFee" integer NOT NULL DEFAULT 0,
        "winnerPrize" integer NOT NULL DEFAULT 0,
        "maxPlayers" integer NOT NULL,
        "minPlayers" integer NOT NULL DEFAULT 2,
        "deck" jsonb NOT NULL DEFAULT '[]',
        "discardPile" jsonb NOT NULL DEFAULT '[]',
        "currentTurnPlayerId" uuid,
        "turnDirection" integer NOT NULL DEFAULT 1,
        "pendingPickCount" integer NOT NULL DEFAULT 0,
        "requestedShape" character varying,
        "winnerId" uuid,
        "startedAt" TIMESTAMPTZ,
        "finishedAt" TIMESTAMPTZ,
        "queuedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whot_tables_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_whot_tables_winnerId" FOREIGN KEY ("winnerId")
          REFERENCES "users"("id")
      )
    `);

    // ── whot_table_players ──
    await queryRunner.query(`
      CREATE TABLE "whot_table_players" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tableId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "seatIndex" integer NOT NULL,
        "hand" jsonb NOT NULL DEFAULT '[]',
        "isActive" boolean NOT NULL DEFAULT true,
        "hasCalledLastCard" boolean NOT NULL DEFAULT false,
        "escrowed" boolean NOT NULL DEFAULT false,
        "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_whot_table_players_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_whot_table_players_tableId" FOREIGN KEY ("tableId")
          REFERENCES "whot_tables"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_whot_table_players_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_whot_table_players_tableId_seatIndex" ON "whot_table_players" ("tableId", "seatIndex")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_whot_table_players_tableId_seatIndex"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whot_table_players"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "whot_tables"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "whot_tables_status_enum"`);
    // PostgreSQL doesn't support removing individual enum values, so
    // whot_entry/whot_win/whot_refund stay on coin_transactions_type_enum.
    // A full enum recreation would be needed for a true rollback.
  }
}
