import test from "node:test";
import assert from "node:assert/strict";

function parseTimeToMinutes(val) {
  if (!val) return 0;
  if (typeof val === "string" && val.includes("T")) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(String(val).trim());
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = (m[3] || "").toUpperCase();
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

/**
 * Priority Rule comparator:
 * 1. Appointment Time with Late-Arrival policy (effectivePriority = max(apptTime, checkInTime))
 * 2. Check-in Time (FIFO tie-breaker)
 * 3. Booking creation time (createdAt) does NOT decide service priority.
 */
function sortQueue(items) {
  return [...items].sort((a, b) => {
    const apptA = parseTimeToMinutes(a.timeSlot);
    const apptB = parseTimeToMinutes(b.timeSlot);
    const checkInA = parseTimeToMinutes(a.checkedInTime || a.checkedInAt || a.timeSlot);
    const checkInB = parseTimeToMinutes(b.checkedInTime || b.checkedInAt || b.timeSlot);

    const effA = Math.max(apptA, checkInA);
    const effB = Math.max(apptB, checkInB);

    if (effA !== effB) return effA - effB;
    if (checkInA !== checkInB) return checkInA - checkInB;
    return String(a.tokenNumber || a.id || "").localeCompare(
      String(b.tokenNumber || b.id || ""),
      undefined,
      { numeric: true }
    );
  });
}

test("Queue Priority - Citizens with earlier scheduled appointments are served first", () => {
  const queue = [
    { id: "1", citizenName: "Abebe", timeSlot: "10:00 AM", checkedInTime: "09:50 AM", createdAt: "2026-11-01T08:00:00Z" },
    { id: "2", citizenName: "Almaz", timeSlot: "09:00 AM", checkedInTime: "08:50 AM", createdAt: "2026-11-10T10:00:00Z" },
    { id: "3", citizenName: "Chala", timeSlot: "09:30 AM", checkedInTime: "09:15 AM", createdAt: "2026-11-05T09:00:00Z" },
  ];

  const sorted = sortQueue(queue);
  assert.equal(sorted[0].citizenName, "Almaz"); // 09:00 AM appointment
  assert.equal(sorted[1].citizenName, "Chala"); // 09:30 AM appointment
  assert.equal(sorted[2].citizenName, "Abebe"); // 10:00 AM appointment
});

test("Queue Priority - Booking submission time (createdAt) does NOT determine service priority", () => {
  // Citizen B booked weeks earlier, but Citizen A has the earlier scheduled appointment
  const queue = [
    { id: "1", citizenName: "BookedEarlier", timeSlot: "11:00 AM", checkedInTime: "10:45 AM", createdAt: "2026-10-01T00:00:00Z" },
    { id: "2", citizenName: "BookedYesterday", timeSlot: "09:00 AM", checkedInTime: "08:45 AM", createdAt: "2026-11-12T00:00:00Z" },
  ];

  const sorted = sortQueue(queue);
  assert.equal(sorted[0].citizenName, "BookedYesterday"); // 09:00 AM served first
  assert.equal(sorted[1].citizenName, "BookedEarlier");
});

test("Queue Priority - Check-in Time (FIFO) breaks ties for identical appointment times", () => {
  const queue = [
    { id: "1", citizenName: "LateCheckIn", timeSlot: "09:30 AM", checkedInTime: "09:25 AM" },
    { id: "2", citizenName: "EarlyCheckIn", timeSlot: "09:30 AM", checkedInTime: "09:05 AM" },
  ];

  const sorted = sortQueue(queue);
  assert.equal(sorted[0].citizenName, "EarlyCheckIn");
  assert.equal(sorted[1].citizenName, "LateCheckIn");
});

test("Queue Priority - Late-arrival policy prevents late citizens from jumping ahead of on-time waiting citizens", () => {
  // Scenario:
  // On-time citizen: 09:30 AM appointment, checked in at 09:15 AM.
  // Late citizen: 09:00 AM appointment, but arrived LATE at 09:40 AM.
  // Next citizen: 10:00 AM appointment, checked in at 09:45 AM.
  const queue = [
    { id: "1", citizenName: "LateArrival_0900", timeSlot: "09:00 AM", checkedInTime: "09:40 AM" },
    { id: "2", citizenName: "OnTime_0930", timeSlot: "09:30 AM", checkedInTime: "09:15 AM" },
    { id: "3", citizenName: "OnTime_1000", timeSlot: "10:00 AM", checkedInTime: "09:45 AM" },
  ];

  const sorted = sortQueue(queue);
  // On-time 09:30 AM citizen was already waiting and should be served first!
  assert.equal(sorted[0].citizenName, "OnTime_0930");
  // Late 09:00 AM citizen is served second (at effective 09:40 AM check-in time)
  assert.equal(sorted[1].citizenName, "LateArrival_0900");
  // On-time 10:00 AM citizen is served third
  assert.equal(sorted[2].citizenName, "OnTime_1000");
});

test("Queue Position Preview - Calculates how many citizens are scheduled before selected appointment time", () => {
  const departmentSlotCounts = {
    "08:30 AM": 1,
    "09:00 AM": 2,
    "09:30 AM": 1,
    "10:00 AM": 1,
  };

  const getPeopleAhead = (targetTime) => {
    const targetMin = parseTimeToMinutes(targetTime);
    let count = 0;
    for (const [timeKey, num] of Object.entries(departmentSlotCounts)) {
      if (parseTimeToMinutes(timeKey) < targetMin) {
        count += Number(num) || 0;
      }
    }
    return count;
  };

  // 08:30 AM: first slot of the day -> 0 people ahead (Serving Order: #1)
  assert.equal(getPeopleAhead("08:30 AM"), 0);

  // 09:00 AM: 1 citizen at 08:30 AM -> 1 person ahead (Serving Order: #2)
  assert.equal(getPeopleAhead("09:00 AM"), 1);

  // 09:30 AM: 1 at 08:30 + 2 at 09:00 -> 3 people ahead (Serving Order: #4)
  assert.equal(getPeopleAhead("09:30 AM"), 3);

  // 10:00 AM: 1 at 08:30 + 2 at 09:00 + 1 at 09:30 -> 4 people ahead (Serving Order: #5)
  assert.equal(getPeopleAhead("10:00 AM"), 4);
});
