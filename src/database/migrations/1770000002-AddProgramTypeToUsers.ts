import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProgramTypeToUsers1770000002 implements MigrationInterface {
  name = 'AddProgramTypeToUsers1770000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "programType" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "programType"`);
  }
}
