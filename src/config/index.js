/**
 * Centralized configuration loaded from environment variables.
 * Validates that all required values are present at startup.
 */

require("dotenv").config();

const requiredVars = [
  "SQL_SERVER",
  "SQL_DATABASE",
];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`\n  ❌  Missing required env vars: ${missing.join(", ")}`);
  console.error("     Copy .env.example to .env and fill in the values.\n");
  process.exit(1);
}

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),

  api: {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3000/api",
    timeoutMs: parseInt(process.env.API_TIMEOUT_MS || "10000", 10),
  },

  ws: {
    url: process.env.WS_URL || "ws://localhost:3000",
  },

  sql: {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
  },

  logLevel: process.env.LOG_LEVEL || "info",
};