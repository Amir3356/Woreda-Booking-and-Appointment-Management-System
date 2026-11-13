import test from "node:test";
import assert from "node:assert/strict";
import { departmentHoursOn, eachDate, exceptionsOn, resolveDay, serviceScheduleOn } from "../utils/calendar.js";
import { applyDailyCapacity } from "../utils/slots.js";
import { exceptionSchema } from "../validations/schedule.validation.js";

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
  const day = resolveDay({ date: SATURDAY, baseSchedule: weekdays, exceptions: [working] });
  assert.equal(day.open, true);
  assert.equal(day.schedule.openingTime, "09:00");
  assert.equal(day.schedule.closingTime, "12:00");
  assert.equal(day.schedule.dailyCapacity, 15);
  assert.equal(day.departmentCapacity, 15);
  assert.ok(day.schedule.workingDays.includes("Sat"));
  // It also overrides a holiday on the same date, and works without any weekly schedule.
  assert.equal(resolveDay({ date: SATURDAY, baseSchedule: null, exceptions: [exc("PUBLIC_HOLIDAY"), working] }).open, true);
});

test("resolveDay - blocked dates override everything", () => {
  const working = exc("WORKING_DAY", { openingTime: "09:00", closingTime: "12:00", dailyCapacity: 15 });
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays, exceptions: [working, exc("BLOCKED")] }).reason, "BLOCKED");
});

test("resolveDay - only exceptional working days carry a department capacity", () => {
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays }).departmentCapacity, null);
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

test("exceptionSchema - title and description are optional and resolveDay maps blank title to null note", () => {
  const parsed = exceptionSchema.parse({
    type: "PUBLIC_HOLIDAY",
    startDate: "2027-01-07",
    scope: "ALL",
  });
  assert.equal(parsed.title, "");
  assert.equal(parsed.description, null);

  const holidayDay = resolveDay({
    date: MONDAY,
    baseSchedule: weekdays,
    exceptions: [{ id: "e1", type: "PUBLIC_HOLIDAY", title: "", startDate: MONDAY, endDate: MONDAY, scope: "ALL", departmentIds: [] }],
  });
  assert.equal(holidayDay.open, false);
  assert.equal(holidayDay.reason, "PUBLIC_HOLIDAY");
  assert.equal(holidayDay.note, null);

  const workingDay = resolveDay({
    date: SATURDAY,
    baseSchedule: weekdays,
    exceptions: [{
      id: "e2", type: "WORKING_DAY", title: "", startDate: SATURDAY, endDate: SATURDAY, scope: "ALL", departmentIds: [],
      openingTime: "08:30", closingTime: "12:30", dailyCapacity: 10,
    }],
  });
  assert.equal(workingDay.open, true);
  assert.equal(workingDay.note, null);
});

test("exceptionSchema - scope needs matching departments and a sane range", () => {
  const one = exceptionSchema.safeParse({ type: "BLOCKED", title: "x", startDate: MONDAY, scope: "DEPARTMENT", departmentIds: ["a", "b"] });
  assert.equal(one.success, false);
  const backwards = exceptionSchema.safeParse({ type: "BLOCKED", title: "x", startDate: MONDAY, endDate: SATURDAY, scope: "ALL" });
  assert.equal(backwards.success, false);
  const tooLong = exceptionSchema.safeParse({ type: "BLOCKED", title: "x", startDate: "2026-01-01", endDate: "2027-06-01", scope: "ALL" });
  assert.equal(tooLong.success, false);
});

test("Woreda-wide schedule applies to every department without its own", () => {
  const woreda = { ...weekdays, departmentId: null, openingTime: "08:00", closingTime: "17:00" };
  assert.equal(departmentHoursOn([woreda], "d9", MONDAY), woreda);
  assert.equal(departmentHoursOn([woreda, weekdays], "d1", MONDAY), weekdays);
  assert.equal(serviceScheduleOn([woreda], "s1", "d9", MONDAY), woreda);
  assert.equal(serviceScheduleOn([woreda], "s1", null, MONDAY), woreda);
});

