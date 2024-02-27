// Live notices from the server over one shared WebSocket (GET /api/v1/ws on the gateway).
//
// Pages subscribe to a message type, e.g. "catalog.changed", and re-fetch what they show.
// The socket opens with the first subscriber, reconnects with backoff while anyone is
// subscribed, and closes when the last one leaves. After a reconnect a "reconnected" message
// is emitted locally, because changes made while offline were missed.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";
const WS_URL = `${API_BASE.replace(/^http/, "ws")}/ws`;

const listeners = new Map(); // type -> Set<handler>
let socket = null;
let attempts = 0;
let everConnected = false;
let reconnectTimer = null;

function hasListeners() {
  for (const set of listeners.values()) if (set.size > 0) return true;
  return false;
}

function emit(type, message) {
  (listeners.get(type) || []).forEach((handler) => {
    try {
      handler(message);
    } catch (err) {
      console.error(`realtime handler for "${type}" failed`, err);
    }
  });
}

function connect() {
  if (socket || typeof WebSocket === "undefined") return;
  const ws = new WebSocket(WS_URL);
  socket = ws;

  // Each handler first checks it still belongs to the current socket: a socket closed by
  // unsubscribe can report its close after a newer one was opened, and must not touch it.
  ws.onopen = () => {
    if (socket !== ws) return;
    const isReconnect = everConnected;
    everConnected = true;
    attempts = 0;
    if (isReconnect) emit("reconnected", { type: "reconnected" });
  };

  ws.onmessage = (event) => {
    if (socket !== ws) return;
    try {
      const message = JSON.parse(event.data);
      if (message?.type) emit(message.type, message);
    } catch {
      // Ignore anything that is not a JSON notice.
    }
  };

  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (!hasListeners()) return;
    const delay = Math.min(30000, 1000 * 2 ** attempts); // 1s, 2s, 4s … 30s
    attempts += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
}

/** True while the live connection is open. */
export function isLive() {
  return socket?.readyState === 1; // WebSocket.OPEN
}

/**
 * Calls handler for every message of this type. Returns an unsubscribe function.
 * @param {string} type e.g. "catalog.changed" or "reconnected"
 * @param {(message: object) => void} handler
 */
export function subscribe(type, handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  connect();

  return () => {
    listeners.get(type)?.delete(handler);
    if (!hasListeners()) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
      const ws = socket;
      socket = null; // detach first, so its close handler does not reconnect
      // Closing a socket that is still connecting makes the browser log "closed before the
      // connection is established" (React StrictMode mounts, unmounts and remounts every page
      // in development). Let it finish connecting, then close it quietly.
      if (ws?.readyState === 0) ws.onopen = () => ws.close(); // WebSocket.CONNECTING
      else ws?.close();
      everConnected = false;
      attempts = 0;
    }
  };
}
