#!/usr/bin/env node

/**
 * SQL Server Connection Test
 *
 * Verifies connectivity to the Navision SQL Server instance,
 * checks that the XCOOP42_ tables exist, and reports row counts.
 *
 * Run:  npm run test:db
 */

const { connect, close, sql } = require("../services/sqlserver");
const config = require("../config");
const logger = require("../config/logger");

const EXPECTED_TABLES = [
  "XCOOP42_PlayerCategory",
  "XCOOP42_Player",
  "XCOOP42_Game",
  "XCOOP42_GamePlayer",
  "XCOOP42_Movement",
  "XCOOP42_LevelRecord",
  "XCOOP42_LevelRecordPlayer",
];

const EXPECTED_VIEWS = [
  "XCOOP42_vw_LevelsCompletedByCategory",
  "XCOOP42_vw_AvgTimePerLevel",
  "XCOOP42_vw_PlayerRecords",
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function ok(msg) {
  console.log(`  ✅  ${msg}`);
}
function fail(msg) {
  console.log(`  ❌  ${msg}`);
}
function info(msg) {
  console.log(`  ℹ️   ${msg}`);
}

// ── Tests ────────────────────────────────────────────────────────────────────
async function testConnection(pool) {
  console.log("\n── 1. Connection ──────────────────────────────────────────");
  try {
    const result = await pool.request().query("SELECT 1 AS alive");
    if (result.recordset[0].alive === 1) {
      ok(`Connected to ${config.sql.server}:${config.sql.port}`);
    }
  } catch (err) {
    fail(`Connection failed: ${err.message}`);
    throw err;
  }
}

async function testServerInfo(pool) {
  console.log("\n── 2. Server Info ─────────────────────────────────────────");
  try {
    const version = await pool
      .request()
      .query("SELECT @@VERSION AS version");
    const versionStr = version.recordset[0].version.split("\n")[0];
    info(`Version: ${versionStr}`);

    const dbName = await pool
      .request()
      .query("SELECT DB_NAME() AS db");
    info(`Database: ${dbName.recordset[0].db}`);

    const serverName = await pool
      .request()
      .query("SELECT @@SERVERNAME AS name");
    info(`Server name: ${serverName.recordset[0].name}`);
  } catch (err) {
    fail(`Could not retrieve server info: ${err.message}`);
  }
}

async function testTablesExist(pool) {
  console.log("\n── 3. XCOOP42_ Tables ─────────────────────────────────────");
  let found = 0;

  for (const table of EXPECTED_TABLES) {
    try {
      const result = await pool
        .request()
        .input("name", sql.NVarChar(128), table)
        .query(
          "SELECT COUNT(*) AS exists_ FROM sys.tables WHERE name = @name"
        );

      if (result.recordset[0].exists_ > 0) {
        // Get row count
        const countResult = await pool
          .request()
          .query(`SELECT COUNT(*) AS cnt FROM [dbo].[${table}]`);
        ok(`${table.padEnd(35)} ${countResult.recordset[0].cnt} rows`);
        found++;
      } else {
        fail(`${table.padEnd(35)} NOT FOUND`);
      }
    } catch (err) {
      fail(`${table.padEnd(35)} ERROR: ${err.message}`);
    }
  }

  info(`${found}/${EXPECTED_TABLES.length} tables found`);
  return found;
}

async function testViewsExist(pool) {
  console.log("\n── 4. XCOOP42_ Views ──────────────────────────────────────");
  let found = 0;

  for (const view of EXPECTED_VIEWS) {
    try {
      const result = await pool
        .request()
        .input("name", sql.NVarChar(128), view)
        .query(
          "SELECT COUNT(*) AS exists_ FROM sys.views WHERE name = @name"
        );

      if (result.recordset[0].exists_ > 0) {
        // Try to query the view
        const viewResult = await pool
          .request()
          .query(`SELECT COUNT(*) AS cnt FROM [dbo].[${view}]`);
        ok(`${view.padEnd(45)} ${viewResult.recordset[0].cnt} rows`);
        found++;
      } else {
        fail(`${view.padEnd(45)} NOT FOUND`);
      }
    } catch (err) {
      fail(`${view.padEnd(45)} ERROR: ${err.message}`);
    }
  }

  info(`${found}/${EXPECTED_VIEWS.length} views found`);
  return found;
}

async function testReadWrite(pool) {
  console.log("\n── 5. Read/Write Test ─────────────────────────────────────");

  const testCode = "TST";
  const testName = "__ConnectionTest__";

  try {
    // Insert a test row
    await pool
      .request()
      .input("code", sql.NVarChar(10), testCode)
      .input("name", sql.NVarChar(50), testName)
      .input("minGames", sql.Int, 999)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM [dbo].[XCOOP42_PlayerCategory] WHERE [Code] = @code)
          INSERT INTO [dbo].[XCOOP42_PlayerCategory] ([Code],[Name],[MinGamesPlayed])
          VALUES (@code, @name, @minGames)
      `);

    // Read it back
    const readResult = await pool
      .request()
      .input("code", sql.NVarChar(10), testCode)
      .query(
        "SELECT [Name] FROM [dbo].[XCOOP42_PlayerCategory] WHERE [Code] = @code"
      );

    if (readResult.recordset[0]?.Name === testName) {
      ok("INSERT + SELECT verified");
    } else {
      fail("Read-back did not match");
    }

    // Clean up
    await pool
      .request()
      .input("code", sql.NVarChar(10), testCode)
      .query(
        "DELETE FROM [dbo].[XCOOP42_PlayerCategory] WHERE [Code] = @code"
      );
    ok("Cleanup (DELETE) succeeded");
  } catch (err) {
    if (err.message.includes("Invalid object name")) {
      fail(`Table does not exist yet — run 'npm run migrate' first`);
    } else {
      fail(`Read/Write test failed: ${err.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        SQL Server Connection Test (XCOOP42_)           ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  console.log(`\n  Target: ${config.sql.server}/${config.sql.database} (Windows Authentication)`);

  let pool;
  try {
    pool = await connect();
  } catch (err) {
    fail(`Cannot connect to SQL Server: ${err.message}`);
    console.log("\n  Checklist:");
    console.log("    • Is SQL Server running?");
    console.log("    • Is the ODBC Driver for SQL Server installed?");
    console.log("    • Does your Windows user have access to the database?");
    console.log("    • Is TCP/IP enabled on the SQL Server instance?\n");
    process.exit(1);
  }

  try {
    await testConnection(pool);
    await testServerInfo(pool);
    const tablesFound = await testTablesExist(pool);
    const viewsFound = await testViewsExist(pool);
    await testReadWrite(pool);

    // ── Summary ──────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════════");
    if (
      tablesFound === EXPECTED_TABLES.length &&
      viewsFound === EXPECTED_VIEWS.length
    ) {
      console.log("  🎉  All tests passed! Database is fully set up.");
    } else if (tablesFound === 0 && viewsFound === 0) {
      console.log("  ⚠️   Connection OK, but no XCOOP42_ tables found.");
      console.log("       Run 'npm run migrate' to create them.");
    } else {
      console.log("  ⚠️   Some objects are missing. Review output above.");
    }
    console.log("");
  } catch (err) {
    // Connection test already logged the error
  } finally {
    await close();
  }
}

main().catch((err) => {
  logger.error(err, "Test script crashed");
  process.exit(1);
});