test("buildSlots / scheduleIssue - the configured lunch break is not bookable", async () => {
  const { buildSlots, scheduleIssue } = await import("../utils/slots.js");
  const sch = { ...weekdays, lunchStart: "12:00", lunchEnd: "13:30" };
  const status = Object.fromEntries(buildSlots(sch, MONDAY, {}, 3).map((s) => [s.timeSlot, s.status]));
  assert.equal(status["11:30 AM"], "Available");
  assert.equal(status["12:00 PM"], "Unavailable");
  assert.equal(status["13:00 PM"], "Unavailable");
  assert.equal(status["13:30 PM"], "Available");
  assert.match(scheduleIssue(sch, MONDAY, "12:30 PM").issue, /lunch break \(12:00–13:30\)/);
  assert.equal(scheduleIssue(sch, MONDAY, "13:30 PM"), null);
  // Without a configured break there is no break: 12:30 is bookable.
  assert.equal(scheduleIssue(weekdays, MONDAY, "12:30 PM"), null);
});

test("scheduleSchema - Woreda-wide schedule with a lunch break", async () => {
  const { scheduleSchema } = await import("../validations/schedule.validation.js");
  const base = { openingTime: "08:30", closingTime: "17:30", dailyCapacity: 20, effectiveStartDate: "2026-11-01" };
  const ok = scheduleSchema.parse({ ...base, departmentId: null, lunchStart: "12:30", lunchEnd: "13:30" });
  assert.equal(ok.departmentId, null);
  assert.equal(ok.lunchStart, "12:30");
  assert.equal(scheduleSchema.safeParse({ ...base, lunchStart: "12:30" }).success, false);
  assert.equal(scheduleSchema.safeParse({ ...base, lunchStart: "13:30", lunchEnd: "12:30" }).success, false);
  assert.equal(scheduleSchema.safeParse({ ...base, lunchStart: "07:00", lunchEnd: "08:00" }).success, false);
});

test("scheduleListQuery and exceptionListQuery support optional cursor pagination (5 per page)", async () => {
  const { scheduleListQuery, exceptionListQuery } = await import("../validations/schedule.validation.js");

  const unpagedSchedules = scheduleListQuery.parse({});
  assert.equal(unpagedSchedules.cursor, undefined);
  assert.equal(unpagedSchedules.pageSize, undefined);
  assert.equal(unpagedSchedules.search, "");

  const pagedSchedules = scheduleListQuery.parse({ cursor: "5", pageSize: "5", search: "SCH-", status: "Active" });
  assert.equal(pagedSchedules.cursor, 5);
  assert.equal(pagedSchedules.pageSize, 5);
  assert.equal(pagedSchedules.search, "SCH-");
  assert.equal(pagedSchedules.status, "Active");

  assert.equal(scheduleListQuery.safeParse({ cursor: "-1" }).success, false);
  assert.equal(scheduleListQuery.safeParse({ pageSize: "0" }).success, false);

  const unpagedExceptions = exceptionListQuery.parse({});
  assert.equal(unpagedExceptions.cursor, undefined);
  assert.equal(unpagedExceptions.pageSize, undefined);

  const pagedExceptions = exceptionListQuery.parse({ cursor: "10", pageSize: "5", from: "2026-11-01" });
  assert.equal(pagedExceptions.cursor, 10);
  assert.equal(pagedExceptions.pageSize, 5);
  assert.equal(pagedExceptions.from, "2026-11-01");
});

test("buildSlots - times follow the configured working hours, not a fixed 08:30-16:30 grid", async () => {
  const { buildSlots, scheduleIssue } = await import("../utils/slots.js");
  const sch = { ...weekdays, openingTime: "07:30", closingTime: "18:00", lunchStart: "12:00", lunchEnd: "13:00" };
  const slots = buildSlots(sch, MONDAY, {}, 3);
  assert.equal(slots[0].timeSlot, "07:30 AM");
  assert.equal(slots.at(-1).timeSlot, "17:30 PM"); // ends exactly at closing
  const status = Object.fromEntries(slots.map((s) => [s.timeSlot, s]));
  assert.equal(status["11:30 AM"].status, "Available");
  assert.equal(status["12:00 PM"].status, "Unavailable");
  assert.equal(status["12:00 PM"].lunchBreak, true);
  assert.equal(status["12:30 PM"].status, "Unavailable");
  assert.equal(status["13:00 PM"].status, "Available"); // booking reopens right after lunch
  assert.equal(scheduleIssue(sch, MONDAY, "07:30 AM"), null);
  assert.equal(scheduleIssue(sch, MONDAY, "17:30 PM"), null);
  assert.ok(scheduleIssue(sch, MONDAY, "07:00 AM")); // before opening
  assert.ok(scheduleIssue(sch, MONDAY, "18:00 PM")); // would end after closing
  assert.equal(scheduleIssue(sch, SATURDAY, "09:00 AM").field, "date"); // not a working day
  // A closed day has no times at all.
  assert.deepEqual(buildSlots(sch, SATURDAY, {}, 3), []);
  assert.deepEqual(buildSlots(null, MONDAY, {}, 3), []);
});

