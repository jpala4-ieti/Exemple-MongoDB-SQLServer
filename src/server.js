#!/usr/bin/env node

/**
 * Cooperative Platformer — Mock API Server
 *
 * Combines Express (REST) and WebSocket (ws) on the same HTTP port.
 * No external databases required — all data lives in memory.
 *
 * Run:  npm start
 */

const http = require("http");
const express = require("express");
const cors = require("cors");
const { WebSocketServer } = require("ws");

const config = require("./config");
const logger = require("./config/logger");
const apiRoutes = require("./routes/api");
const { initWebSocket } = require("./ws/handler");

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) =>
  res.json({ status: "ok", uptime: process.uptime() })
);

// REST API routes
app.use("/api", apiRoutes);

// 404 fallback
app.use((_req, res) =>
  res.status(404).json({ success: false, error: "Not found" })
);

// Error handler
app.use((err, _req, res, _next) => {
  logger.error(err);
  res.status(500).json({ success: false, error: err.message });
});

// ── HTTP + WebSocket server on the same port ─────────────────────────────────
const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });
initWebSocket(wss);

server.listen(config.port, () => {
  logger.info(`Server listening on port ${config.port}`);
  logger.info("");
  logger.info("REST endpoints (XCOOP42_ prefix):");
  logger.info(`  GET  http://localhost:${config.port}/api/schema`);
  logger.info(`  GET  http://localhost:${config.port}/api/xcoop42_categories`);
  logger.info(`  GET  http://localhost:${config.port}/api/xcoop42_players`);
  logger.info(`  GET  http://localhost:${config.port}/api/xcoop42_games            ?status=`);
  logger.info(`  GET  http://localhost:${config.port}/api/xcoop42_movements        ?gameId=`);
  logger.info(`  GET  http://localhost:${config.port}/api/xcoop42_level_records    ?level=`);
  logger.info(`  GET  http://localhost:${config.port}/api/xcoop42_lobby`);
  logger.info("");
  logger.info("WebSocket:");
  logger.info(`  ws://localhost:${config.port}/ws`);
  logger.info("");
});
