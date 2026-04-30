# API & WebSocket Documentation

## REST Endpoints

All REST endpoints return a standard envelope:

```json
{
  "success": true,
  "count": 4,
  "timestamp": "2026-04-29T12:00:00.000Z",
  "data": [ ... ]
}
```

---

### `GET /api/schema` — Full schema (everything at once)

Returns all collections in a single response:

```json
{
  "success": true,
  "count": 1,
  "timestamp": "2026-04-29T12:00:00.000Z",
  "data": {
    "categories": [ ... ],
    "players": [ ... ],
    "games": [ ... ],
    "movements": [ ... ],
    "levelRecords": [ ... ],
    "lobby": [ ... ]
  }
}
```

---

### `GET /api/categories`

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

### `GET /api/players`

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

### `GET /api/games` — `?status=completed|in_progress|waiting|abandoned`

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

### `GET /api/movements` — `?gameId=<id>`

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

### `GET /api/level-records` — `?level=<int>`

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

### `GET /api/lobby`

Returns players currently connected via WebSocket.

```json
{
  "data": [
    { "nickname": "NewPlayer", "categoryCode": "JUN", "joinedAt": "2026-04-29T14:00:00.000Z" }
  ]
}
```

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

### Example session

```
Client: {"type":"register","nickname":"TestPlayer"}
Server: {"type":"welcome","playerId":"abc123","nickname":"TestPlayer","lobby":[...]}

Client: {"type":"move","action":"move_right","positionX":100,"positionY":64}
Server: {"type":"player_moved","nickname":"TestPlayer","action":"move_right",...}

Client: {"type":"chat","message":"Hello team!"}
Server: {"type":"chat_message","nickname":"TestPlayer","message":"Hello team!",...}

Client: {"type":"leave"}
Server: {"type":"goodbye","message":"You have left the lobby"}
```
