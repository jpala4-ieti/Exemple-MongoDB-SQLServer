# API & WebSocket Documentation

> All collection names and SQL table names use the **XCOOP42_** prefix
> to avoid collisions with existing data.

## REST Endpoints

All REST endpoints return a standard envelope:

```json
{
  "success": true,
  "count": 4,
  "timestamp": "2026-04-30T12:00:00.000Z",
  "data": [ ... ]
}
```

---

### `GET /api/schema` — Full schema (everything at once)

Returns all collections in a single response with prefixed keys:

```json
{
  "success": true,
  "count": 1,
  "timestamp": "2026-04-30T12:00:00.000Z",
  "data": {
    "xcoop42_categories": [ ... ],
    "xcoop42_players": [ ... ],
    "xcoop42_games": [ ... ],
    "xcoop42_movements": [ ... ],
    "xcoop42_level_records": [ ... ],
    "xcoop42_lobby": [ ... ]
  }
}
```

---

### `GET /api/xcoop42_categories`

```json
{
  "data": [
    { "_id": "a1b2c3...", "code": "JUN", "name": "Junior", "minGamesPlayed": 0 },
    { "_id": "d4e5f6...", "code": "SEN", "name": "Senior", "minGamesPlayed": 10 },
    { "_id": "g7h8i9...", "code": "EXP", "name": "Expert", "minGamesPlayed": 50 }
  ]
}
```

---

### `GET /api/xcoop42_players`

```json
{
  "data": [
    {
      "_id": "a1b2c3...",
      "nickname": "PixelKnight",
      "categoryCode": "SEN",
      "totalGamesPlayed": 25,
      "totalLevelsCompleted": 48,
      "totalPlayTimeSeconds": 18400,
      "createdAt": "2026-03-01T00:00:00.000Z",
      "updatedAt": "2026-04-20T00:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/xcoop42_games` — `?status=completed|in_progress|waiting|abandoned`

```json
{
  "data": [
    {
      "_id": "x1y2z3...",
      "status": "completed",
      "players": [
        { "nickname": "PixelKnight", "joinedAt": "2026-04-20T10:00:00.000Z" }
      ],
      "currentLevel": 2,
      "levelsCompleted": 2,
      "startedAt": "2026-04-20T10:01:00.000Z",
      "finishedAt": "2026-04-20T10:15:30.000Z",
      "totalDurationSeconds": 870
    }
  ]
}
```

---

### `GET /api/xcoop42_movements` — `?gameId=<id>`

```json
{
  "data": [
    {
      "_id": "m1m2m3...",
      "gameId": "x1y2z3...",
      "nickname": "PixelKnight",
      "action": "move_right",
      "positionX": 120.5,
      "positionY": 64.0,
      "level": 1,
      "timestamp": "2026-04-20T10:01:05.000Z"
    }
  ]
}
```

Possible `action` values: `move_left`, `move_right`, `jump`, `pick_key`, `open_door`

---

### `GET /api/xcoop42_level_records` — `?level=<int>`

```json
{
  "data": [
    {
      "_id": "r1r2r3...",
      "gameId": "x1y2z3...",
      "level": 1,
      "completionTimeSeconds": 240.0,
      "players": ["PixelKnight", "StarJumper", "CoopMaster"],
      "completedAt": "2026-04-20T10:05:00.000Z"
    }
  ]
}
```

---

### `GET /api/xcoop42_lobby`

Returns players currently connected via WebSocket.

```json
{
  "data": [
    { "nickname": "NewPlayer", "categoryCode": "JUN", "joinedAt": "2026-04-30T14:00:00.000Z" }
  ]
}
```

---

## SQL Server Tables (Navision)

All tables use the `XCOOP42_` prefix:

| Table                          | Description                              |
|--------------------------------|------------------------------------------|
| `XCOOP42_PlayerCategory`       | JUN / SEN / EXP tier definitions         |
| `XCOOP42_Player`               | Player master data with FK to category   |
| `XCOOP42_Game`                 | Game session headers                     |
| `XCOOP42_GamePlayer`           | Many-to-many: players in games           |
| `XCOOP42_Movement`             | Detailed action log                      |
| `XCOOP42_LevelRecord`          | Level completion times                   |
| `XCOOP42_LevelRecordPlayer`    | Many-to-many: players in level records   |

### ERP Indicator Views

| View                                         | Description                       |
|----------------------------------------------|-----------------------------------|
| `XCOOP42_vw_LevelsCompletedByCategory`       | Levels by player category         |
| `XCOOP42_vw_AvgTimePerLevel`                 | Avg/best/worst time per level     |
| `XCOOP42_vw_PlayerRecords`                   | Player dashboard + personal bests |

---

## WebSocket Protocol

**Endpoint:** `ws://localhost:3000/ws`

All messages are JSON. The `type` field determines the message kind.

### Client → Server

| type         | fields                                      | description              |
|--------------|---------------------------------------------|--------------------------|
| `register`   | `nickname`                                  | Join the lobby           |
| `move`       | `action`, `positionX`, `positionY`, `level` | Send player movement     |
| `pick_key`   | `positionX`, `positionY`, `level`           | Player picks up the key  |
| `open_door`  | `positionX`, `positionY`, `level`           | Player opens the door    |
| `chat`       | `message`                                   | Send a chat message      |
| `leave`      | —                                           | Leave the lobby          |

### Server → Client

| type             | fields                                | description                     |
|------------------|---------------------------------------|---------------------------------|
| `welcome`        | `playerId`, `nickname`, `lobby`       | Sent to newly registered player |
| `player_joined`  | `nickname`, `categoryCode`, `lobby`   | Broadcast when a player joins   |
| `player_left`    | `nickname`, `lobby`                   | Broadcast when a player leaves  |
| `player_moved`   | `nickname`, `action`, `positionX`...  | Broadcast on movement           |
| `key_picked`     | `nickname`                            | Broadcast when key is picked    |
| `door_opened`    | `nickname`                            | Broadcast when door opens       |
| `chat_message`   | `nickname`, `message`, `timestamp`    | Broadcast chat                  |
| `error`          | `message`                             | Sent on validation errors       |
| `goodbye`        | `message`                             | Sent after voluntary leave      |
