// Per-slot availability of a service on a date (public: the citizen booking page shows it before sign-in).
import { ValidationError } from "../utils/errors.js";
import { parseDate } from "../utils/time.js";
import { buildSlots } from "../utils/slots.js";
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
      const [max, schedule, counts] = await Promise.all([
        catalog.maxParallelSlots(),
        activeSchedule(serviceId, date),
        appointments.countBySlot(serviceId, date),
      ]);
      // TODO (as in Go): also enforce schedules.dailyCapacity / services.dailyQuota and public holidays.
      return { serviceId, date, maxParallelSlots: max, slots: buildSlots(schedule, day, counts, max) };
    },
  };
}
