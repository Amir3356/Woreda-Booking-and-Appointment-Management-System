/**
 * Frontend business logic for appointments.
 * Pure functions only — no state, no API calls, no DOM — to be shared by stores, pages, and hooks.
 */

/** Statuses that release an appointment slot back to available capacity. */
const RELEASED_STATUSES = new Set(["CANCELLED", "REJECTED"]);

/**
 * Computes per-slot availability for a service on a given date.
 * @param {Object} params
 * @param {Array} params.appointments - List of appointment objects
 * @param {Array} params.timeSlots - List of standard time slots
 * @param {string} params.serviceId - Service identifier
 * @param {string} params.date - Date in YYYY-MM-DD format
 * @param {number} [params.maxPerSlot=1] - Maximum bookings allowed per slot (defaults to 1 to prevent duplicate bookings)
 * @returns {Array<{ time: string, available: boolean, remainingCapacity: number }>}
 */
export function calculateAvailableSlots({
  appointments = [],
  timeSlots = [],
  serviceId,
  date,
  maxPerSlot = 1,
}) {
  if (!date) return [];

  const bookedSlots = appointments
    .filter(
      (a) =>
        a.serviceId === serviceId &&
        a.date === date &&
        !RELEASED_STATUSES.has(a.status)
    )
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
