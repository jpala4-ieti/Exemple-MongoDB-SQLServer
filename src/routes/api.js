/**
 * REST API routes – serves mock game data.
 *
 * Collection keys use the XCOOP42_ prefix to avoid collisions
 * with any existing data in downstream systems.
 *
 * Endpoints:
 *   GET /api/schema                → full schema (all collections at once)
 *   GET /api/xcoop42_categories    → player categories
 *   GET /api/xcoop42_players       → players
 *   GET /api/xcoop42_games         → game sessions       (?status=)
 *   GET /api/xcoop42_movements     → player movements    (?gameId=)
 *   GET /api/xcoop42_level_records → completion records   (?level=)
 *   GET /api/xcoop42_lobby         → current WebSocket lobby
 */

const { Router } = require("express");
const store = require("../data/mock-data");

const router = Router();

// ── Standard envelope ────────────────────────────────────────────────────────
function wrap(data) {
  return {
    success: true,
    count: Array.isArray(data) ? data.length : 1,
    timestamp: new Date().toISOString(),
    data,
  };
}

// ── GET /api/schema — everything at once (prefixed keys) ─────────────────────
router.get("/schema", (_req, res) => {
  res.json(
    wrap({
      xcoop42_categories: store.categories,
      xcoop42_players: store.players,
      xcoop42_games: store.games,
      xcoop42_movements: store.movements,
      xcoop42_level_records: store.levelRecords,
      xcoop42_lobby: store.lobby,
    })
  );
});

// ── GET /api/xcoop42_categories ──────────────────────────────────────────────
router.get("/xcoop42_categories", (_req, res) => {
  res.json(wrap(store.categories));
});

// ── GET /api/xcoop42_players ─────────────────────────────────────────────────
router.get("/xcoop42_players", (_req, res) => {
  res.json(wrap(store.players));
});

// ── GET /api/xcoop42_games ───────────────────────────────────────────────────
router.get("/xcoop42_games", (req, res) => {
  let result = store.games;
  if (req.query.status) {
    result = result.filter((g) => g.status === req.query.status);
  }
  res.json(wrap(result));
});

// ── GET /api/xcoop42_movements ───────────────────────────────────────────────
router.get("/xcoop42_movements", (req, res) => {
  let result = store.movements;
  if (req.query.gameId) {
    result = result.filter((m) => m.gameId === req.query.gameId);
  }
  res.json(wrap(result));
});

// ── GET /api/xcoop42_level_records ───────────────────────────────────────────
router.get("/xcoop42_level_records", (req, res) => {
  let result = store.levelRecords;
  if (req.query.level) {
    const level = parseInt(req.query.level, 10);
    result = result.filter((lr) => lr.level === level);
  }
  res.json(wrap(result));
});

// ── GET /api/xcoop42_lobby ───────────────────────────────────────────────────
router.get("/xcoop42_lobby", (_req, res) => {
  res.json(wrap(store.lobby));
});

module.exports = router;