test("buildSlots - opening at a half hour keeps 30-minute steps from the opening time", async () => {
  const { buildSlots, scheduleIssue } = await import("../utils/slots.js");
  const sch = { ...weekdays, openingTime: "08:15", closingTime: "10:15" };
  assert.deepEqual(buildSlots(sch, MONDAY, {}, 3).map((s) => s.timeSlot), ["08:15 AM", "08:45 AM", "09:15 AM", "09:45 AM"]);
  assert.ok(scheduleIssue(sch, MONDAY, "08:30 AM")); // off the grid
});

test("resolveDay - a holiday is named in the closed note", () => {
  const holiday = { ...exc("PUBLIC_HOLIDAY"), title: "Religious Holiday", description: "Ethiopian Christmas" };
  assert.equal(resolveDay({ date: MONDAY, baseSchedule: weekdays, exceptions: [holiday] }).note, "Ethiopian Christmas (Religious Holiday)");
});

test("buildSlots - supports configurable slot intervals (e.g. 15 or 20 minutes)", async () => {
  const { buildSlots, scheduleIssue } = await import("../utils/slots.js");
  const sch15 = { ...weekdays, openingTime: "09:00", closingTime: "10:00", slotIntervalMinutes: 15 };
  const slots15 = buildSlots(sch15, MONDAY, {}, 1);
  assert.deepEqual(slots15.map((s) => s.timeSlot), ["09:00 AM", "09:15 AM", "09:30 AM", "09:45 AM"]);
  assert.equal(scheduleIssue(sch15, MONDAY, "09:15 AM"), null);
  assert.match(scheduleIssue(sch15, MONDAY, "09:10 AM").issue, /every 15 minutes/);

  const sch20 = { ...weekdays, openingTime: "09:00", closingTime: "10:00", slotIntervalMinutes: 20 };
  const slots20 = buildSlots(sch20, MONDAY, {}, 1);
  assert.deepEqual(slots20.map((s) => s.timeSlot), ["09:00 AM", "09:20 AM", "09:40 AM"]);
  assert.equal(scheduleIssue(sch20, MONDAY, "09:20 AM"), null);
  assert.match(scheduleIssue(sch20, MONDAY, "09:15 AM").issue, /every 20 minutes/);
});

test("duplicate booking prevention - buildSlots enforces max 1 booking per slot", async () => {
  const { buildSlots, perTimeCapacity } = await import("../utils/slots.js");
  const { SlotFullError } = await import("../utils/errors.js");

  const sch = { ...weekdays, openingTime: "09:00", closingTime: "11:00", dailyCapacity: 10 };
  assert.equal(perTimeCapacity(sch), 1);

  // When Citizen 1 books 09:00 AM
  const counts = { "09:00 AM": 1 };
  const slots = buildSlots(sch, MONDAY, counts, 1);
  const byTime = Object.fromEntries(slots.map((s) => [s.timeSlot, s]));

  // 09:00 AM is Full so no other citizen can book it
  assert.equal(byTime["09:00 AM"].status, "Full");
  assert.equal(byTime["09:00 AM"].remainingCapacity, 0);
  assert.equal(byTime["09:00 AM"].bookedCount, 1);

  // Other times remain Available for other citizens
  assert.equal(byTime["09:30 AM"].status, "Available");
  assert.equal(byTime["09:30 AM"].remainingCapacity, 1);
  assert.equal(byTime["10:00 AM"].status, "Available");
  assert.equal(byTime["10:00 AM"].remainingCapacity, 1);

  // SlotFullError returns 409
  const err = new SlotFullError();
  assert.equal(err.status, 409);
  assert.equal(err.code, "SLOT_FULL");
  assert.match(err.message, /already booked/i);
});
