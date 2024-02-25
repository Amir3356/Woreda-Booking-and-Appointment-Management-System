import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestError, ValidationError } from "../lib/index.js";
import {
  buildSlots, clock12, decodeCallNext, decodeCheckIn, decodeFinalize, decodeSchedule, minutes, parseClock, parseDate,
  queueToken, scheduleLabel, slotLabel, validateAvailability, validateSchedule, weekdayOf,
} from "../rules.js";

const issues = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ValidationError, String(err));
    return err.details;
  }
  assert.fail("expected a ValidationError");
};

test("slotLabel matches Go's %02d:%02d AM/PM (24h hours)", () => {
  assert.equal(slotLabel(8 * 60 + 30), "08:30 AM");
  assert.equal(slotLabel(9 * 60), "09:00 AM");
  assert.equal(slotLabel(11 * 60 + 30), "11:30 AM");
  assert.equal(slotLabel(12 * 60), "12:00 PM");
  assert.equal(slotLabel(13 * 60 + 30), "13:30 PM");
  assert.equal(slotLabel(16 * 60 + 30), "16:30 PM");
});

test("parseClock follows Go time.Parse(\"15:04\")", () => {
  assert.equal(parseClock("08:30"), 510);
  assert.equal(parseClock("8:30"), 510);
  assert.equal(parseClock("23:59"), 1439);
  for (const bad of ["24:00", "08:60", "08:3", "0830", "08:30:00", "", null, "ab:cd"]) assert.equal(parseClock(bad), null, bad);
  assert.equal(minutes("garbage"), 0);
});

test("parseDate is strict YYYY-MM-DD with real days", () => {
  assert.ok(parseDate("2026-11-03"));
  assert.ok(parseDate("2028-02-29"));
  for (const bad of ["2026-02-30", "2026-13-01", "2026-1-01", "26-11-03", "2026-11-03T00:00", "", undefined]) {
    assert.equal(parseDate(bad), null, String(bad));
  }
  assert.equal(weekdayOf(parseDate("2026-11-02")), "Mon");
  assert.equal(weekdayOf(parseDate("2026-11-08")), "Sun");
});

const weekSchedule = { workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], openingTime: "08:30", closingTime: "17:30" };

test("slot grid: 17 slots 08:30-16:30, lunch unavailable, full and remaining capacity", () => {
  const slots = buildSlots(weekSchedule, parseDate("2026-11-03"), { "09:00 AM": 3, "10:00 AM": 1 }, 3);
  assert.equal(slots.length, 17);
  assert.equal(slots[0].timeSlot, "08:30 AM");
  assert.equal(slots.at(-1).timeSlot, "16:30 PM");
  const by = Object.fromEntries(slots.map((s) => [s.timeSlot, s]));
  assert.deepEqual(by["08:30 AM"], { timeSlot: "08:30 AM", bookedCount: 0, remainingCapacity: 3, status: "Available" });
  assert.deepEqual(by["09:00 AM"], { timeSlot: "09:00 AM", bookedCount: 3, remainingCapacity: 0, status: "Full" });
  assert.deepEqual(by["10:00 AM"], { timeSlot: "10:00 AM", bookedCount: 1, remainingCapacity: 2, status: "Available" });
  assert.equal(by["12:30 PM"].status, "Unavailable");
  assert.equal(by["12:30 PM"].remainingCapacity, 0);
  assert.equal(by["12:00 PM"].status, "Available");
});

