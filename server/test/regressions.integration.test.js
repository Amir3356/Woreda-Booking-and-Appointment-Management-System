// Integration regressions against a real PostgreSQL database and the full Express app.
//
// Uses its own throwaway database (TEST_DB_NAME, default "woreda_regression_test"), which is dropped
// and rebuilt from the migrations on every run, so it never touches the development database.
// Skipped when PostgreSQL is not reachable with the connection settings from server/.env.
//
// Covers:
//   1. An officer with assigned services can open the citizen directory (query used a missing column).
//   2. A citizen's queue position works for afternoon slots such as "15:00 PM" (bad ::time cast).
//   3. Appointment slips are only readable by the owner, in-scope staff and the admin.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DB_NAME = process.env.TEST_DB_NAME || "woreda_regression_test";
const ADMIN = { email: "regression-admin@test.local", password: "Regression#2026", phone: "+251911000002" };

// Must be set before config/ is imported (dotenv never overrides variables already set).
Object.assign(process.env, {
  DB_NAME,
  RATE_LIMIT_ENABLED: "false",
  LOG_LEVEL: "silent",
  SEED_ADMIN_NAME: "Regression Admin",
  SEED_ADMIN_EMAIL: ADMIN.email,
  SEED_ADMIN_PASSWORD: ADMIN.password,
  SEED_ADMIN_PHONE: ADMIN.phone,
});

const { config } = await import("../config/index.js");
const pg = (await import("pg")).default;

async function postgresReachable() {
  const c = new pg.Client({ ...config.db, database: "postgres", connectionTimeoutMillis: 2000 });
  try {
    await c.connect();
    return true;
  } catch {
    return false;
  } finally {
    await c.end().catch(() => {});
  }
}

const skip = (await postgresReachable()) ? false : "PostgreSQL not reachable";

let server;
let realtime;
let closeDatabase;
let base;
const ctx = {};

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

before(async () => {
  if (skip) return;
  execFileSync(process.execPath, [fileURLToPath(new URL("../scripts/migrate.js", import.meta.url)), "fresh", "--seed"], {
    env: process.env,
    stdio: "ignore",
  });
  const { createApp } = await import("../app.js");
  ({ closeDatabase } = await import("../config/database.js"));
  const built = createApp();
  realtime = built.realtimeService;
  server = built.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;

  const login = await api("POST", "/auth/login", { body: { email: ADMIN.email, password: ADMIN.password } });
  assert.equal(login.status, 200, "admin login");
  ctx.admin = login.json.data.token;

  const dept = await api("POST", "/departments", {
    token: ctx.admin,
    body: { name: "Regression Registry", code: "RGR", buildingRoom: "Block R, Room 1", contactPhone: "+251911000003" },
  });
  ctx.departmentId = dept.json.data.id;
  const svc = await api("POST", "/services", {
    token: ctx.admin,
    body: { departmentId: ctx.departmentId, name: "Regression Certificate", code: "RGC", requiredDocuments: ["Kebele ID"] },
  });
  ctx.serviceId = svc.json.data.id;
  const sched = await api("POST", "/schedules", {
    token: ctx.admin,
    body: {
      departmentId: ctx.departmentId,
      workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      openingTime: "08:00",
      closingTime: "17:00",
      dailyCapacity: 20,
      effectiveStartDate: futureDate(0),
    },
  });
  assert.equal(sched.status, 201, `schedule: ${JSON.stringify(sched.json)}`);

  // Provisioned the way the admin UI does it: an officer with explicitly assigned services.
  await api("POST", "/admin/users/provision", {
    token: ctx.admin,
    body: {
      fullName: "Regression Officer", email: "regression-officer@test.local", password: "Officer#123",
      role: "Department Officer", departmentId: ctx.departmentId, serviceIds: [ctx.serviceId],
    },
  });
  ctx.officer = (await api("POST", "/auth/login", { body: { email: "regression-officer@test.local", password: "Officer#123" } })).json.data.token;

  ctx.citizen = (await api("POST", "/auth/register", { body: { fullName: "Regression Citizen", phone: "+251911000004", password: "Citizen#123" } })).json.data.token;
  ctx.otherCitizen = (await api("POST", "/auth/register", { body: { fullName: "Other Citizen", phone: "+251911000005", password: "Citizen#123" } })).json.data.token;

  // An afternoon slot: stored as "15:00 PM" (24-hour clock with a suffix).
  const booked = await api("POST", "/appointments", {
    token: ctx.citizen,
    body: { serviceId: ctx.serviceId, date: futureDate(3), timeSlot: "15:00 PM" },
  });
  assert.equal(booked.status, 201, `booking: ${JSON.stringify(booked.json)}`);
  ctx.appointmentId = booked.json.data.id;
});

