import test from "node:test";
import assert from "node:assert/strict";
import { departmentHoursOn, eachDate, exceptionsOn, resolveDay, serviceScheduleOn } from "../utils/calendar.js";
import { applyDailyCapacity } from "../utils/slots.js";
import { capacitySchema, dateAvailabilitySchema, exceptionSchema } from "../validations/schedule.validation.js";

const weekdays = {
  status: "ACTIVE", departmentId: "d1", serviceId: null, workingDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  openingTime: "08:30", closingTime: "17:30", dailyCapacity: 40, effectiveStartDate: "2026-01-01", effectiveEndDate: null,
};
const exc = (type, extra = {}) => ({
  id: `EXC-${type}`, type, title: type, startDate: "2026-12-01", endDate: "2026-12-31", scope: "ALL", departmentIds: [], ...extra,
});
const MONDAY = "2026-12-07";
const SATURDAY = "2026-12-05";

test("resolveDay - weekly operating hours decide when there is no exception", () => {
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays }).open, true);
  assert.equal(resolveDay({ date: SATURDAY, baseSchedule: weekdays }).reason, "NOT_WORKING_DAY");
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: null }).reason, "NO_SCHEDULE");
});

test("resolveDay - holidays and non-working days close a normal working day", () => {
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays, exceptions: [exc("PUBLIC_HOLIDAY")] }).reason, "PUBLIC_HOLIDAY");
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays, exceptions: [exc("NON_WORKING_DAY")] }).reason, "NON_WORKING_DAY");
});

test("resolveDay - an exceptional working day opens a closed day with its own hours and capacity", () => {
  const working = exc("WORKING_DAY", { openingTime: "09:00", closingTime: "12:00", dailyCapacity: 15 });
  const day = resolveDay({ date: SATURDAY, baseSchedule: weekdays, exceptions: [working], departmentCapacity: 100 });
  assert.equal(day.open, true);
  assert.equal(day.schedule.openingTime, "09:00");
  assert.equal(day.schedule.closingTime, "12:00");
  assert.equal(day.schedule.dailyCapacity, 15);
  assert.equal(day.departmentCapacity, 15);
  assert.ok(day.schedule.workingDays.includes("Sat"));
  // It also overrides a holiday on the same date, and works without any weekly schedule.
  assert.equal(resolveDay({ date: SATURDAY, baseSchedule: null, exceptions: [exc("PUBLIC_HOLIDAY"), working] }).open, true);
});

test("resolveDay - blocked dates and disabled booking override everything", () => {
  const working = exc("WORKING_DAY", { openingTime: "09:00", closingTime: "12:00", dailyCapacity: 15 });
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays, exceptions: [working, exc("BLOCKED")] }).reason, "BLOCKED");
  const disabled = resolveDay({ date: MONDAY, baseSchedule: weekdays, exceptions: [working], closure: { reason: "Audit" } });
  assert.equal(disabled.reason, "BOOKING_DISABLED");
  assert.equal(disabled.note, "Audit");
});

test("resolveDay - the department daily capacity is passed through on open days", () => {
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays, departmentCapacity: 25 }).departmentCapacity, 25);
  assert.equal(resolveDay({ date: SATURDAY, baseSchedule: weekdays, departmentCapacity: 25 }).departmentCapacity, null);
});

test("exceptionsOn - matches date range and department scope", () => {
  const list = [
    exc("PUBLIC_HOLIDAY", { id: "a" }),
    exc("NON_WORKING_DAY", { id: "b", scope: "DEPARTMENT", departmentIds: ["d2"] }),
    exc("BLOCKED", { id: "c", scope: "DEPARTMENTS", departmentIds: ["d1", "d3"], startDate: "2027-01-01", endDate: "2027-01-02" }),
  ];
  assert.deepEqual(exceptionsOn(list, "d1", MONDAY).map((e) => e.id), ["a"]);
  assert.deepEqual(exceptionsOn(list, "d2", MONDAY).map((e) => e.id), ["a", "b"]);
  assert.deepEqual(exceptionsOn(list, "d1", "2027-01-02").map((e) => e.id), ["c"]);
  assert.deepEqual(exceptionsOn(list, null, MONDAY).map((e) => e.id), ["a"]);
});

