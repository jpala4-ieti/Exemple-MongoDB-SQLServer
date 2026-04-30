# MongoDB → Navision Sync Pipeline (Mock API + WebSocket)

> **All collection names and SQL Server tables use the `XCOOP42_` prefix**
> to guarantee zero collisions with existing data in any environment.

Self-contained data pipeline for the **Cooperative Platformer** game. Includes a mock REST API with in-memory data (no MongoDB required), WebSocket support for real-time player registration and events, and a sync script that migrates data into SQL Server (Navision ERP).

---

## Architecture

```
                            ┌──────────────────────────┐
                            │  Mock REST API           │
  In-memory mock data ─────▶│  GET /api/schema         │◀──── sync-to-navision.js
  (src/data/mock-data.js)   │  GET /api/xcoop42_*      │          │
                            │                          │          ▼
                            │  WebSocket /ws           │   ┌────────────────────┐
                            │  register, move, chat…   │   │  SQL Server        │
                            └──────────────────────────┘   │  XCOOP42_* tables  │
                                    ▲                      └────────────────────┘
                                    │
                            ws-client.js (example)
```

---

## Directory Structure

```
mongo-to-navision/
├── .env.example
├── .gitignore
├── package.json
├── README.md
│
├── docs/
│   └── api-format.md              # Full REST + WS protocol docs
│
├── sql/
│   └── create-tables.sql          # XCOOP42_* DDL (7 tables, 3 views)
│
└── src/
    ├── server.js                  # Express + WebSocket entry point
    ├── config/
    │   ├── index.js               # Env config
    │   └── logger.js              # Pino logger
    ├── data/
    │   └── mock-data.js           # In-memory mutable store
    ├── routes/
    │   └── api.js                 # REST endpoints (xcoop42_* paths)
    ├── ws/
    │   └── handler.js             # WebSocket event handlers
    ├── services/
    │   ├── api-client.js          # Axios client for sync script
    │   └── sqlserver.js           # mssql connection singleton
    ├── scripts/
    │   ├── create-tables.js       # Runs XCOOP42_* DDL
    │   └── sync-to-navision.js    # API → XCOOP42_* SQL upserts
    └── clients/
        └── ws-client.js           # Example WS client
```

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

### 3. Start the server

```bash
npm start
```

### 4. Test REST endpoints

```bash
# Full schema (all prefixed collections at once)
curl http://localhost:3000/api/schema | jq

# Individual collections
curl http://localhost:3000/api/xcoop42_categories
curl http://localhost:3000/api/xcoop42_players
curl http://localhost:3000/api/xcoop42_games?status=completed
curl http://localhost:3000/api/xcoop42_movements
curl http://localhost:3000/api/xcoop42_level_records?level=1
curl http://localhost:3000/api/xcoop42_lobby
```

### 5. Test WebSocket

```bash
npm run ws:client

# Or with a custom nickname:
node src/clients/ws-client.js MyPlayerName
```

### 6. Sync to SQL Server (requires SQL Server)

```bash
npm run test:db   # Test connection and check XCOOP42_* tables
npm run migrate   # Creates XCOOP42_* tables
npm run sync      # Fetches from API → inserts into XCOOP42_* tables
```

---

## REST Endpoints

| Method | Path                            | Query Params | Description                  |
|--------|---------------------------------|--------------|------------------------------|
| GET    | `/api/schema`                   | —            | **All data in one response** |
| GET    | `/api/xcoop42_categories`       | —            | Player categories            |
| GET    | `/api/xcoop42_players`          | —            | Players with stats           |
| GET    | `/api/xcoop42_games`            | `?status=`   | Game sessions                |
| GET    | `/api/xcoop42_movements`        | `?gameId=`   | Player movement log          |
| GET    | `/api/xcoop42_level_records`    | `?level=`    | Level completion records     |
| GET    | `/api/xcoop42_lobby`            | —            | Current WebSocket lobby      |
| GET    | `/health`                       | —            | Server health check          |

The `/api/schema` response uses prefixed keys:

```json
{
  "data": {
    "xcoop42_categories":    [ ... ],
    "xcoop42_players":       [ ... ],
    "xcoop42_games":         [ ... ],
    "xcoop42_movements":     [ ... ],
    "xcoop42_level_records": [ ... ],
    "xcoop42_lobby":         [ ... ]
  }
}
```

---

## SQL Server / Navision (XCOOP42_ prefix)

### Tables (7)

| Table                          | Description                              |
|--------------------------------|------------------------------------------|
| `XCOOP42_PlayerCategory`       | JUN / SEN / EXP tier definitions         |
| `XCOOP42_Player`               | Player master data with FK to category   |
| `XCOOP42_Game`                 | Game session headers                     |
| `XCOOP42_GamePlayer`           | Many-to-many: players in games           |
| `XCOOP42_Movement`             | Detailed action log                      |
| `XCOOP42_LevelRecord`          | Level completion times                   |
| `XCOOP42_LevelRecordPlayer`    | Many-to-many: players in level records   |

### ERP Indicator Views (3)

```sql
SELECT * FROM [dbo].[XCOOP42_vw_LevelsCompletedByCategory];
SELECT * FROM [dbo].[XCOOP42_vw_AvgTimePerLevel];
SELECT * FROM [dbo].[XCOOP42_vw_PlayerRecords];
```

---

## WebSocket Protocol

**Endpoint:** `ws://localhost:3000/ws`

### Client → Server

```json
{ "type": "register",  "nickname": "PixelKnight" }
{ "type": "move",      "action": "move_right", "positionX": 100, "positionY": 64 }
{ "type": "pick_key",  "positionX": 300, "positionY": 64, "level": 1 }
{ "type": "open_door", "positionX": 480, "positionY": 64, "level": 1 }
{ "type": "chat",      "message": "GG team!" }
{ "type": "leave" }
```

### Server → Client

```json
{ "type": "welcome",       "playerId": "...", "nickname": "...", "lobby": [...] }
{ "type": "player_joined", "nickname": "...", "lobby": [...] }
{ "type": "player_moved",  "nickname": "...", "action": "move_right", ... }
{ "type": "key_picked",    "nickname": "..." }
{ "type": "door_opened",   "nickname": "..." }
{ "type": "chat_message",  "nickname": "...", "message": "..." }
{ "type": "player_left",   "nickname": "...", "lobby": [...] }
{ "type": "error",         "message": "..." }
```

---

## npm Scripts

| Command             | Description                                    |
|---------------------|------------------------------------------------|
| `npm start`         | Start the mock API + WebSocket server          |
| `npm run dev`       | Start with auto-reload (nodemon)               |
| `npm run ws:client` | Run the example WebSocket client               |
| `npm run test:db`   | Test SQL Server connection + check tables      |
| `npm run migrate`   | Create XCOOP42_* SQL Server tables             |
| `npm run sync`      | Fetch from API → insert into XCOOP42_* tables  |
| `npm run setup`     | migrate + sync (server must be running)        |

---

## Why XCOOP42_?

The prefix `XCOOP42_` is deliberately obscure — it stands for "eXperimental COOPerative game, instance 42". The goal is to ensure that running the migration script against a shared or pre-existing Navision database will never accidentally overwrite or drop tables that belong to other projects. All 7 tables, 3 views, and all constraints/indexes carry this prefix.

---

## License

MIT
