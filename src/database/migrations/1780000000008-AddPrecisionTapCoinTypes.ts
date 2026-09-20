import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrecisionTapCoinTypes1780000000008 implements MigrationInterface {
  name = 'AddPrecisionTapCoinTypes1780000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'precision_tap_stake'`,
    );
    await queryRunner.query(
      `ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'precision_tap_win'`,
    );
    await queryRunner.query(
      `ALTER TYPE "coin_transactions_type_enum" ADD VALUE IF NOT EXISTS 'precision_tap_refund'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL doesn't support removing individual enum values.
    // A full enum recreation would be needed for rollback.
  }
}