after(async () => {
  if (skip) return;
  realtime?.close();
  await new Promise((r) => (server ? server.close(r) : r()));
  await closeDatabase?.();
  const c = new pg.Client({ ...config.db, database: "postgres" });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${DB_NAME.replaceAll('"', '""')}" WITH (FORCE)`);
  await c.end();
});

test("officer with assigned services can list the citizen directory", { skip }, async () => {
  const res = await api("GET", "/admin/users/citizens", { token: ctx.officer });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  // The citizen booked in the officer's service, so they are in the officer's scoped directory.
  assert.ok(JSON.stringify(res.json.data).includes("Regression Citizen"));
});

test("citizen queue position works for an afternoon slot (\"15:00 PM\")", { skip }, async () => {
  const approve = await api("PATCH", `/appointments/${ctx.appointmentId}/status`, { token: ctx.officer, body: { status: "APPROVED" } });
  assert.equal(approve.status, 200, JSON.stringify(approve.json));
  const checkIn = await api("POST", "/queue/verify-checkin", { token: ctx.officer, body: { appointmentId: ctx.appointmentId } });
  assert.equal(checkIn.status, 200, JSON.stringify(checkIn.json));

  const mine = await api("GET", "/queue/me", { token: ctx.citizen });
  assert.equal(mine.status, 200, JSON.stringify(mine.json));
  const board = await api("GET", "/queue", { token: ctx.officer });
  assert.equal(board.status, 200, JSON.stringify(board.json));
});

test("appointment slip is only readable by its owner, in-scope staff and the admin", { skip }, async () => {
  const path = `/appointments/${ctx.appointmentId}/slip`;
  assert.equal((await api("GET", path, { token: ctx.citizen })).status, 200, "owner");
  assert.equal((await api("GET", path, { token: ctx.officer })).status, 200, "officer of the department");
  assert.equal((await api("GET", path, { token: ctx.admin })).status, 200, "admin");

  const other = await api("GET", path, { token: ctx.otherCitizen });
  assert.equal(other.status, 403, "another citizen");
  assert.ok(!JSON.stringify(other.json).includes("+251911000004"), "no phone number leaked");

  const anonymous = await api("GET", path);
  assert.equal(anonymous.status, 401, "anonymous");
  assert.ok(!JSON.stringify(anonymous.json).includes("+251911000004"), "no phone number leaked");
});

