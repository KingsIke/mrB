/**
 * Run: npx ts-node src/gifts/migrate-rarity.ts
 *
 * Connects to the database using the same env vars as the NestJS app
 * and sets rarity on all gifts based on their coinCost.
 */

import { DataSource } from 'typeorm';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'school_social_app',
  });

  await ds.initialize();
  console.log('Connected to database.');

  // Set rarity based on coinCost tiers (matching the seed catalog)
  const queries = [
    `UPDATE gifts SET rarity = 'common' WHERE "coinCost" < 20 AND (rarity IS NULL OR rarity = '')`,
    `UPDATE gifts SET rarity = 'rare' WHERE "coinCost" >= 20 AND "coinCost" < 250 AND (rarity IS NULL OR rarity = '')`,
    `UPDATE gifts SET rarity = 'epic' WHERE "coinCost" >= 250 AND "coinCost" < 2000 AND (rarity IS NULL OR rarity = '')`,
    `UPDATE gifts SET rarity = 'legendary' WHERE "coinCost" >= 2000 AND "coinCost" < 10000 AND (rarity IS NULL OR rarity = '')`,
    `UPDATE gifts SET rarity = 'mythic' WHERE "coinCost" >= 10000 AND (rarity IS NULL OR rarity = '')`,
  ];

  for (const sql of queries) {
    const result = await ds.query(sql);
    console.log(result);
  }

  // Verify
  const rows = await ds.query('SELECT name, "coinCost", rarity FROM gifts ORDER BY "coinCost"');
  console.table(rows);

  await ds.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
