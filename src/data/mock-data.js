/**
 * In-memory mock data store for the cooperative platformer game.
 *
 * All data lives here — no MongoDB needed.
 * The store is mutable: WebSocket handlers can register new players,
 * create games, record movements, etc. at runtime.
 */

const { v4: uuidv4 } = require("uuid");

// ─── Helper: generate a fake Mongo-style ObjectId ────────────────────────────
function objectId() {
  return uuidv4().replace(/-/g, "").substring(0, 24);
}

// ─── Player Categories ──────────────────────────────────────────────────────
const categories = [
  { _id: objectId(), code: "JUN", name: "Junior", minGamesPlayed: 0 },
  { _id: objectId(), code: "SEN", name: "Senior", minGamesPlayed: 10 },
  { _id: objectId(), code: "EXP", name: "Expert", minGamesPlayed: 50 },
];

// ─── Players ─────────────────────────────────────────────────────────────────
const players = [
  {
    _id: objectId(),
    nickname: "PixelKnight",
    categoryCode: "SEN",
    totalGamesPlayed: 25,
    totalLevelsCompleted: 48,
    totalPlayTimeSeconds: 18400,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  },
  {
    _id: objectId(),
    nickname: "StarJumper",
    categoryCode: "JUN",
    totalGamesPlayed: 3,
    totalLevelsCompleted: 5,
    totalPlayTimeSeconds: 2100,
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-18T00:00:00.000Z",
  },
  {
    _id: objectId(),
    nickname: "CoopMaster",
    categoryCode: "EXP",
    totalGamesPlayed: 82,
    totalLevelsCompleted: 160,
    totalPlayTimeSeconds: 72000,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  },
  {
    _id: objectId(),
    nickname: "RunnerX",
    categoryCode: "SEN",
    totalGamesPlayed: 14,
    totalLevelsCompleted: 28,
    totalPlayTimeSeconds: 10800,
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
];

// ─── Games ───────────────────────────────────────────────────────────────────
const gameId1 = objectId();
const gameId2 = objectId();

const games = [
  {
    _id: gameId1,
    status: "completed",
    players: [
      { nickname: "PixelKnight", joinedAt: "2026-04-20T10:00:00.000Z" },
      { nickname: "StarJumper", joinedAt: "2026-04-20T10:00:05.000Z" },
      { nickname: "CoopMaster", joinedAt: "2026-04-20T10:00:12.000Z" },
    ],
    currentLevel: 2,
    levelsCompleted: 2,
    startedAt: "2026-04-20T10:01:00.000Z",
    finishedAt: "2026-04-20T10:15:30.000Z",
    totalDurationSeconds: 870,
  },
  {
    _id: gameId2,
    status: "in_progress",
    players: [
      { nickname: "RunnerX", joinedAt: "2026-04-22T14:00:00.000Z" },
      { nickname: "CoopMaster", joinedAt: "2026-04-22T14:00:08.000Z" },
    ],
    currentLevel: 1,
    levelsCompleted: 0,
    startedAt: "2026-04-22T14:01:00.000Z",
    finishedAt: null,
    totalDurationSeconds: null,
  },
];

// ─── Movements ───────────────────────────────────────────────────────────────
const movements = [
  {
    _id: objectId(),
    gameId: gameId1,
    nickname: "PixelKnight",
    action: "move_right",
    positionX: 120.5,
    positionY: 64.0,
    level: 1,
    timestamp: "2026-04-20T10:01:05.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId1,
    nickname: "PixelKnight",
    action: "jump",
    positionX: 180.0,
    positionY: 128.0,
    level: 1,
    timestamp: "2026-04-20T10:01:08.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId1,
    nickname: "StarJumper",
    action: "move_left",
    positionX: 90.0,
    positionY: 64.0,
    level: 1,
    timestamp: "2026-04-20T10:01:06.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId1,
    nickname: "CoopMaster",
    action: "pick_key",
    positionX: 300.0,
    positionY: 64.0,
    level: 1,
    timestamp: "2026-04-20T10:03:20.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId1,
    nickname: "CoopMaster",
    action: "open_door",
    positionX: 480.0,
    positionY: 64.0,
    level: 1,
    timestamp: "2026-04-20T10:05:00.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId2,
    nickname: "RunnerX",
    action: "move_right",
    positionX: 50.0,
    positionY: 64.0,
    level: 1,
    timestamp: "2026-04-22T14:01:10.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId2,
    nickname: "CoopMaster",
    action: "jump",
    positionX: 75.0,
    positionY: 130.0,
    level: 1,
    timestamp: "2026-04-22T14:01:12.000Z",
  },
];

// ─── Level Records ───────────────────────────────────────────────────────────
const levelRecords = [
  {
    _id: objectId(),
    gameId: gameId1,
    level: 1,
    completionTimeSeconds: 240.0,
    players: ["PixelKnight", "StarJumper", "CoopMaster"],
    completedAt: "2026-04-20T10:05:00.000Z",
  },
  {
    _id: objectId(),
    gameId: gameId1,
    level: 2,
    completionTimeSeconds: 630.0,
    players: ["PixelKnight", "StarJumper", "CoopMaster"],
    completedAt: "2026-04-20T10:15:30.000Z",
  },
];

// ─── Lobby (active WebSocket players waiting to join a game) ─────────────────
const lobby = [];

// ─── Public API ──────────────────────────────────────────────────────────────
module.exports = {
  categories,
  players,
  games,
  movements,
  levelRecords,
  lobby,
  objectId,
};
