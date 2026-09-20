import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWordGameTables1780000000007 implements MigrationInterface {
  name = 'CreateWordGameTables1780000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "word_game_attempts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "puzzleNumber" integer NOT NULL,
        "guesses" text NOT NULL DEFAULT '[]',
        "won" boolean NOT NULL DEFAULT false,
        "completed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_word_game_attempts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_word_game_attempts_userId_puzzleNumber" UNIQUE ("userId", "puzzleNumber"),
        CONSTRAINT "FK_word_game_attempts_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_word_game_attempts_userId" ON "word_game_attempts" ("userId")
    `);

    await queryRunner.query(`
      CREATE TABLE "word_game_stats" (
        "userId" uuid NOT NULL,
        "currentStreak" integer NOT NULL DEFAULT 0,
        "longestStreak" integer NOT NULL DEFAULT 0,
        "totalPlayed" integer NOT NULL DEFAULT 0,
        "totalWon" integer NOT NULL DEFAULT 0,
        "guessDistribution" text NOT NULL DEFAULT '[0,0,0,0,0,0]',
        "lastPuzzleNumber" integer,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_word_game_stats_userId" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_word_game_stats_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "word_game_stats"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_word_game_attempts_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "word_game_attempts"`);
  }
}
