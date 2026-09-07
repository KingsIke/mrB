import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'school_social_app',
  synchronize: false,
  logging: true,
});

async function runMigration() {
  try {
    await dataSource.initialize();
    console.log('DataSource initialized');
    
    // Run raw SQL to add the columns
    console.log('Adding rejectionReason column...');
    await dataSource.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "rejectionReason" character varying(500) NULL
    `);
    
    console.log('Adding isStudentIdRejected column...');
    await dataSource.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "isStudentIdRejected" boolean NOT NULL DEFAULT false
    `);
    
    console.log('Adding isAdmissionLetterRejected column...');
    await dataSource.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "isAdmissionLetterRejected" boolean NOT NULL DEFAULT false
    `);
    
    console.log('Creating index on rejectionReason...');
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_rejectionReason" 
      ON "users" ("rejectionReason") 
      WHERE "rejectionReason" IS NOT NULL
    `);
    
    console.log('✅ Migration completed successfully');
    
    await dataSource.destroy();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runMigration();
