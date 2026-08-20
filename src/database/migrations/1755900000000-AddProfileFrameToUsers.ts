import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProfileFrameToUsers1755900000000 implements MigrationInterface {
  name = 'AddProfileFrameToUsers1755900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'profileFrame'))) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD "profileFrame" varchar(50)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'profileFrame')) {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "profileFrame"`);
    }
  }
}
