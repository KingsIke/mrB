import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisconnectedAtToWhotTablePlayers1780000000016 implements MigrationInterface {
  name = 'AddDisconnectedAtToWhotTablePlayers1780000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "whot_table_players" ADD COLUMN "disconnectedAt" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "whot_table_players" DROP COLUMN "disconnectedAt"`);
  }
}