test("audit log records citizen requests/cancellations and officer decisions exactly once", { skip }, async () => {
  const date = futureDate(4);
  const book = async (timeSlot, token = ctx.citizen) => {
    const r = await api("POST", "/appointments", { token, body: { serviceId: ctx.serviceId, date, timeSlot } });
    assert.equal(r.status, 201, `booking ${timeSlot}: ${JSON.stringify(r.json)}`);
    return r.json.data;
  };
  const entriesFor = async (appointmentId) => {
    const r = await api("GET", "/audit-logs?pageSize=100", { token: ctx.admin });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.json.data.filter((e) => e.appointmentId === appointmentId);
  };

  // Citizen requests an appointment: one BOOKED entry, by the citizen, awaiting a decision, with an exact timestamp.
  const before = Date.now();
  const requested = await book("09:00 AM");
  const [booked] = await entriesFor(requested.id);
  assert.equal(booked.action, "BOOKED");
  assert.equal(booked.actorRole, "CITIZEN");
  assert.equal(booked.actorName, "Regression Citizen");
  assert.equal(booked.toStatus, "PENDING");
  assert.equal(booked.before, null, "a new request has no before snapshot");
  assert.deepEqual(booked.after, { status: "PENDING", date, timeSlot: "09:00 AM" });
  const at = new Date(booked.at).getTime();
  assert.ok(at >= before - 5000 && at <= Date.now() + 5000, `timestamp ${booked.at}`);

  // Citizen cancels their own pending request.
  assert.equal((await api("POST", `/appointments/${requested.id}/cancel`, { token: ctx.citizen })).status, 200);
  const cancelled = (await entriesFor(requested.id)).find((e) => e.action === "CANCELLED");
  assert.ok(cancelled, "cancellation recorded");
  assert.equal(cancelled.actorRole, "CITIZEN");
  assert.equal(cancelled.fromStatus, "PENDING");
  assert.equal(cancelled.before.status, "PENDING");
  assert.equal(cancelled.after.status, "CANCELLED");

  // Officer rejects with a reason.
  const toReject = await book("09:30 AM");
  await api("PATCH", `/appointments/${toReject.id}/status`, { token: ctx.officer, body: { status: "REJECTED", rejectionReason: "Missing ID" } });
  const rejected = (await entriesFor(toReject.id)).find((e) => e.action === "REJECTED");
  assert.equal(rejected?.actorRole, "OFFICER");
  assert.equal(rejected?.reason, "Missing ID");

  // Officer approves, checks in and completes; the desk page finalizes twice (token id, then appointment id).
  const toComplete = await book("10:00 AM");
  await api("PATCH", `/appointments/${toComplete.id}/status`, { token: ctx.officer, body: { status: "APPROVED" } });
  await api("POST", "/queue/verify-checkin", { token: ctx.officer, body: { appointmentId: toComplete.id } });
  const board = await api("GET", "/queue", { token: ctx.officer });
  const token = (board.json.data.waitingList || [])
    .find((t) => t.appointmentDate === date && t.timeSlot === "10:00 AM")?.id;
  assert.ok(token, `queue token on the board: ${JSON.stringify(board.json.data).slice(0, 300)}`);
  for (const id of [token, toComplete.id, toComplete.id].filter(Boolean)) {
    assert.equal((await api("PATCH", `/queue/${id}/status`, { token: ctx.officer, body: { status: "COMPLETED" } })).status, 200);
  }
  const completeEntries = (await entriesFor(toComplete.id)).filter((e) => e.action === "COMPLETED");
  assert.equal(completeEntries.length, 1, "Complete Service recorded exactly once");
  assert.equal(completeEntries[0].actorRole, "OFFICER");
  assert.equal(completeEntries[0].fromStatus, "CHECKED_IN");
  const actions = (await entriesFor(toComplete.id)).map((e) => e.action).sort();
  assert.deepEqual(actions, ["APPROVED", "BOOKED", "COMPLETED"]);

  // No-show is recorded too (it used to be rejected by the database).
  const noShow = await book("10:30 AM");
  await api("PATCH", `/appointments/${noShow.id}/status`, { token: ctx.officer, body: { status: "APPROVED" } });
  assert.equal((await api("PATCH", `/queue/${noShow.id}/status`, { token: ctx.officer, body: { status: "NO_SHOW" } })).status, 200);
  assert.ok((await entriesFor(noShow.id)).some((e) => e.action === "NO_SHOW"), "no-show recorded");

  // The action filter accepts every recorded action.
  for (const action of ["BOOKED", "CANCELLED", "APPROVED", "REJECTED", "COMPLETED", "NO_SHOW"]) {
    const r = await api("GET", `/audit-logs?action=${action}&pageSize=100`, { token: ctx.admin });
    assert.ok(r.json.data.length > 0 && r.json.data.every((e) => e.action === action), `filter ${action}`);
  }
});

