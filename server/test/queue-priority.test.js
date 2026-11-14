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

test("Queue Position Management - Calculate queue positions per serving desk / queue group", () => {
  // Scenario:
  // Birth Registration queue:
  // Citizen A (4:00 PM) -> Position 1
  // Citizen B (4:30 PM) -> Position 2
  //
  // School Registration queue:
  // Citizen C (4:15 PM) -> Position 1
  // Citizen D (4:45 PM) -> Position 2
  const appointments = [
    { id: "apt-A", citizenName: "Citizen A", serviceName: "Birth Registration", timeSlot: "04:00 PM", status: "PENDING" },
    { id: "apt-B", citizenName: "Citizen B", serviceName: "Birth Registration", timeSlot: "04:30 PM", status: "PENDING" },
    { id: "apt-C", citizenName: "Citizen C", serviceName: "School Registration Support", timeSlot: "04:15 PM", status: "PENDING" },
    { id: "apt-D", citizenName: "Citizen D", serviceName: "School Registration Support", timeSlot: "04:45 PM", status: "PENDING" },
  ];

  function computeQueuePositionsPerGroup(list) {
    const eligible = list.filter((a) =>
      ["PENDING", "APPROVED", "CHECKED_IN", "IN_PROGRESS"].includes(a.status)
    );
    // Group by serving desk / queue group (service)
    const groups = new Map();
    eligible.forEach((a) => {
      const key = a.serviceId || a.serviceName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    });

    const positions = new Map();
    groups.forEach((groupItems) => {
      const sorted = sortQueue(groupItems);
      sorted.forEach((item, index) => {
        positions.set(item.id, index + 1);
      });
    });
    return positions;
  }

  const positions = computeQueuePositionsPerGroup(appointments);

  // Birth Registration queue positions:
  assert.equal(positions.get("apt-A"), 1, "Citizen A (4:00 PM) should be Position 1 in Birth Registration queue");
  assert.equal(positions.get("apt-B"), 2, "Citizen B (4:30 PM) should be Position 2 in Birth Registration queue");

  // School Registration queue positions:
  assert.equal(positions.get("apt-C"), 1, "Citizen C (4:15 PM) should be Position 1 in School Registration queue");
  assert.equal(positions.get("apt-D"), 2, "Citizen D (4:45 PM) should be Position 2 in School Registration queue");

  // Verify independence: Citizen C (4:15 PM) does NOT push Citizen B (4:30 PM) in Birth Registration
  assert.equal(positions.get("apt-B"), 2, "Citizen B remains Position 2 in their own serving desk queue");

  // If Citizen A cancels or is rejected, Citizen B moves to Position 1 in Birth Registration:
  const aptA = appointments.find((a) => a.id === "apt-A");
  aptA.status = "REJECTED";
  const updatedPositions = computeQueuePositionsPerGroup(appointments);
  assert.equal(updatedPositions.get("apt-A"), undefined);
  assert.equal(updatedPositions.get("apt-B"), 1, "Citizen B advances to Position 1 in Birth Registration queue");
  // School Registration queue remains unaffected:
  assert.equal(updatedPositions.get("apt-C"), 1);
  assert.equal(updatedPositions.get("apt-D"), 2);
});

test("Queue Position Management - Verify Now Serving, Completed, and Behind updates on cancellation", () => {
  // Scenario:
  // Three citizens booked Birth Registration:
  // Citizen B: 4:00 PM
  // Citizen A: 4:30 PM
  // Citizen C: 5:00 PM
  const appointments = [
    { id: "apt-B", citizenName: "Citizen B", serviceName: "Birth Registration", timeSlot: "04:00 PM", status: "APPROVED" },
    { id: "apt-A", citizenName: "Citizen A", serviceName: "Birth Registration", timeSlot: "04:30 PM", status: "APPROVED" },
    { id: "apt-C", citizenName: "Citizen C", serviceName: "Birth Registration", timeSlot: "05:00 PM", status: "APPROVED" },
  ];

  function computeQueueMetrics(list) {
    const eligible = list.filter((a) =>
      ["PENDING", "APPROVED", "CHECKED_IN", "IN_PROGRESS", "SERVING"].includes(a.status)
    );
    const sorted = sortQueue(eligible);
    const total = sorted.length;
    const metrics = new Map();
    sorted.forEach((item, index) => {
      const position = index + 1;
      const ahead = index;
      const behind = total - 1 - index;
      metrics.set(item.id, { position, ahead, behind, total, status: item.status });
    });
    return metrics;
  }

  // Initial state:
  // Citizen B: Position 1, Ahead 0, Behind 2
  // Citizen A: Position 2, Ahead 1, Behind 1
  // Citizen C: Position 3, Ahead 2, Behind 0
  let m = computeQueueMetrics(appointments);
  assert.deepEqual(m.get("apt-B"), { position: 1, ahead: 0, behind: 2, total: 3, status: "APPROVED" });
  assert.deepEqual(m.get("apt-A"), { position: 2, ahead: 1, behind: 1, total: 3, status: "APPROVED" });
  assert.deepEqual(m.get("apt-C"), { position: 3, ahead: 2, behind: 0, total: 3, status: "APPROVED" });

  // Verification 1. Now Serving: When Citizen B starts receiving service, their status becomes Serving
  appointments.find((a) => a.id === "apt-B").status = "SERVING";
  m = computeQueueMetrics(appointments);
  assert.equal(m.get("apt-B").status, "SERVING", "Citizen B should have status SERVING");

  // Verification 3. Queue updates: When Citizen C cancels, Citizen A's People Behind automatically changes from 1 to 0
  appointments.find((a) => a.id === "apt-C").status = "CANCELLED";
  m = computeQueueMetrics(appointments);
  assert.equal(m.get("apt-C"), undefined, "Cancelled Citizen C should not be in active queue");
  assert.equal(m.get("apt-A").behind, 0, "Citizen A's People Behind should automatically change from 1 to 0");
  assert.equal(m.get("apt-A").ahead, 1, "Citizen A's People Ahead remains 1 (Citizen B is still in serving)");
  assert.equal(m.get("apt-A").position, 2, "Citizen A remains Position 2");

  // Verification 2. Completed: Once Citizen B finishes, they show Completed and disappear from active queue calculations
  appointments.find((a) => a.id === "apt-B").status = "COMPLETED";
  m = computeQueueMetrics(appointments);
  assert.equal(m.get("apt-B"), undefined, "Completed Citizen B should disappear from active queue calculations");
  assert.equal(m.get("apt-A").position, 1, "Citizen A advances to Position 1");
  assert.equal(m.get("apt-A").ahead, 0, "Citizen A has 0 people ahead");
  assert.equal(m.get("apt-A").behind, 0, "Citizen A has 0 people behind");
});
