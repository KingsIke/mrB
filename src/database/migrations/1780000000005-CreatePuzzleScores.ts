import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePuzzleScores1780000000005 implements MigrationInterface {
  name = 'CreatePuzzleScores1780000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "puzzle_scores" (
        "userId" uuid NOT NULL,
        "bestScore" integer NOT NULL DEFAULT 0,
        "highestTile" integer NOT NULL DEFAULT 0,
        "gamesPlayed" integer NOT NULL DEFAULT 0,
        "milestonesAwarded" text NOT NULL DEFAULT '[]',
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_puzzle_scores_userId" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_puzzle_scores_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_puzzle_scores_bestScore" ON "puzzle_scores" ("bestScore" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_puzzle_scores_bestScore"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "puzzle_scores"`);
  }
}
