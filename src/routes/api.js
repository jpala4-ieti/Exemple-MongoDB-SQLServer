/**
 * REST API routes – serves mock game data.
 *
 * Endpoints:
 *   GET /api/schema          → full schema (all collections at once)
 *   GET /api/categories      → player categories
 *   GET /api/players         → players
 *   GET /api/games           → game sessions       (?status=)
 *   GET /api/movements       → player movements    (?gameId=)
 *   GET /api/level-records   → completion records   (?level=)
 *   GET /api/lobby           → current WebSocket lobby
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

// ── GET /api/schema — everything at once ─────────────────────────────────────
router.get("/schema", (_req, res) => {
  res.json(
    wrap({
      categories: store.categories,
      players: store.players,
      games: store.games,
      movements: store.movements,
      levelRecords: store.levelRecords,
      lobby: store.lobby,
    })
  );
});

// ── GET /api/categories ──────────────────────────────────────────────────────
router.get("/categories", (_req, res) => {
  res.json(wrap(store.categories));
});

// ── GET /api/players ─────────────────────────────────────────────────────────
router.get("/players", (_req, res) => {
  res.json(wrap(store.players));
});

// ── GET /api/games ───────────────────────────────────────────────────────────
router.get("/games", (req, res) => {
  let result = store.games;
  if (req.query.status) {
    result = result.filter((g) => g.status === req.query.status);
  }
  res.json(wrap(result));
});

// ── GET /api/movements ───────────────────────────────────────────────────────
router.get("/movements", (req, res) => {
  let result = store.movements;
  if (req.query.gameId) {
    result = result.filter((m) => m.gameId === req.query.gameId);
  }
  res.json(wrap(result));
});

// ── GET /api/level-records ───────────────────────────────────────────────────
router.get("/level-records", (req, res) => {
  let result = store.levelRecords;
  if (req.query.level) {
    const level = parseInt(req.query.level, 10);
    result = result.filter((lr) => lr.level === level);
  }
  res.json(wrap(result));
});

// ── GET /api/lobby ───────────────────────────────────────────────────────────
router.get("/lobby", (_req, res) => {
  res.json(wrap(store.lobby));
});

module.exports = router;
