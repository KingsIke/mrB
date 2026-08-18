import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddPinnedByToGroupMessages1740000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'group_messages',
      new TableColumn({
        name: 'pinnedById',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'group_messages',
      new TableForeignKey({
        columnNames: ['pinnedById'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('group_messages');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.includes('pinnedById'));
    if (foreignKey) {
      await queryRunner.dropForeignKey('group_messages', foreignKey);
    }
    await queryRunner.dropColumn('group_messages', 'pinnedById');
  }
}
