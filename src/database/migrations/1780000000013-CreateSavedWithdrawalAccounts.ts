import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedWithdrawalAccounts1780000000013 implements MigrationInterface {
  name = 'CreateSavedWithdrawalAccounts1780000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_withdrawal_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "bankCode" varchar(20) NOT NULL,
        "bankName" varchar(100),
        "accountNumber" varchar(20) NOT NULL,
        "accountName" varchar(150),
        "lastUsedAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_withdrawal_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_withdrawal_accounts_user_bank_account" UNIQUE ("userId", "bankCode", "accountNumber"),
        CONSTRAINT "FK_saved_withdrawal_accounts_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_saved_withdrawal_accounts_userId_lastUsedAt" ON "saved_withdrawal_accounts" ("userId", "lastUsedAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_withdrawal_accounts_userId_lastUsedAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_withdrawal_accounts"`);
  }
}
