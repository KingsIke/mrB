import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWordGameXpType1780000000006 implements MigrationInterface {
  name = 'AddWordGameXpType1780000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "xp_transactions_source_enum" ADD VALUE IF NOT EXISTS 'word_game_win'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
