// Frontend business logic for appointments.
// Pure functions only — no state, no API calls — so the store and pages can share them.

/** Builds a booking reference like WRD-20261102-4821 from a YYYY-MM-DD date. */
export function generateReferenceNumber(date) {
  const dateStr = date.replace(/-/g, "");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `WRD-${dateStr}-${randomNum}`;
}

/** Maps an appointment status to the notification type shown to the citizen. */
export function getStatusNotificationType(status) {
  if (status === "APPROVED" || status === "COMPLETED") return "SUCCESS";
  if (status === "REJECTED") return "ALERT";
  return "INFO";
}

/** Statuses that no longer occupy a time slot. */
const RELEASED_STATUSES = new Set(["CANCELLED", "REJECTED"]);

/**
 * Computes per-slot availability for a service on a given date.
 * @returns {{ time: string, available: boolean, remainingCapacity: number }[]}
 */
export function calculateAvailableSlots({ appointments, timeSlots, serviceId, date, maxPerSlot = 2 }) {
  if (!date) return [];

  const bookedSlots = appointments
    .filter((a) => a.serviceId === serviceId && a.date === date && !RELEASED_STATUSES.has(a.status))
    .map((a) => a.timeSlot);

  return timeSlots.map((slot) => {
    const count = bookedSlots.filter((s) => s === slot).length;
    return {
      time: slot,
      available: count < maxPerSlot,
      remainingCapacity: Math.max(0, maxPerSlot - count),
    };
  });
}
