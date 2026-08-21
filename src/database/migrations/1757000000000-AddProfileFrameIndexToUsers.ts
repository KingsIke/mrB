import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileFrameIndexToUsers1757000000000
  implements MigrationInterface
{
  name = 'AddProfileFrameIndexToUsers1757000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_users_profileFrame" ON "users" ("profileFrame")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_users_profileFrame"`,
    );
  }
}
