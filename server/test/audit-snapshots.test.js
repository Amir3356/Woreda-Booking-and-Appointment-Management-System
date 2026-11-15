// Audit entries saved before the before/after snapshot columns existed are still shown with
// snapshots, derived from from_status, to_status and the stored date and time.
import test from "node:test";
import assert from "node:assert/strict";
import { fromRow } from "../models/auditLog.model.js";

const row = (extra) => ({
  id: "aud-1", at: "2026-11-15T10:00:00Z", to_status: "APPROVED", appointment_date: "2026-11-21", time_slot: "11:30 AM",
  before_snapshot: null, after_snapshot: null, reason: null, from_status: null, ...extra,
});

test("audit snapshots - stored snapshots are returned as saved", () => {
  const e = fromRow(row({
    action: "APPROVED", from_status: "PENDING",
    before_snapshot: { status: "PENDING", date: "2026-11-21", timeSlot: "11:30 AM" },
    after_snapshot: { status: "APPROVED", date: "2026-11-21", timeSlot: "11:30 AM" },
  }));
  assert.equal(e.before.status, "PENDING");
  assert.equal(e.after.status, "APPROVED");
});

test("audit snapshots - legacy booking has no before snapshot", () => {
  const e = fromRow(row({ action: "BOOKED", to_status: "PENDING" }));
  assert.equal(e.before, null);
  assert.deepEqual(e.after, { status: "PENDING", date: "2026-11-21", timeSlot: "11:30 AM" });
});

test("audit snapshots - legacy decision keeps the slot and takes the previous status", () => {
  const e = fromRow(row({ action: "APPROVED", from_status: "PENDING" }));
  assert.deepEqual(e.before, { status: "PENDING", date: "2026-11-21", timeSlot: "11:30 AM" });
});

test("audit snapshots - legacy reschedule reads the old slot from its reason", () => {
  const e = fromRow(row({
    action: "RESCHEDULED", from_status: "APPROVED",
    reason: "2026-11-20 11:00 AM -> 2026-11-21 11:30 AM: Officer on leave",
  }));
  assert.deepEqual(e.before, { status: "APPROVED", date: "2026-11-20", timeSlot: "11:00 AM" });
  assert.deepEqual(e.after, { status: "APPROVED", date: "2026-11-21", timeSlot: "11:30 AM" });
  assert.equal(e.reason, "Officer on leave");

  const noReason = fromRow(row({ action: "RESCHEDULED", from_status: "APPROVED", reason: "2026-11-20 11:00 AM -> 2026-11-21 11:30 AM" }));
  assert.equal(noReason.before.date, "2026-11-20");
  assert.equal(noReason.reason, null);
});
