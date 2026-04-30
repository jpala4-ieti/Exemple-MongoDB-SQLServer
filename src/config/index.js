/**
 * Centralized configuration loaded from environment variables.
 * Only SQL_* vars are required when running the sync script;
 * the mock server itself needs no external services.
 */

require("dotenv").config();

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
    server: process.env.SQL_SERVER || "localhost",
    port: parseInt(process.env.SQL_PORT || "1433", 10),
    database: process.env.SQL_DATABASE || "NavisionGameDB",
    user: process.env.SQL_USER || "sa",
    password: process.env.SQL_PASSWORD || "",
    options: {
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate:
        process.env.SQL_TRUST_SERVER_CERTIFICATE !== "false",
    },
  },

  logLevel: process.env.LOG_LEVEL || "info",
};
