import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVerificationStatusToUsers1720000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'verificationStatus',
        type: 'varchar',
        length: '20',
        default: "'unverified'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'verificationStatus');
  }
}
