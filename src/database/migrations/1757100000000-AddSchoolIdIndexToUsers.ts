import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolIdIndexToUsers1757100000000
  implements MigrationInterface
{
  name = 'AddSchoolIdIndexToUsers1757100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_users_schoolId" ON "users" ("schoolId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_users_schoolId"`,
    );
  }
}
