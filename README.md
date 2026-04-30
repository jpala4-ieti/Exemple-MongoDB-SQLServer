# MongoDB → Navision Sync Pipeline (Mock API + WebSocket)

Self-contained data pipeline for the **Cooperative Platformer** game. Includes a mock REST API with in-memory data (no MongoDB required), WebSocket support for real-time player registration and events, and a sync script that migrates data into SQL Server (Navision ERP).

---

## Architecture

```
                            ┌──────────────────────┐
                            │  Mock REST API       │
  In-memory mock data ─────▶│  GET /api/schema     │◀──── sync-to-navision.js
  (src/data/mock-data.js)   │  GET /api/players    │          │
                            │  GET /api/games      │          ▼
                            │  GET /api/...        │   ┌──────────────┐
                            │                      │   │  SQL Server  │
                            │  WebSocket /ws       │   │  (Navision)  │
                            │  register, move,     │   └──────────────┘
                            │  pick_key, chat ...  │
                            └──────────────────────┘
                                    ▲
                                    │
                            ws-client.js (example)
```

Everything runs on a single port (default `3000`). No external databases are needed to start the server — data is mock and lives in memory.

---

## Directory Structure

```
mongo-to-navision/
├── .env.example                 # Environment template
├── .gitignore
├── package.json
├── README.md
│
├── docs/
│   └── api-format.md            # Full REST + WebSocket protocol docs
│
├── sql/
│   └── create-tables.sql        # Navision DDL (7 tables, 3 views)
│
└── src/
    ├── server.js                # Express + WebSocket entry point
    │
    ├── config/
    │   ├── index.js             # Env config with defaults
    │   └── logger.js            # Pino structured logger
    │
    ├── data/
    │   └── mock-data.js         # In-memory data store (mutable)
    │
    ├── routes/
    │   └── api.js               # REST endpoints
    │
    ├── ws/
    │   └── handler.js           # WebSocket event handlers
    │
    ├── services/
    │   ├── api-client.js        # Axios client (used by sync script)
    │   └── sqlserver.js         # mssql connection singleton
    │
    ├── scripts/
    │   ├── create-tables.js     # Runs SQL DDL against Navision
    │   └── sync-to-navision.js  # API → SQL Server upsert pipeline
    │
    └── clients/
        └── ws-client.js         # Example WebSocket client
```

---

## Quick Start

### 1. Install

```bash
git clone <repo-url>
cd mongo-to-navision
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit only if you need to change the port or SQL Server credentials
```

### 3. Start the server

```bash
npm start
```

The mock API is ready immediately — no database setup needed.

### 4. Test REST endpoints

```bash
# Full schema (all data at once)
curl http://localhost:3000/api/schema | jq

# Individual collections
curl http://localhost:3000/api/categories
curl http://localhost:3000/api/players
curl http://localhost:3000/api/games?status=completed
curl http://localhost:3000/api/movements
curl http://localhost:3000/api/level-records?level=1
curl http://localhost:3000/api/lobby
```

### 5. Test WebSocket

In a separate terminal (server must be running):

```bash
npm run ws:client

# Or with a custom nickname:
node src/clients/ws-client.js MyPlayerName
```

The example client automatically runs through the full lifecycle: register → move → pick key → open door → chat → leave.

### 6. Sync to SQL Server (optional — requires SQL Server)

```bash
# Create Navision tables
npm run migrate

# Pull data from mock API and insert into SQL Server
npm run sync
```

---

## REST Endpoints

| Method | Path                | Query Params | Description                    |
|--------|---------------------|--------------|--------------------------------|
| GET    | `/api/schema`       | —            | **All data in one response**   |
| GET    | `/api/categories`   | —            | Player categories              |
| GET    | `/api/players`      | —            | Players with stats             |
| GET    | `/api/games`        | `?status=`   | Game sessions                  |
| GET    | `/api/movements`    | `?gameId=`   | Player movement log            |
| GET    | `/api/level-records`| `?level=`    | Level completion records       |
| GET    | `/api/lobby`        | —            | Current WebSocket lobby        |
| GET    | `/health`           | —            | Server health check            |

---

## WebSocket Protocol

**Endpoint:** `ws://localhost:3000/ws`

### Client → Server messages

```json
{ "type": "register",  "nickname": "PixelKnight" }
{ "type": "move",      "action": "move_right", "positionX": 100, "positionY": 64 }
{ "type": "pick_key",  "positionX": 300, "positionY": 64, "level": 1 }
{ "type": "open_door", "positionX": 480, "positionY": 64, "level": 1 }
{ "type": "chat",      "message": "GG team!" }
{ "type": "leave" }
```

### Server → Client messages

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

Lobby capacity: **2–8 players** (matching game specs). New players registered via WebSocket are automatically added to the in-memory player store and become available through the REST API.

---

## SQL Server / Navision

### Tables (7)

| Table               | Description                              |
|---------------------|------------------------------------------|
| `PlayerCategory`    | JUN / SEN / EXP tier definitions         |
| `Player`            | Player master data with FK to category   |
| `Game`              | Game session headers                     |
| `GamePlayer`        | Many-to-many: players in games           |
| `Movement`          | Detailed action log                      |
| `LevelRecord`       | Level completion times                   |
| `LevelRecordPlayer` | Many-to-many: players in level records   |

### ERP Indicator Views (3)

1. **`vw_LevelsCompletedByCategory`** — Levels completed by Junior/Senior/Expert
2. **`vw_AvgTimePerLevel`** — Avg/best/worst time per level
3. **`vw_PlayerRecords`** — Player dashboard with personal bests

```sql
SELECT * FROM [dbo].[vw_LevelsCompletedByCategory];
SELECT * FROM [dbo].[vw_AvgTimePerLevel];
SELECT * FROM [dbo].[vw_PlayerRecords];
```

---

## npm Scripts

| Command           | Description                                     |
|-------------------|-------------------------------------------------|
| `npm start`       | Start the mock API + WebSocket server            |
| `npm run dev`     | Start with auto-reload (nodemon)                 |
| `npm run ws:client` | Run the example WebSocket client               |
| `npm run migrate` | Create SQL Server tables                         |
| `npm run sync`    | Fetch from API → insert into SQL Server          |
| `npm run setup`   | migrate + sync (server must be running)          |

---

## Libraries

| Package      | Purpose                                   |
|--------------|-------------------------------------------|
| `express`    | REST API framework                        |
| `ws`         | RFC 6455 WebSocket server                 |
| `cors`       | Cross-origin resource sharing             |
| `uuid`       | Mock ID generation                        |
| `mssql`      | SQL Server client (TDS protocol)          |
| `axios`      | HTTP client for sync script               |
| `dotenv`     | Environment variable management           |
| `pino`       | High-performance structured logging       |

---

## License

MIT
