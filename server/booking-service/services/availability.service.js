// Per-slot availability of a service on a date (public: the citizen booking page shows it before sign-in).
import { ValidationError } from "../utils/errors.js";
import { clockTime, parseDate, today } from "../utils/time.js";
import { applyDailyCapacity, buildSlots, closedReason, markPast, perTimeCapacity } from "../utils/slots.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as catalog from "../repositories/catalog.repository.js";
import * as appointments from "../repositories/appointment.repository.js";

/** Validates availability query parameters (date first, as Go). Returns the parsed day. */
export function validateAvailability(serviceId, date) {
  const v = new ValidationError();
  const day = parseDate(date);
  if (!day) v.add("date", "Date must be YYYY-MM-DD.");
  if (!serviceId) v.add("serviceId", "serviceId is required.");
  v.throwIfAny();
  return day;
}

/**
 * The schedule in force for a service on date: ACTIVE, effective on that date, either for the
 * service itself or department-wide for the service's department (service-specific wins).
 */
async function activeSchedule(serviceId, date) {
  const service = await catalog.findServiceDepartment(serviceId);
  return schedules.findActive(serviceId, service, date);
}

export function createAvailabilityService() {
  return {
    async availability(serviceId, date) {
      const day = validateAvailability(serviceId, date);
      const [parallel, schedule, counts] = await Promise.all([
        catalog.maxParallelSlots(),
        activeSchedule(serviceId, date),
        appointments.countBySlot(serviceId, date),
      ]);
      const max = perTimeCapacity(schedule, parallel);
      // Public holidays are not modelled yet.
      const bookedForDay = Object.values(counts).reduce((sum, n) => sum + n, 0);
      let slots = buildSlots(schedule, day, counts, max);
      let reason = closedReason(schedule, day, bookedForDay);
      if (date === today()) {
        // Times that have already started today cannot be booked; when none is left the day is over.
        const [h, m] = clockTime().split(":").map(Number);
        const hadOpen = slots.some((s) => s.status !== "Unavailable");
        slots = markPast(slots, h * 60 + m);
        if (!reason && hadOpen && slots.every((s) => s.status === "Unavailable")) reason = "DAY_OVER";
      }
      return {
        serviceId,
        date,
        maxParallelSlots: max,
        closedReason: reason,
        dailyCapacity: schedule?.dailyCapacity ?? 0,
        bookedForDay,
        openingTime: schedule?.openingTime ?? null,
        closingTime: schedule?.closingTime ?? null,
        slots: applyDailyCapacity(slots, reason),
      };
    },
  };
}