test("slot grid: opening/closing bounds (slot must end by closing)", () => {
  const sched = { workingDays: ["Tue"], openingTime: "09:00", closingTime: "11:00" };
  const slots = buildSlots(sched, parseDate("2026-11-03"), {}, 2);
  const open = slots.filter((s) => s.status === "Available").map((s) => s.timeSlot);
  assert.deepEqual(open, ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM"]);
});

test("slot grid: no schedule or non-working day -> all Unavailable, booked counts kept", () => {
  for (const [sched, date] of [[null, "2026-11-03"], [weekSchedule, "2026-11-07"]]) {
    const slots = buildSlots(sched, parseDate(date), { "09:00 AM": 2 }, 3);
    assert.ok(slots.every((s) => s.status === "Unavailable" && s.remainingCapacity === 0));
    assert.equal(slots.find((s) => s.timeSlot === "09:00 AM").bookedCount, 2);
  }
});

test("availability validation: date first, then serviceId", () => {
  assert.deepEqual(issues(() => validateAvailability("", "x")), [
    { field: "date", issue: "Date must be YYYY-MM-DD." },
    { field: "serviceId", issue: "serviceId is required." },
  ]);
  assert.ok(validateAvailability("srv-1", "2026-11-03"));
});

const validInput = {
  departmentId: "dept-1", serviceId: null, workingDays: null, openingTime: "8:30", closingTime: "17:30",
  dailyCapacity: 40, effectiveStartDate: "2026-11-01", effectiveEndDate: null,
};

test("schedule validation: defaults and normalised times", () => {
  const f = validateSchedule(validInput);
  assert.deepEqual(f.workingDays, ["Mon", "Tue", "Wed", "Thu", "Fri"]);
  assert.equal(f.openingTime, "08:30");
  assert.equal(f.closingTime, "17:30");
});

test("schedule validation: Go messages in Go order", () => {
  const d = issues(() => validateSchedule({
    ...validInput, departmentId: "", workingDays: ["Mon", "Funday"], openingTime: "10:00", closingTime: "09:00",
    dailyCapacity: 0, effectiveStartDate: "2026/11/01", effectiveEndDate: "",
  }));
  assert.deepEqual(d, [
    { field: "departmentId", issue: "Department is required." },
    { field: "workingDays", issue: 'Unknown day "Funday" (use Mon..Sun).' },
    { field: "closingTime", issue: "Opening/closing must be HH:MM and closing must be after opening." },
    { field: "dailyCapacity", issue: "Daily capacity must be positive." },
    { field: "effectiveStartDate", issue: "Start date must be YYYY-MM-DD." },
    { field: "effectiveEndDate", issue: "End date cannot precede start date." },
  ]);
  assert.deepEqual(issues(() => validateSchedule({ ...validInput, effectiveEndDate: "2026-12-99" })), [
    { field: "effectiveEndDate", issue: "End date must be YYYY-MM-DD." },
  ]);
  assert.equal(scheduleLabel("ACTIVE"), "Active");
  assert.equal(scheduleLabel("INACTIVE"), "Inactive");
});

test("queue token format {CODE}-{SEQ:02d}", () => {
  assert.equal(queueToken("kbl", 1), "KBL-01");
  assert.equal(queueToken(" LND ", 4), "LND-04");
  assert.equal(queueToken("TRD", 123), "TRD-123");
  assert.equal(queueToken("", 0), "WRD-01");
});

test("clock12 matches to_char(time, 'HH12:MI AM')", () => {
  assert.equal(clock12("09:05:59"), "09:05 AM");
  assert.equal(clock12("12:30:00"), "12:30 PM");
  assert.equal(clock12("00:15:00"), "12:15 AM");
  assert.equal(clock12("16:45:10"), "04:45 PM");
  assert.equal(clock12(null), "");
});

test("decode mirrors Go's typed JSON decoding", () => {
  assert.deepEqual(decodeCallNext({}), { counterNumber: 0 });
  assert.deepEqual(decodeCheckIn({ appointmentId: "a", notes: null }), { appointmentId: "a", verifiedDocuments: null, notes: "" });
  assert.equal(decodeSchedule({ serviceId: "srv-1" }).serviceId, "srv-1");
  assert.throws(() => decodeCallNext({ counterNumber: "2" }), (e) => e instanceof BadRequestError
    && e.message === "malformed JSON body: json: cannot unmarshal string into Go struct field CallNextRequest.counterNumber of type int");
  assert.throws(() => decodeCallNext({ counterNumber: 1.5 }), /cannot unmarshal number 1.5 into Go struct field CallNextRequest.counterNumber of type int/);
  assert.throws(() => decodeFinalize({ status: 1 }), /FinalizeRequest.status of type model.QueueStatus/);
  assert.throws(() => decodeSchedule({ workingDays: "Mon" }), /ScheduleInput.workingDays of type \[\]string/);
});
