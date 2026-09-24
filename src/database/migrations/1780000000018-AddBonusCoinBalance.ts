import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBonusCoinBalance1780000000018 implements MigrationInterface {
  name = 'AddBonusCoinBalance1780000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "coin_balances" ADD COLUMN "bonusBalance" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "coin_balances" ADD COLUMN "stakedBonus" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coin_balances" DROP COLUMN "stakedBonus"`);
    await queryRunner.query(`ALTER TABLE "coin_balances" DROP COLUMN "bonusBalance"`);
  }
}
