import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPuzzleXpAndCoinTypes1780000000004 implements MigrationInterface {
  name = 'AddPuzzleXpAndCoinTypes1780000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "xp_transactions_source_enum" ADD VALUE IF NOT EXISTS 'puzzle_milestone'`,
    );
    await queryRunner.query(
      `ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'puzzle_high_score'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
