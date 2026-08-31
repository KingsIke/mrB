import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCallHistory1760000000000 implements MigrationInterface {
  name = 'CreateCallHistory1760000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Create the call_history table
    await queryRunner.query(`
      CREATE TABLE "call_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "callerId" uuid NOT NULL,
        "calleeId" uuid NOT NULL,
        "streamCallId" varchar(255),
        "callType" varchar(10) NOT NULL DEFAULT 'video',
        "status" varchar(20) NOT NULL DEFAULT 'missed',
        "duration" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "startedAt" TIMESTAMPTZ,
        "endedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_call_history_id" PRIMARY KEY ("id")
      )
    `);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "call_history"
      ADD CONSTRAINT "FK_call_history_caller"
      FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "call_history"
      ADD CONSTRAINT "FK_call_history_callee"
      FOREIGN KEY ("calleeId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    // Add indexes for efficient queries
    await queryRunner.query(`
      CREATE INDEX "IDX_call_history_caller_created"
      ON "call_history" ("callerId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_call_history_callee_created"
      ON "call_history" ("calleeId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_call_history_status"
      ON "call_history" ("status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "call_history"`);
  }
}
