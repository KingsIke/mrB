import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentUnionToUsers1770000003 implements MigrationInterface {
  name = 'AddStudentUnionToUsers1770000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "studentUnion" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "studentUnionStatus" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "studentUnionDocUrl" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "studentUnionDocUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "studentUnionStatus"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "studentUnion"`);
  }
}
