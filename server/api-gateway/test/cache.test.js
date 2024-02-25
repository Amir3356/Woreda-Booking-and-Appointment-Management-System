// Needs a real Redis: REDIS_TEST_URL=redis://127.0.0.1:16380/15 npm test (that database is flushed).
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Redis from "ioredis";
import { cache, canonicalQuery } from "../cache.js";

const url = process.env.REDIS_TEST_URL;
const silent = { info() {}, warn() {}, error() {} };

test("canonicalQuery sorts keys and escapes like Go's url.Values.Encode", () => {
  assert.equal(canonicalQuery("b=2&a=1"), "a=1&b=2");
  assert.equal(canonicalQuery("date=2026-11-04&serviceId=s1&a=x+y&a=%21"), "a=x+y&a=%21&date=2026-11-04&serviceId=s1");
  assert.equal(canonicalQuery("bad=%zz&ok=1&semi=1;2"), "ok=1");
  assert.equal(canonicalQuery(""), "");
});

let redis;
let server;
let base;
let upstreamCalls = 0;
let failing = false;

before(async () => {
  if (!url) return;
  redis = new Redis(url);
  await redis.flushdb();
  const app = express();
  app.use(cache(redis, silent));
  app.use((req, res) => {
    if (req.method === "GET") upstreamCalls += 1;
    if (failing) return res.status(500).json({ success: false });
    res.json({ success: true, data: ["Civil Registration"], meta: { requestId: req.get("X-Request-ID") } });
  });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await redis?.quit();
});

async function call(method, path, reqId) {
  const res = await fetch(base + path, { method, headers: { "X-Request-ID": reqId } });
  const text = await res.text();
  return { cache: res.headers.get("x-cache"), body: text ? JSON.parse(text) : null };
}

test("cache: hit, miss, per-query entries and group invalidation", { skip: !url && "REDIS_TEST_URL not set" }, async () => {
  failing = false;
  assert.equal((await call("GET", "/api/v1/departments?isActive=true", "req-1")).cache, "MISS");
  const hit = await call("GET", "/api/v1/departments?isActive=true", "req-2");
  assert.equal(hit.cache, "HIT");
  assert.equal(upstreamCalls, 1);
  assert.equal(hit.body.meta.requestId, "req-2");
  assert.match(hit.body.meta.timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);

  // Different query string is a different entry; key order does not matter.
  assert.equal((await call("GET", "/api/v1/departments", "req-3")).cache, "MISS");
  assert.equal((await call("GET", "/api/v1/schedules/availability?serviceId=s1&date=2026-11-04", "req-4")).cache, "MISS");
  assert.equal((await call("GET", "/api/v1/schedules/availability?date=2026-11-04&serviceId=s1", "req-4b")).cache, "HIT");
  assert.ok(await redis.exists("cache:availability:/api/v1/schedules/availability?date=2026-11-04&serviceId=s1"));
  assert.ok(await redis.sismember("cache:group:catalog", "cache:catalog:/api/v1/departments?isActive=true"));

  // Availability is unaffected by a department write, but the catalog is cleared.
  await call("PUT", "/api/v1/departments/abc", "req-5");
  assert.equal((await call("GET", "/api/v1/departments?isActive=true", "req-6")).cache, "MISS");
  assert.equal((await call("GET", "/api/v1/schedules/availability?serviceId=s1&date=2026-11-04", "req-7")).cache, "HIT");

  // Booking an appointment clears availability.
  await call("POST", "/api/v1/appointments", "req-8");
  assert.equal((await call("GET", "/api/v1/schedules/availability?serviceId=s1&date=2026-11-04", "req-9")).cache, "MISS");

  // Routes not in the list are never cached.
  assert.equal((await call("GET", "/api/v1/appointments/mine", "req-10")).cache, null);
});

test("cache: error responses are not cached", { skip: !url && "REDIS_TEST_URL not set" }, async () => {
  await redis.flushdb();
  failing = true;
  for (let i = 0; i < 2; i++) {
    assert.equal((await call("GET", "/api/v1/services", `e-${i}`)).cache, "MISS", `attempt ${i}`);
  }
  failing = false;
});
