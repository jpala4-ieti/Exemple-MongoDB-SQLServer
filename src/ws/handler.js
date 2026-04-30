/**
 * WebSocket event handler for the cooperative platformer.
 *
 * Supported client → server messages (JSON):
 *
 *   { "type": "register",    "nickname": "PixelKnight" }
 *   { "type": "move",        "action": "move_right", "positionX": 120, "positionY": 64 }
 *   { "type": "pick_key" }
 *   { "type": "open_door" }
 *   { "type": "chat",        "message": "hello team!" }
 *   { "type": "leave" }
 *
 * Server → client messages:
 *
 *   { "type": "welcome",         "playerId": "...", "lobby": [...] }
 *   { "type": "player_joined",   "nickname": "...", "lobby": [...] }
 *   { "type": "player_left",     "nickname": "...", "lobby": [...] }
 *   { "type": "player_moved",    "nickname": "...", "action": "...", ... }
 *   { "type": "key_picked",      "nickname": "..." }
 *   { "type": "door_opened",     "nickname": "..." }
 *   { "type": "chat_message",    "nickname": "...", "message": "..." }
 *   { "type": "error",           "message": "..." }
 */

const store = require("../data/mock-data");
const logger = require("../config/logger");

// Map<WebSocket, { nickname: string }>
const clients = new Map();

/**
 * Broadcast a message to all connected WebSocket clients.
 * Optionally exclude a specific socket.
 */
function broadcast(wss, data, excludeSocket = null) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client !== excludeSocket && client.readyState === 1) {
      client.send(payload);
    }
  }
}

/**
 * Send a message to a single socket.
 */
function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Remove a player from the lobby and notify everyone.
 */
function removePlayer(wss, ws) {
  const info = clients.get(ws);
  if (!info) return;

  const { nickname } = info;

  // Remove from lobby
  const idx = store.lobby.findIndex((p) => p.nickname === nickname);
  if (idx !== -1) store.lobby.splice(idx, 1);

  clients.delete(ws);

  logger.info({ nickname }, "Player disconnected");

  broadcast(wss, {
    type: "player_left",
    nickname,
    lobby: store.lobby,
  });
}

/**
 * Initialise WebSocket handling on the given WSS instance.
 */
function initWebSocket(wss) {
  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info({ ip }, "New WebSocket connection");

    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: "error", message: "Invalid JSON" });
      }

      switch (msg.type) {
        // ── Register a new player ──────────────────────────────────────
        case "register": {
          const nickname = (msg.nickname || "").trim();

          if (!nickname || nickname.length < 2 || nickname.length > 20) {
            return send(ws, {
              type: "error",
              message: "Nickname must be 2-20 characters",
            });
          }

          // Check duplicate in lobby
          if (store.lobby.some((p) => p.nickname === nickname)) {
            return send(ws, {
              type: "error",
              message: `Nickname "${nickname}" is already taken`,
            });
          }

          // Check lobby size (max 8 cooperative players)
          if (store.lobby.length >= 8) {
            return send(ws, {
              type: "error",
              message: "Lobby is full (max 8 players)",
            });
          }

          // Determine category based on existing player data or default
          const existingPlayer = store.players.find(
            (p) => p.nickname === nickname
          );
          const categoryCode = existingPlayer
            ? existingPlayer.categoryCode
            : "JUN";

          const lobbyEntry = {
            nickname,
            categoryCode,
            joinedAt: new Date().toISOString(),
          };

          store.lobby.push(lobbyEntry);
          clients.set(ws, { nickname });

          // If player doesn't exist yet, add to the players collection
          if (!existingPlayer) {
            store.players.push({
              _id: store.objectId(),
              nickname,
              categoryCode: "JUN",
              totalGamesPlayed: 0,
              totalLevelsCompleted: 0,
              totalPlayTimeSeconds: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }

          logger.info({ nickname, categoryCode }, "Player registered");

          // Welcome the new player
          send(ws, {
            type: "welcome",
            playerId: existingPlayer?._id || store.players.at(-1)._id,
            nickname,
            categoryCode,
            lobby: store.lobby,
          });

          // Notify everyone else
          broadcast(
            wss,
            {
              type: "player_joined",
              nickname,
              categoryCode,
              lobby: store.lobby,
            },
            ws
          );
          break;
        }

        // ── Player movement ────────────────────────────────────────────
        case "move": {
          const info = clients.get(ws);
          if (!info) {
            return send(ws, {
              type: "error",
              message: "Register first",
            });
          }

          const validActions = [
            "move_left",
            "move_right",
            "jump",
          ];
          if (!validActions.includes(msg.action)) {
            return send(ws, {
              type: "error",
              message: `Invalid action. Use: ${validActions.join(", ")}`,
            });
          }

          const movement = {
            _id: store.objectId(),
            gameId: null,
            nickname: info.nickname,
            action: msg.action,
            positionX: msg.positionX ?? 0,
            positionY: msg.positionY ?? 0,
            level: msg.level ?? 1,
            timestamp: new Date().toISOString(),
          };

          store.movements.push(movement);

          broadcast(wss, {
            type: "player_moved",
            nickname: info.nickname,
            action: msg.action,
            positionX: movement.positionX,
            positionY: movement.positionY,
            level: movement.level,
          });
          break;
        }

        // ── Pick key ───────────────────────────────────────────────────
        case "pick_key": {
          const info = clients.get(ws);
          if (!info)
            return send(ws, { type: "error", message: "Register first" });

          store.movements.push({
            _id: store.objectId(),
            gameId: null,
            nickname: info.nickname,
            action: "pick_key",
            positionX: msg.positionX ?? 0,
            positionY: msg.positionY ?? 0,
            level: msg.level ?? 1,
            timestamp: new Date().toISOString(),
          });

          broadcast(wss, {
            type: "key_picked",
            nickname: info.nickname,
          });
          break;
        }

        // ── Open door ──────────────────────────────────────────────────
        case "open_door": {
          const info = clients.get(ws);
          if (!info)
            return send(ws, { type: "error", message: "Register first" });

          store.movements.push({
            _id: store.objectId(),
            gameId: null,
            nickname: info.nickname,
            action: "open_door",
            positionX: msg.positionX ?? 0,
            positionY: msg.positionY ?? 0,
            level: msg.level ?? 1,
            timestamp: new Date().toISOString(),
          });

          broadcast(wss, {
            type: "door_opened",
            nickname: info.nickname,
          });
          break;
        }

        // ── Chat ───────────────────────────────────────────────────────
        case "chat": {
          const info = clients.get(ws);
          if (!info)
            return send(ws, { type: "error", message: "Register first" });

          broadcast(wss, {
            type: "chat_message",
            nickname: info.nickname,
            message: (msg.message || "").substring(0, 200),
            timestamp: new Date().toISOString(),
          });
          break;
        }

        // ── Voluntary leave ────────────────────────────────────────────
        case "leave": {
          removePlayer(wss, ws);
          send(ws, { type: "goodbye", message: "You have left the lobby" });
          break;
        }

        default:
          send(ws, {
            type: "error",
            message: `Unknown message type: "${msg.type}"`,
          });
      }
    });

    // ── Handle disconnect ────────────────────────────────────────────────
    ws.on("close", () => removePlayer(wss, ws));

    ws.on("error", (err) => {
      logger.error({ error: err.message }, "WebSocket error");
      removePlayer(wss, ws);
    });
  });

  logger.info("WebSocket handler initialised");
}

module.exports = { initWebSocket };
