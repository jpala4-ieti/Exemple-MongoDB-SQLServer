#!/usr/bin/env node

/**
 * Sync Script: Mock API → SQL Server (Navision)
 *
 * Fetches all game data from the local mock REST API and upserts
 * into Navision SQL Server tables prefixed with XCOOP42_.
 *
 * Run:  npm run sync   (server must be running: npm start)
 */

const api = require("../services/api-client");
const { connect, close, sql } = require("../services/sqlserver");
const logger = require("../config/logger");

// ── FK resolution caches ─────────────────────────────────────────────────────
const playerIdCache = new Map();
const gameIdCache = new Map();

async function resolvePlayerId(pool, nickname) {
  if (playerIdCache.has(nickname)) return playerIdCache.get(nickname);
  const r = await pool
    .request()
    .input("nickname", sql.NVarChar(100), nickname)
    .query("SELECT [Id] FROM [dbo].[XCOOP42_Player] WHERE [Nickname] = @nickname");
  const id = r.recordset[0]?.Id ?? null;
  if (id) playerIdCache.set(nickname, id);
  return id;
}

async function resolveGameId(pool, mongoId) {
  if (gameIdCache.has(mongoId)) return gameIdCache.get(mongoId);
  const r = await pool
    .request()
    .input("mongoId", sql.NVarChar(50), mongoId)
    .query("SELECT [Id] FROM [dbo].[XCOOP42_Game] WHERE [MongoId] = @mongoId");
  const id = r.recordset[0]?.Id ?? null;
  if (id) gameIdCache.set(mongoId, id);
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════
// Sync functions
// ═══════════════════════════════════════════════════════════════════════════

async function syncCategories(pool, categories) {
  logger.info(`Syncing ${categories.length} categories…`);
  for (const cat of categories) {
    await pool
      .request()
      .input("code", sql.NVarChar(10), cat.code)
      .input("name", sql.NVarChar(50), cat.name)
      .input("minGames", sql.Int, cat.minGamesPlayed)
      .query(`
        MERGE [dbo].[XCOOP42_PlayerCategory] AS target
        USING (SELECT @code AS [Code]) AS source ON target.[Code] = source.[Code]
        WHEN MATCHED THEN UPDATE SET [Name]=@name, [MinGamesPlayed]=@minGames
        WHEN NOT MATCHED THEN INSERT ([Code],[Name],[MinGamesPlayed]) VALUES (@code,@name,@minGames);
      `);
  }
  logger.info("Categories synced");
}

async function syncPlayers(pool, players) {
  logger.info(`Syncing ${players.length} players…`);
  for (const p of players) {
    await pool
      .request()
      .input("mongoId", sql.NVarChar(50), p._id || null)
      .input("nickname", sql.NVarChar(100), p.nickname)
      .input("categoryCode", sql.NVarChar(10), p.categoryCode)
      .input("totalGamesPlayed", sql.Int, p.totalGamesPlayed ?? 0)
      .input("totalLevelsCompleted", sql.Int, p.totalLevelsCompleted ?? 0)
      .input("totalPlayTimeSeconds", sql.Int, p.totalPlayTimeSeconds ?? 0)
      .input("createdAt", sql.DateTime2, new Date(p.createdAt))
      .input("updatedAt", sql.DateTime2, p.updatedAt ? new Date(p.updatedAt) : null)
      .query(`
        MERGE [dbo].[XCOOP42_Player] AS target
        USING (SELECT @nickname AS [Nickname]) AS source ON target.[Nickname] = source.[Nickname]
        WHEN MATCHED THEN
          UPDATE SET [MongoId]=@mongoId,[CategoryCode]=@categoryCode,
            [TotalGamesPlayed]=@totalGamesPlayed,[TotalLevelsCompleted]=@totalLevelsCompleted,
            [TotalPlayTimeSeconds]=@totalPlayTimeSeconds,[UpdatedAt]=@updatedAt,
            [SyncedAt]=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT ([MongoId],[Nickname],[CategoryCode],[TotalGamesPlayed],
                  [TotalLevelsCompleted],[TotalPlayTimeSeconds],[CreatedAt],[UpdatedAt])
          VALUES (@mongoId,@nickname,@categoryCode,@totalGamesPlayed,
                  @totalLevelsCompleted,@totalPlayTimeSeconds,@createdAt,@updatedAt);
      `);
  }
  playerIdCache.clear();
  logger.info("Players synced");
}

async function syncGames(pool, games) {
  logger.info(`Syncing ${games.length} games…`);
  for (const g of games) {
    const mongoId = g._id || null;
    await pool
      .request()
      .input("mongoId", sql.NVarChar(50), mongoId)
      .input("status", sql.NVarChar(20), g.status)
      .input("playerCount", sql.Int, g.players?.length ?? 0)
      .input("currentLevel", sql.Int, g.currentLevel ?? null)
      .input("levelsCompleted", sql.Int, g.levelsCompleted ?? 0)
      .input("startedAt", sql.DateTime2, new Date(g.startedAt))
      .input("finishedAt", sql.DateTime2, g.finishedAt ? new Date(g.finishedAt) : null)
      .input("totalDuration", sql.Int, g.totalDurationSeconds ?? null)
      .query(`
        MERGE [dbo].[XCOOP42_Game] AS target
        USING (SELECT @mongoId AS [MongoId]) AS source ON target.[MongoId] = source.[MongoId]
        WHEN MATCHED THEN
          UPDATE SET [Status]=@status,[PlayerCount]=@playerCount,[CurrentLevel]=@currentLevel,
            [LevelsCompleted]=@levelsCompleted,[FinishedAt]=@finishedAt,
            [TotalDurationSeconds]=@totalDuration,[SyncedAt]=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT ([MongoId],[Status],[PlayerCount],[CurrentLevel],
                  [LevelsCompleted],[StartedAt],[FinishedAt],[TotalDurationSeconds])
          VALUES (@mongoId,@status,@playerCount,@currentLevel,
                  @levelsCompleted,@startedAt,@finishedAt,@totalDuration);
      `);

    const gameId = await resolveGameId(pool, mongoId);
    if (!gameId) continue;

    for (const gp of g.players ?? []) {
      const playerId = await resolvePlayerId(pool, gp.nickname);
      if (!playerId) continue;
      await pool
        .request()
        .input("gameId", sql.Int, gameId)
        .input("playerId", sql.Int, playerId)
        .input("joinedAt", sql.DateTime2, gp.joinedAt ? new Date(gp.joinedAt) : null)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM [dbo].[XCOOP42_GamePlayer] WHERE [GameId]=@gameId AND [PlayerId]=@playerId)
          INSERT INTO [dbo].[XCOOP42_GamePlayer] ([GameId],[PlayerId],[JoinedAt]) VALUES (@gameId,@playerId,@joinedAt);
        `);
    }
  }
  gameIdCache.clear();
  logger.info("Games synced");
}

async function syncMovements(pool, movements) {
  logger.info(`Syncing ${movements.length} movements…`);
  for (const m of movements) {
    const gameId = m.gameId ? await resolveGameId(pool, m.gameId) : null;
    const playerId = await resolvePlayerId(pool, m.nickname);
    if (!gameId || !playerId) continue;

    await pool
      .request()
      .input("mongoId", sql.NVarChar(50), m._id || null)
      .input("gameId", sql.Int, gameId)
      .input("playerId", sql.Int, playerId)
      .input("action", sql.NVarChar(20), m.action)
      .input("posX", sql.Float, m.positionX ?? null)
      .input("posY", sql.Float, m.positionY ?? null)
      .input("level", sql.Int, m.level ?? 1)
      .input("ts", sql.DateTime2, new Date(m.timestamp))
      .query(`
        IF NOT EXISTS (SELECT 1 FROM [dbo].[XCOOP42_Movement] WHERE [MongoId]=@mongoId)
        INSERT INTO [dbo].[XCOOP42_Movement] ([MongoId],[GameId],[PlayerId],[Action],[PositionX],[PositionY],[Level],[Timestamp])
        VALUES (@mongoId,@gameId,@playerId,@action,@posX,@posY,@level,@ts);
      `);
  }
  logger.info("Movements synced");
}

async function syncLevelRecords(pool, records) {
  logger.info(`Syncing ${records.length} level records…`);
  for (const lr of records) {
    const gameId = lr.gameId ? await resolveGameId(pool, lr.gameId) : null;
    if (!gameId) continue;

    await pool
      .request()
      .input("mongoId", sql.NVarChar(50), lr._id || null)
      .input("gameId", sql.Int, gameId)
      .input("level", sql.Int, lr.level)
      .input("completionTime", sql.Float, lr.completionTimeSeconds)
      .input("completedAt", sql.DateTime2, new Date(lr.completedAt))
      .query(`
        IF NOT EXISTS (SELECT 1 FROM [dbo].[XCOOP42_LevelRecord] WHERE [MongoId]=@mongoId)
        INSERT INTO [dbo].[XCOOP42_LevelRecord] ([MongoId],[GameId],[Level],[CompletionTimeSeconds],[CompletedAt])
        VALUES (@mongoId,@gameId,@level,@completionTime,@completedAt);
      `);

    const lrResult = await pool
      .request()
      .input("mongoId", sql.NVarChar(50), lr._id || null)
      .query("SELECT [Id] FROM [dbo].[XCOOP42_LevelRecord] WHERE [MongoId]=@mongoId");
    const levelRecordId = lrResult.recordset[0]?.Id;
    if (!levelRecordId) continue;

    for (const nickname of lr.players ?? []) {
      const playerId = await resolvePlayerId(pool, nickname);
      if (!playerId) continue;
      await pool
        .request()
        .input("lrId", sql.Int, levelRecordId)
        .input("playerId", sql.Int, playerId)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM [dbo].[XCOOP42_LevelRecordPlayer] WHERE [LevelRecordId]=@lrId AND [PlayerId]=@playerId)
          INSERT INTO [dbo].[XCOOP42_LevelRecordPlayer] ([LevelRecordId],[PlayerId]) VALUES (@lrId,@playerId);
        `);
    }
  }
  logger.info("Level records synced");
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  const start = Date.now();
  logger.info("═══ Starting API → Navision sync (XCOOP42_ prefix) ═══");

  const pool = await connect();

  try {
    logger.info("Fetching full schema from mock API…");
    const schema = await api.fetchSchema();

    logger.info(
      {
        categories: schema.categories.length,
        players: schema.players.length,
        games: schema.games.length,
        movements: schema.movements.length,
        levelRecords: schema.levelRecords.length,
      },
      "Data fetched"
    );

    await syncCategories(pool, schema.categories);
    await syncPlayers(pool, schema.players);
    await syncGames(pool, schema.games);
    await syncMovements(pool, schema.movements);
    await syncLevelRecords(pool, schema.levelRecords);

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    logger.info(`═══ Sync completed in ${elapsed}s ═══`);
  } catch (err) {
    logger.error(err, "Sync failed");
    throw err;
  } finally {
    await close();
  }
}

main().catch(() => process.exit(1));
