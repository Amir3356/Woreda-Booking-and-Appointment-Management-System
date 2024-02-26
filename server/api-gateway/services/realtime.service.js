// Live notifications to open browser pages over WebSocket (GET /api/v1/ws).
//
// The gateway's Kafka consumers call broadcast when something changed (e.g. the service
// catalog); pages react by re-fetching what they show. Messages are small notices without
// personal data, so every connected page may receive them.
import { WebSocketServer } from "ws";

const SEND_BUFFER = 16; // queued messages per page before it is treated as stuck
const WRITE_TIMEOUT_MS = 5000; // one message (or a ping's pong) to one page
const PING_INTERVAL_MS = 25000; // keeps idle connections open through proxies

// Glob match as Go's path.Match on a host ("*" matches any run of characters except "/").
function hostMatches(pattern, host) {
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")}$`, "i");
  return re.test(host);
}

function hostOf(u) {
  try {
    return new URL(u).host;
  } catch {
    return "";
  }
}

export class Hub {
  /** Accepts connections from pages served at allowedOrigins (e.g. "http://localhost:3000"). */
  constructor(allowedOrigins, logger, { pingIntervalMs = PING_INTERVAL_MS } = {}) {
    this.origins = [];
    for (const o of allowedOrigins) {
      const host = hostOf(o);
      if (host) this.origins.push(host);
      else if (o === "*") this.origins.push("*");
    }
    this.logger = logger;
    this.pingIntervalMs = pingIntervalMs;
    this.clients = new Set();
    // Pages only listen, so incoming messages are kept tiny.
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  }

  /** Same rule as the Go hub (coder/websocket): no Origin, the same host, or an allowed host. */
  originAllowed(req) {
    const origin = req.headers.origin;
    if (!origin) return { ok: true };
    const host = hostOf(origin);
    if (!host) return { ok: false, reason: `failed to parse Origin header "${origin}"` };
    if (host.toLowerCase() === String(req.headers.host || "").toLowerCase()) return { ok: true };
    if (this.origins.some((p) => hostMatches(p, host))) return { ok: true };
    return { ok: false, reason: `request Origin "${origin}" is not authorized for Host "${req.headers.host || ""}"` };
  }

  /**
   * Upgrades req to a WebSocket (call from the HTTP server's "upgrade" event). extraHeaders are
   * added to the 101/403 response. Resolves to the HTTP status written (101 or 403/400).
   */
  handleUpgrade(req, socket, head, extraHeaders = {}) {
    const verdict = this.originAllowed(req);
    if (!verdict.ok) {
      this.logger.warn({ origin: req.headers.origin, err: verdict.reason }, "websocket upgrade refused");
      writeRaw(socket, 403, "Forbidden", `${verdict.reason}\n`, extraHeaders);
      return 403;
    }
    const addHeaders = (headers) => {
      for (const [k, v] of Object.entries(extraHeaders)) headers.push(`${k}: ${v}`);
    };
    this.wss.once("headers", addHeaders);
    let status = 400;
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      status = 101;
      this.#serve(ws);
    });
    this.wss.off("headers", addHeaders); // handleUpgrade emits it synchronously, or not at all on a bad handshake
    return status;
  }

  #serve(ws) {
    const client = { ws, pending: 0 };
    this.clients.add(client);

    let pongTimer = null;
    const ping = setInterval(() => {
      if (pongTimer) return;
      pongTimer = setTimeout(() => ws.terminate(), WRITE_TIMEOUT_MS);
      ws.ping();
    }, this.pingIntervalMs);
    ws.on("pong", () => {
      clearTimeout(pongTimer);
      pongTimer = null;
    });
    // Pages only listen: any data message is a protocol violation (as Go's CloseRead).
    ws.on("message", () => ws.close(1008, "unexpected data message"));
    ws.on("error", () => {});
    ws.on("close", () => {
      clearInterval(ping);
      clearTimeout(pongTimer);
      this.clients.delete(client);
    });

    this.#send(client, JSON.stringify({ type: "connected" }));
  }

  #send(client, data) {
    client.pending += 1;
    const timer = setTimeout(() => client.ws.terminate(), WRITE_TIMEOUT_MS);
    client.ws.send(data, (err) => {
      clearTimeout(timer);
      client.pending -= 1;
      if (err) client.ws.terminate();
    });
  }

  /**
   * Sends {type, event, entityId} to every connected page. A page that is not keeping up is
   * disconnected; its client reconnects and re-fetches, so nothing is lost for good.
   */
  broadcast({ type, event, entityId }) {
    const msg = { type };
    if (event) msg.event = event;
    if (entityId) msg.entityId = entityId;
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.ws.readyState !== client.ws.OPEN) continue;
      // Go: a buffer of SEND_BUFFER messages plus the one being written.
      if (client.pending > SEND_BUFFER) {
        this.clients.delete(client);
        client.ws.close(1013, "too slow");
        continue;
      }
      this.#send(client, data);
    }
  }

  /** Number of connected pages. */
  count() {
    return this.clients.size;
  }

  close() {
    for (const { ws } of this.clients) ws.close(1001, "going away");
    this.clients.clear();
    this.wss.close();
  }
}

function writeRaw(socket, status, statusText, body, headers = {}) {
  const lines = [`HTTP/1.1 ${status} ${statusText}`, "Content-Type: text/plain; charset=utf-8",
    "X-Content-Type-Options: nosniff", `Content-Length: ${Buffer.byteLength(body)}`, "Connection: close"];
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== "x-content-type-options") lines.push(`${k}: ${v}`);
  socket.end(`${lines.join("\r\n")}\r\n\r\n${body}`);
}

/** The hub for pages served at allowedOrigins. */
export function createRealtimeService({ allowedOrigins, logger }) {
  return new Hub(allowedOrigins, logger);
}
