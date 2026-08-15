import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPasswordChangedAtToUsers1720000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'passwordChangedAt',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'passwordChangedAt');
  }
}