test("departmentHoursOn / serviceScheduleOn - department-wide and service schedules", () => {
  const svc = { ...weekdays, serviceId: "s1", workingDays: ["Sat"], openingTime: "07:00", closingTime: "11:00", dailyCapacity: 5 };
  const svc2 = { ...svc, serviceId: "s2", workingDays: ["Mon"], openingTime: "10:00", closingTime: "18:00" };
  assert.equal(departmentHoursOn([weekdays, svc], "d1", MONDAY), weekdays);
  const combined = departmentHoursOn([svc, svc2], "d1", MONDAY);
  assert.deepEqual(combined.workingDays, ["Mon", "Sat"]);
  assert.equal(combined.openingTime, "07:00");
  assert.equal(combined.closingTime, "18:00");
  assert.equal(departmentHoursOn([{ ...weekdays, status: "INACTIVE" }], "d1", MONDAY), null);
  assert.equal(serviceScheduleOn([weekdays, svc], "s1", "d1", MONDAY), svc);
  assert.equal(serviceScheduleOn([weekdays, svc], "s9", "d1", MONDAY), weekdays);
});

test("eachDate - inclusive and month-crossing", () => {
  assert.deepEqual(eachDate("2026-11-29", "2026-12-02"), ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
});

test("applyDailyCapacity - a full department fills every open slot", () => {
  const slots = [{ timeSlot: "09:00 AM", status: "Available", remainingCapacity: 2 }, { timeSlot: "12:30 PM", status: "Unavailable" }];
  const out = applyDailyCapacity(slots, "DEPARTMENT_CAPACITY_REACHED");
  assert.equal(out[0].status, "Full");
  assert.equal(out[1].status, "Unavailable");
});

test("exceptionSchema - holidays drop hours, working days require them", () => {
  const holiday = exceptionSchema.parse({
    type: "PUBLIC_HOLIDAY", title: "Genna", startDate: "2027-01-07", scope: "ALL", departmentIds: ["x"], openingTime: "09:00",
  });
  assert.equal(holiday.endDate, "2027-01-07");
  assert.deepEqual(holiday.departmentIds, []);
  assert.equal(holiday.openingTime, null);

  const bad = exceptionSchema.safeParse({ type: "WORKING_DAY", title: "Sat", startDate: SATURDAY, scope: "ALL", openingTime: "12:00", closingTime: "09:00" });
  assert.equal(bad.success, false);
  const fields = bad.error.issues.map((i) => i.path.join("."));
  assert.ok(fields.includes("closingTime"));
  assert.ok(fields.includes("dailyCapacity"));
});

test("exceptionSchema - scope needs matching departments and a sane range", () => {
  const one = exceptionSchema.safeParse({ type: "BLOCKED", title: "x", startDate: MONDAY, scope: "DEPARTMENT", departmentIds: ["a", "b"] });
  assert.equal(one.success, false);
  const backwards = exceptionSchema.safeParse({ type: "BLOCKED", title: "x", startDate: MONDAY, endDate: SATURDAY, scope: "ALL" });
  assert.equal(backwards.success, false);
  const tooLong = exceptionSchema.safeParse({ type: "BLOCKED", title: "x", startDate: "2026-01-01", endDate: "2027-06-01", scope: "ALL" });
  assert.equal(tooLong.success, false);
});

test("dateAvailabilitySchema and capacitySchema", () => {
  const a = dateAvailabilitySchema.parse({ departmentIds: ["d1", "d1"], startDate: MONDAY, enabled: false });
  assert.deepEqual(a.departmentIds, ["d1"]);
  assert.equal(a.endDate, MONDAY);
  assert.equal(dateAvailabilitySchema.safeParse({ departmentIds: [], startDate: MONDAY, enabled: true }).success, false);
  assert.equal(capacitySchema.safeParse({ dailyCapacity: null }).success, true);
  assert.equal(capacitySchema.safeParse({ dailyCapacity: 0 }).success, false);
});