test("a department officer must be assigned at least one service of their own department", { skip }, async () => {
  const other = await api("POST", "/departments", {
    token: ctx.admin,
    body: { name: "Other Office", code: "OTH", buildingRoom: "Block O", contactPhone: "+251911000006" },
  });
  const otherService = await api("POST", "/services", {
    token: ctx.admin,
    body: { departmentId: other.json.data.id, name: "Other Service", code: "OTS" },
  });
  const officer = (extra) => ({
    fullName: "Scoped Officer", password: "Officer#123", role: "Department Officer", departmentId: ctx.departmentId, ...extra,
  });
  const provision = (body) => api("POST", "/admin/users/provision", { token: ctx.admin, body });
  const fieldOf = (r) => r.json?.error?.details?.map((d) => d.field);

  const none = await provision(officer({ email: "none@test.local" }));
  assert.equal(none.status, 422, JSON.stringify(none.json));
  assert.deepEqual(fieldOf(none), ["serviceIds"]);

  const empty = await provision(officer({ email: "empty@test.local", serviceIds: [] }));
  assert.equal(empty.status, 422);

  const foreign = await provision(officer({ email: "foreign@test.local", serviceIds: [otherService.json.data.id] }));
  assert.equal(foreign.status, 422);
  assert.match(JSON.stringify(foreign.json), /does not belong to the officer's department/);

  const unknown = await provision(officer({ email: "unknown@test.local", serviceIds: ["srv-does-not-exist"] }));
  assert.equal(unknown.status, 422);

  const ok = await provision(officer({ email: "scoped@test.local", serviceIds: [ctx.serviceId] }));
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  const officerId = ok.json.data?.id ?? ok.json.data;

  // An administrator needs no services.
  const admin = await provision({ fullName: "Second Admin", email: "admin2@test.local", password: "Admin#1234", role: "Admin" });
  assert.equal(admin.status, 201, JSON.stringify(admin.json));

  // Update: clearing all services is refused; leaving the list out keeps the current assignment.
  const cleared = await api("PUT", `/admin/users/${officerId}`, {
    token: ctx.admin, body: officer({ email: "scoped@test.local", serviceIds: [] }),
  });
  assert.equal(cleared.status, 422, JSON.stringify(cleared.json));
  const kept = await api("PUT", `/admin/users/${officerId}`, {
    token: ctx.admin, body: officer({ fullName: "Scoped Officer Renamed", email: "scoped@test.local" }),
  });
  assert.equal(kept.status, 200, JSON.stringify(kept.json));
  assert.deepEqual(kept.json.data.serviceIds, [ctx.serviceId]);
});

test("a reschedule's audit entry snapshots the old and the new slot", { skip }, async () => {
  const from = futureDate(5), to = futureDate(6);
  const booked = await api("POST", "/appointments", { token: ctx.citizen, body: { serviceId: ctx.serviceId, date: from, timeSlot: "11:00 AM" } });
  const id = booked.json.data.id;
  await api("PATCH", `/appointments/${id}/status`, { token: ctx.officer, body: { status: "APPROVED" } });
  const moved = await api("POST", `/appointments/${id}/reschedule`, {
    token: ctx.officer, body: { newDate: to, newTimeSlot: "11:30 AM", reason: "Officer on leave" },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));

  const log = await api("GET", "/audit-logs?action=RESCHEDULED&pageSize=100", { token: ctx.admin });
  const entry = log.json.data.find((e) => e.appointmentId === id);
  assert.deepEqual(entry.before, { status: "APPROVED", date: from, timeSlot: "11:00 AM" });
  assert.deepEqual(entry.after, { status: "APPROVED", date: to, timeSlot: "11:30 AM" });
  assert.equal(entry.reason, "Officer on leave");
});

test("a calendar exception date range blocks booking on every date in it, and only those", { skip }, async () => {
  const [start, middle, end, after] = [10, 11, 12, 13].map(futureDate);
  const created = await api("POST", "/schedules/exceptions", {
    token: ctx.admin,
    body: { type: "PUBLIC_HOLIDAY", title: "Regression Holiday", startDate: start, endDate: end, scope: "ALL" },
  });
  assert.equal(created.status, 201, JSON.stringify(created.json));

  for (const date of [start, middle, end]) {
    const r = await api("POST", "/appointments", { token: ctx.citizen, body: { serviceId: ctx.serviceId, date, timeSlot: "09:00 AM" } });
    assert.equal(r.status, 422, `${date}: ${JSON.stringify(r.json)}`);
    const issue = r.json.error.details.find((d) => d.field === "date");
    assert.match(issue?.issue ?? "", /No appointments can be booked on that date: Regression Holiday/);
    const slots = await api("GET", `/schedules/availability?serviceId=${ctx.serviceId}&date=${date}`);
    assert.equal(slots.json.data.closedReason, "PUBLIC_HOLIDAY", `availability ${date}`);
  }

  // The public exception list the booking page reads includes it.
  const active = await api("GET", "/schedules/active-exceptions");
  assert.ok(active.json.data.some((e) => e.title === "Regression Holiday" && e.startDate === start && e.endDate === end));

  const open = await api("POST", "/appointments", { token: ctx.citizen, body: { serviceId: ctx.serviceId, date: after, timeSlot: "09:00 AM" } });
  assert.equal(open.status, 201, `day after the range: ${JSON.stringify(open.json)}`);
});

test("/queue/me: a no-show has no queue position", { skip }, async () => {
  const booked = await api("POST", "/appointments", { token: ctx.otherCitizen, body: { serviceId: ctx.serviceId, date: futureDate(14), timeSlot: "14:00 PM" } });
  const id = booked.json.data.id;
  await api("PATCH", `/appointments/${id}/status`, { token: ctx.officer, body: { status: "APPROVED" } });
  await api("POST", "/queue/verify-checkin", { token: ctx.officer, body: { appointmentId: id } });
  assert.equal((await api("PATCH", `/queue/${id}/status`, { token: ctx.officer, body: { status: "NO_SHOW" } })).status, 200);

  const mine = await api("GET", "/queue/me", { token: ctx.otherCitizen });
  assert.equal(mine.status, 200, JSON.stringify(mine.json));
  const entry = mine.json.data.queue.find((q) => q.appointmentId === id);
  assert.equal(entry.status, "NO_SHOW");
  assert.equal(entry.position, null);
  assert.equal(entry.citizensAhead, 0);
  assert.equal(entry.estimatedWaitMinutes, 0);
});

test("audit log: keyset cursor pages of 5, stable while new entries arrive", { skip }, async () => {
  const get = async (q) => {
    const r = await api("GET", `/audit-logs?${q}`, { token: ctx.admin });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    return r.json;
  };
  const key = (e) => `${e.at}|${e.id}`;

  // Walk every page forwards.
  const first = await get("");
  assert.equal(first.meta.cursor.pageSize, 5, "default page size is 5");
  assert.equal(first.meta.cursor.current, 0);
  assert.equal(first.meta.cursor.hasPrev, false);
  assert.ok(first.meta.cursor.totalCount > 10, "enough entries to page through");
  const pages = [first];
  for (let p = first; p.meta.cursor.nextCursor; ) {
    p = await get(`cursor=${p.meta.cursor.nextCursor}`);
    pages.push(p);
  }
  const all = pages.flatMap((p) => p.data);
  assert.ok(pages.every((p) => p.data.length <= 5), "at most 5 per page");
  assert.equal(all.length, first.meta.cursor.totalCount, "every entry exactly once");
  assert.equal(new Set(all.map((e) => e.id)).size, all.length, "no entry repeated");
  for (let i = 1; i < all.length; i++) assert.ok(new Date(all[i - 1].at) >= new Date(all[i].at), "newest first");
  pages.forEach((p, i) => assert.equal(p.meta.cursor.current, i * 5, `page ${i + 1} starts after ${i * 5} entries`));
  assert.equal(pages.at(-1).meta.cursor.hasNext, false);

  // Previous from page 3 gives page 2 back.
  const prev = await get(`cursor=${pages[2].meta.cursor.prevCursor}`);
  assert.deepEqual(prev.data.map(key), pages[1].data.map(key));
  assert.equal(prev.meta.cursor.current, 5);

  // New entries arrive: page 2 (by its cursor) still shows the same entries.
  const page2Cursor = pages[0].meta.cursor.nextCursor;
  await api("POST", "/appointments", { token: ctx.citizen, body: { serviceId: ctx.serviceId, date: futureDate(20), timeSlot: "09:00 AM" } });
  const page2Again = await get(`cursor=${page2Cursor}`);
  assert.deepEqual(page2Again.data.map(key), pages[1].data.map(key), "page 2 unchanged after a new entry");
  assert.equal(page2Again.meta.cursor.current, 6, "one newer entry now comes before it");
  assert.equal(page2Again.meta.cursor.totalCount, first.meta.cursor.totalCount + 1);

  // Previous from that shifted page 2 ends on the real first page (the new entry on top), not on a
  // page that leaves the newest entry hidden above it.
  const back = await get(`cursor=${page2Again.meta.cursor.prevCursor}`);
  assert.equal(back.meta.cursor.current, 0);
  assert.equal(back.meta.cursor.hasPrev, false);
  assert.equal(back.data.length, 5);
  assert.equal(back.data[0].action, "BOOKED", "the newest entry is on top");

  // Filters apply across pages.
  const booked = await get("action=BOOKED&pageSize=5");
  assert.ok(booked.data.every((e) => e.action === "BOOKED"));
  if (booked.meta.cursor.nextCursor) {
    const next = await get(`action=BOOKED&cursor=${booked.meta.cursor.nextCursor}`);
    assert.ok(next.data.every((e) => e.action === "BOOKED"));
  }

  // A tampered cursor is refused.
  const bad = await api("GET", "/audit-logs?cursor=not-a-cursor", { token: ctx.admin });
  assert.equal(bad.status, 422);
});
