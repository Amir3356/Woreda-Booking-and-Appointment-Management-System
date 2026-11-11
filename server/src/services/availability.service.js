// Per-slot availability of a service on a date (public: the booking page shows it before sign-in).
import { nowMinutes, parseDate, today } from "../utils/date.js";
import { DEFAULT_MAX_PARALLEL_SLOTS, applyDailyCapacity, buildSlots, closedReason, markPast, perTimeCapacity } from "../utils/slots.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as settings from "../repositories/settings.repository.js";

/** The schedule in force for a service on date (service-specific wins over department-wide). */
export async function activeSchedule(serviceId, date, client) {
  const service = await publicServices.findById(serviceId);
  return schedules.findActive(serviceId, service?.departmentId ?? null, date, client);
}

export function createAvailabilityService() {
  return {
    /** Validated query: { serviceId, date }. */
    async availability({ serviceId, date }) {
      const day = parseDate(date);
      const [parallel, schedule, counts] = await Promise.all([
        settings.findMaxParallelSlots(),
        activeSchedule(serviceId, date),
        appointments.countBySlot(serviceId, date),
      ]);
      const max = perTimeCapacity(schedule, parallel ?? DEFAULT_MAX_PARALLEL_SLOTS);
      const bookedForDay = Object.values(counts).reduce((sum, n) => sum + n, 0);
      let slots = buildSlots(schedule, day, counts, max);
      let reason = closedReason(schedule, day, bookedForDay);
      if (date === today()) {
        // Times that have already started today cannot be booked; when none is left the day is over.
        const hadOpen = slots.some((s) => s.status !== "Unavailable");
        slots = markPast(slots, nowMinutes());
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
