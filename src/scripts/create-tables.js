#!/usr/bin/env node

/**
 * Executes the SQL Server table creation script against Navision.
 * Run: npm run migrate
 */

const fs = require("fs");
const path = require("path");
const { connect, close } = require("../services/sqlserver");
const logger = require("../config/logger");

async function migrate() {
  const sqlPath = path.join(__dirname, "../../sql/create-tables.sql");
  const rawSql = fs.readFileSync(sqlPath, "utf-8");

  const batches = rawSql
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter(Boolean);

  const pool = await connect();

  logger.info(`Executing ${batches.length} SQL batches…`);

  for (let i = 0; i < batches.length; i++) {
    try {
      await pool.request().query(batches[i]);
      logger.debug(`Batch ${i + 1}/${batches.length} executed`);
    } catch (err) {
      logger.error({ batch: i + 1, message: err.message }, "Batch failed");
    }
  }

  logger.info("Migration completed");
  await close();
}

migrate().catch((err) => {
  logger.error(err, "Migration failed");
  process.exit(1);
});
