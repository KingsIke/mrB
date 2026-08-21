import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHighTrafficIndexesToUsers1757200000000
  implements MigrationInterface
{
  name = 'AddHighTrafficIndexesToUsers1757200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Trending users query filters on status='active' + deletedAt IS NULL + isOnboardingComplete=true
    await queryRunner.query(
      `CREATE INDEX "IDX_users_status" ON "users" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_deletedAt" ON "users" ("deletedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_isOnboardingComplete" ON "users" ("isOnboardingComplete")`,
    );

    // Leaderboard queries filter on activityStatus=true
    await queryRunner.query(
      `CREATE INDEX "IDX_users_activityStatus" ON "users" ("activityStatus")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_status"`);
    await queryRunner.query(`DROP INDEX "IDX_users_deletedAt"`);
    await queryRunner.query(`DROP INDEX "IDX_users_isOnboardingComplete"`);
    await queryRunner.query(`DROP INDEX "IDX_users_activityStatus"`);
  }
}
