import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSchoolTypeColumn1730000000000 implements MigrationInterface {
  name = 'AddSchoolTypeColumn1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schools" ADD "type" character varying(50)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "type"`);
  }
}
