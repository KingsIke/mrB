import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStarterGameCoins1780000000020 implements MigrationInterface {
  name = 'AddStarterGameCoins1780000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'starter_game_coins'`,
    );
    await queryRunner.query(
      `ALTER TABLE "coin_balances" ADD COLUMN IF NOT EXISTS "starterGameCoinsGrantedAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coin_balances" DROP COLUMN IF EXISTS "starterGameCoinsGrantedAt"`);
    // The 'starter_game_coins' enum value is left in place: Postgres can't drop
    // enum values, and existing transactions may reference it.
  }
}
