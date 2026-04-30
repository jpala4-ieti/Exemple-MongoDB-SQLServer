/**
 * SQL Server (Navision) connection pool – singleton pattern.
 * Uses msnodesqlv8 driver for Windows (NTLM/Kerberos) authentication.
 */

const sql = require("mssql/msnodesqlv8");
const config = require("../config");
const logger = require("../config/logger");

let pool = null;

async function connect() {
  if (pool) return pool;

  const sqlConfig = {
    server: config.sql.server,
    database: config.sql.database,
    driver: "msnodesqlv8",
    options: {
      trustedConnection: true,
      trustServerCertificate:
        config.sql.options.trustServerCertificate,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
    // Optional: override connection string for named instances
    // connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${config.sql.server};Database=${config.sql.database};Trusted_Connection=yes;`,
  };

  logger.info(
    { server: sqlConfig.server, database: sqlConfig.database },
    "Connecting to SQL Server (Windows Auth / msnodesqlv8)…"
  );

  pool = await sql.connect(sqlConfig);
  logger.info("SQL Server connected (Windows Authentication)");
  return pool;
}

function getPool() {
  if (!pool) throw new Error("SQL Server not connected. Call connect() first.");
  return pool;
}

async function close() {
  if (pool) {
    await pool.close();
    pool = null;
    logger.info("SQL Server connection closed");
  }
}

module.exports = { connect, getPool, close, sql };
