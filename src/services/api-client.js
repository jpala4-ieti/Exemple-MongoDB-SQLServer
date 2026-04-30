/**
 * HTTP client that fetches game data from the mock REST API.
 *
 * All collection endpoints and schema keys use the XCOOP42_ prefix.
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
    logger.debug({ status: res.status, url: res.config.url }, "API response");
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
  const raw = data.data;

  // Return normalised keys so the sync script doesn't need to know the prefix
  return {
    categories: raw.xcoop42_categories,
    players: raw.xcoop42_players,
    games: raw.xcoop42_games,
    movements: raw.xcoop42_movements,
    levelRecords: raw.xcoop42_level_records,
    lobby: raw.xcoop42_lobby,
  };
}

// ── Individual endpoints ─────────────────────────────────────────────────────
async function fetchCategories() {
  const { data } = await client.get("/xcoop42_categories");
  return data.data;
}

async function fetchPlayers() {
  const { data } = await client.get("/xcoop42_players");
  return data.data;
}

async function fetchGames() {
  const { data } = await client.get("/xcoop42_games");
  return data.data;
}

async function fetchMovements(gameId) {
  const { data } = await client.get("/xcoop42_movements", {
    params: gameId ? { gameId } : {},
  });
  return data.data;
}

async function fetchLevelRecords() {
  const { data } = await client.get("/xcoop42_level_records");
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
