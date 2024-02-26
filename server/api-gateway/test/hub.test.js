import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { Hub } from "../services/realtime.service.js";

const silent = { info() {}, warn() {}, error() {} };

async function waitFor(cond, ms = 2000) {
  const deadline = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 10));
  }
  return true;
}

test("hub: refuses foreign origins, greets, broadcasts and forgets closed pages", async () => {
  const hub = new Hub(["http://localhost:3000"], silent);
  const server = http.createServer((_req, res) => res.end());
  server.on("upgrade", (req, socket, head) => hub.handleUpgrade(req, socket, head));
  server.listen(0);
  await once(server, "listening");
  const url = `ws://127.0.0.1:${server.address().port}/api/v1/ws`;

  try {
    // A page from another site is refused.
    const evil = new WebSocket(url, { origin: "http://evil.example" });
    evil.on("error", () => {});
    const [req, res] = await once(evil, "unexpected-response");
    assert.equal(res.statusCode, 403);
    req.destroy();
    assert.equal(hub.count(), 0);

    const ws = new WebSocket(url, { origin: "http://localhost:3000" });
    const messages = [];
    const next = async () => {
      if (messages.length === 0) await once(ws, "message");
      return messages.shift();
    };
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    assert.deepEqual(await next(), { type: "connected" });
    assert.ok(await waitFor(() => hub.count() === 1));

    hub.broadcast({ type: "catalog.changed", event: "catalog.service.created", entityId: "srv-1" });
    assert.deepEqual(await next(), { type: "catalog.changed", event: "catalog.service.created", entityId: "srv-1" });
    hub.broadcast({ type: "catalog.changed" }); // empty fields are omitted, as Go's omitempty
    assert.deepEqual(await next(), { type: "catalog.changed" });

    ws.close(1000);
    assert.ok(await waitFor(() => hub.count() === 0), "closed page still registered");
  } finally {
    hub.close();
    server.close();
  }
});
