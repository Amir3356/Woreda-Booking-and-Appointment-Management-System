// WoredaCare server: REST API (/api/v1), WebSocket live notices (/api/v1/ws) and PostgreSQL.
// Start with `npm start` (or `npm run dev` to restart on file changes).
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { closeDatabase, one } from "./config/database.js";
import { createApp } from "./app.js";

// The schema is managed by node-pg-migrate (`npm run migrate`, `npm run seed`); refuse to start without it.
try {
  const { pending } = await one("SELECT to_regclass('public.pgmigrations') IS NULL AS pending");
  if (pending) {
    logger.error("database has no schema yet: run `npm run migrate` and `npm run seed` first");
    process.exit(1);
  }
} catch (err) {
  const hint = err.code === "3D000" ? "database does not exist yet: run `npm run migrate` and `npm run seed` first" : "database not reachable";
  logger.error({ err: err.message, db: { host: config.db.host, port: config.db.port, database: config.db.database } }, hint);
  process.exit(1);
}

const { app, realtimeService } = createApp();
const server = app.listen(config.port, () => logger.info({ url: `http://localhost:${config.port}/api/v1` }, "listening"));
server.keepAliveTimeout = 65000;

// GET /api/v1/ws upgrades to the live-notice WebSocket; any other upgrade request is refused.
server.on("upgrade", (req, socket, head) => {
  if (req.method !== "GET" || (req.url || "").split("?")[0] !== "/api/v1/ws") {
    socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    return;
  }
  // The hub checks the page's Origin against config/cors.js before accepting the connection.
  realtimeService.handleUpgrade(req, socket, head);
});

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  realtimeService.close();
  server.close();
  await closeDatabase().catch((err) => logger.error({ err: err.message }, "closing database"));
  logger.info("stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
