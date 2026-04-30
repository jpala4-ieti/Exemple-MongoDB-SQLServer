#!/usr/bin/env node

/**
 * WebSocket Example Client
 *
 * Demonstrates the full player lifecycle:
 *   1. Connect to the server
 *   2. Register with a nickname
 *   3. Send a few movements
 *   4. Pick a key
 *   5. Open a door
 *   6. Send a chat message
 *   7. Leave gracefully
 *
 * Usage:
 *   npm run ws:client                        # default nickname "TestPlayer"
 *   node src/clients/ws-client.js MyName     # custom nickname
 *
 * Make sure the server is running first:  npm start
 */

const WebSocket = require("ws");
const config = require("../config");

const nickname = process.argv[2] || "TestPlayer";
const WS_URL = `${config.ws.url}/ws`;

console.log(`\n🎮  Cooperative Platformer — WebSocket Client`);
console.log(`   Connecting to ${WS_URL} as "${nickname}"…\n`);

const ws = new WebSocket(WS_URL);

// ── Helpers ──────────────────────────────────────────────────────────────────
function send(data) {
  ws.send(JSON.stringify(data));
  console.log(`  ⬆  SENT     ${JSON.stringify(data)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Connection opened ────────────────────────────────────────────────────────
ws.on("open", async () => {
  console.log("  ✅  Connected!\n");

  // Step 1: Register
  send({ type: "register", nickname });
  await sleep(500);

  // Step 2: Move right
  send({ type: "move", action: "move_right", positionX: 100, positionY: 64 });
  await sleep(300);

  // Step 3: Jump
  send({ type: "move", action: "jump", positionX: 150, positionY: 128 });
  await sleep(300);

  // Step 4: Move left
  send({ type: "move", action: "move_left", positionX: 120, positionY: 64 });
  await sleep(300);

  // Step 5: Pick key
  send({ type: "pick_key", positionX: 300, positionY: 64, level: 1 });
  await sleep(300);

  // Step 6: Open door
  send({ type: "open_door", positionX: 480, positionY: 64, level: 1 });
  await sleep(300);

  // Step 7: Chat
  send({ type: "chat", message: "GG team! Level cleared 🎉" });
  await sleep(500);

  // Step 8: Leave
  send({ type: "leave" });
  await sleep(300);

  console.log("\n  🏁  Demo sequence complete. Closing connection.\n");
  ws.close();
});

// ── Incoming messages ────────────────────────────────────────────────────────
ws.on("message", (raw) => {
  const data = JSON.parse(raw.toString());
  const label = data.type?.toUpperCase().padEnd(16);
  console.log(`  ⬇  ${label} ${JSON.stringify(data)}`);
});

// ── Errors ───────────────────────────────────────────────────────────────────
ws.on("error", (err) => {
  console.error(`\n  ❌  Error: ${err.message}`);
  console.error("     Is the server running?  →  npm start\n");
  process.exit(1);
});

// ── Connection closed ────────────────────────────────────────────────────────
ws.on("close", () => {
  console.log("  🔌  Disconnected.\n");
  process.exit(0);
});
