/**
 * Frontend business logic for appointments.
 * Pure functions only — no state, no API calls, no DOM — to be shared by stores, pages, and hooks.
 */

/**
 * Builds a booking reference like WRD-20261102-4821 from a YYYY-MM-DD date.
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {string} Formatted reference number
 */
export function generateReferenceNumber(date) {
  const dateStr = (date || "").replace(/-/g, "");
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `WRD-${dateStr || new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomNum}`;
}

/**
 * Maps an appointment status to the notification/alert badge type shown to the citizen.
 * @param {string} status - Appointment status string
 * @returns {"SUCCESS" | "ALERT" | "INFO"}
 */
export function getStatusNotificationType(status) {
  if (status === "APPROVED" || status === "COMPLETED") return "SUCCESS";
  if (status === "REJECTED" || status === "CANCELLED" || status === "NO_SHOW") return "ALERT";
  return "INFO";
}

/** Statuses that release an appointment slot back to available capacity. */
export const RELEASED_STATUSES = new Set(["CANCELLED", "REJECTED"]);

/**
 * Computes per-slot availability for a service on a given date.
 * @param {Object} params
 * @param {Array} params.appointments - List of appointment objects
 * @param {Array} params.timeSlots - List of standard time slots
 * @param {string} params.serviceId - Service identifier
 * @param {string} params.date - Date in YYYY-MM-DD format
 * @param {number} [params.maxPerSlot=3] - Maximum parallel bookings allowed per slot
 * @returns {Array<{ time: string, available: boolean, remainingCapacity: number }>}
 */
export function calculateAvailableSlots({
  appointments = [],
  timeSlots = [],
  serviceId,
  date,
  maxPerSlot = 3,
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

/**
 * Filters appointments list by timeframe relative to today.
 * @param {Array} appointments
 * @param {"TODAY" | "UPCOMING" | "ALL"} timeframe
 * @param {string} [todayStr] - Today in YYYY-MM-DD format
 * @returns {Array} Filtered appointments
 */
export function filterAppointmentsByTimeframe(
  appointments = [],
  timeframe = "ALL",
  todayStr = new Date().toISOString().slice(0, 10)
) {
  if (timeframe === "TODAY") {
    return appointments.filter((a) => a.date === todayStr);
  }
  if (timeframe === "UPCOMING") {
    return appointments.filter((a) => a.date >= todayStr);
  }
  return appointments;
}

/**
 * Checks whether an appointment can be cancelled by a citizen.
 * @param {Object} appointment
 * @param {number} [cutoffHours=4] - Minimum hours required before the appointment to allow cancellation
 * @returns {boolean}
 */
export function canCancelAppointment(appointment, cutoffHours = 4) {
  if (!appointment) return false;
  if (["COMPLETED", "CANCELLED", "REJECTED", "CHECKED_IN", "IN_PROGRESS"].includes(appointment.status)) {
    return false;
  }
  try {
    const [hours, minutes] = (appointment.timeSlot || "09:00 AM").split(" ")[0].split(":");
    const isPM = (appointment.timeSlot || "").toUpperCase().includes("PM");
    let h = parseInt(hours, 10);
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;

    const aptDateTime = new Date(`${appointment.date}T${String(h).padStart(2, "0")}:${minutes || "00"}:00`);
    const cutoffTime = new Date(Date.now() + cutoffHours * 60 * 60 * 1000);
    return aptDateTime > cutoffTime;
  } catch {
    return true;
  }
}

/**
 * Derives aggregate stats for citizen appointments dashboard.
 * @param {Array} appointments
 * @param {string} citizenId
 * @returns {{ total: number, pending: number, approved: number, completed: number, rejected: number }}
 */
export function calculateCitizenAppointmentStats(appointments = [], citizenId) {
  const userApts = citizenId
    ? appointments.filter((a) => a.citizenId === citizenId)
    : appointments;

  return {
    total: userApts.length,
    pending: userApts.filter((a) => a.status === "PENDING").length,
    approved: userApts.filter((a) => a.status === "APPROVED").length,
    completed: userApts.filter((a) => a.status === "COMPLETED").length,
    rejected: userApts.filter((a) => a.status === "REJECTED").length,
  };
}
