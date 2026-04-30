/**
 * SQL Server (Navision) connection pool – singleton pattern.
 */

const sql = require("mssql");
const config = require("../config");
const logger = require("../config/logger");

let pool = null;

async function connect() {
  if (pool) return pool;

  const sqlConfig = {
    server: config.sql.server,
    port: config.sql.port,
    database: config.sql.database,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: 30000,
  };

  logger.info(
    { server: sqlConfig.server, database: sqlConfig.database },
    "Connecting to SQL Server…"
  );

  pool = await sql.connect(sqlConfig);
  logger.info("SQL Server connected");
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
