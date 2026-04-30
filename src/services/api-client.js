/**
 * HTTP client that fetches game data from the mock REST API.
 *
 * Supports both individual endpoints and the combined /schema endpoint.
 */

const axios = require("axios");
const config = require("../config");
const logger = require("../config/logger");

const client = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeoutMs,
  headers: { Accept: "application/json" },
});

client.interceptors.response.use(
  (res) => {
    logger.debug(
      { status: res.status, url: res.config.url },
      "API response"
    );
    return res;
  },
  (err) => {
    logger.error(
      { message: err.message, url: err.config?.url },
      "API request failed"
    );
    throw err;
  }
);

// ── Fetch everything at once via /schema ─────────────────────────────────────
async function fetchSchema() {
  const { data } = await client.get("/schema");
  return data.data; // { categories, players, games, movements, levelRecords, lobby }
}

// ── Individual endpoints ─────────────────────────────────────────────────────
async function fetchCategories() {
  const { data } = await client.get("/categories");
  return data.data;
}

async function fetchPlayers() {
  const { data } = await client.get("/players");
  return data.data;
}

async function fetchGames() {
  const { data } = await client.get("/games");
  return data.data;
}

async function fetchMovements(gameId) {
  const { data } = await client.get("/movements", {
    params: gameId ? { gameId } : {},
  });
  return data.data;
}

async function fetchLevelRecords() {
  const { data } = await client.get("/level-records");
  return data.data;
}

module.exports = {
  fetchSchema,
  fetchCategories,
  fetchPlayers,
  fetchGames,
  fetchMovements,
  fetchLevelRecords,
};
