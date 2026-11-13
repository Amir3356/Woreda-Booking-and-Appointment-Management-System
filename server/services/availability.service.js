// Per-slot availability of a service on a date (public: the booking page shows it before sign-in),
// and the citizen's list of bookable dates. Both follow the full scheduling rules: operating hours,
// calendar exceptions and the daily capacities (per service; per department on exceptional working days).
import { nowMinutes, parseDate, today } from "../utils/date.js";
import { DEFAULT_MAX_PARALLEL_SLOTS, applyDailyCapacity, buildSlots, closedReason, markPast, perTimeCapacity, slotDuration } from "../utils/slots.js";
import { eachDate, exceptionsOn, resolveDay, serviceScheduleOn } from "../utils/calendar.js";
import { NotFoundError } from "../utils/errors.js";
import { effectiveDay } from "./dayRules.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";
import * as appointments from "../repositories/appointment.repository.js";
import * as settings from "../repositories/settings.repository.js";
import * as calendar from "../repositories/calendar.repository.js";

export function createAvailabilityService() {
  return {
    /** Validated query: { serviceId, date }. */
    async availability({ serviceId, date }) {
      const service = await publicServices.findById(serviceId);
      const departmentId = service?.departmentId ?? null;
      const day = parseDate(date);
      const [parallel, rules, counts, departmentBooked] = await Promise.all([
        settings.findMaxParallelSlots(),
        effectiveDay({ serviceId, departmentId, date }),
        appointments.countBySlot(serviceId, date),
        departmentId ? appointments.countDepartmentDay({ departmentId, date }) : 0,
      ]);
      const schedule = rules.open ? rules.schedule : null;
      const max = 1; // Exactly 1 appointment per slot per service to prevent duplicate bookings
      const bookedForDay = Object.values(counts).reduce((sum, n) => sum + n, 0);
      let slots = buildSlots(schedule, day, counts, max);
      let reason = rules.open ? closedReason(schedule, day, bookedForDay) : rules.reason;
      if (!reason && rules.departmentCapacity && departmentBooked >= rules.departmentCapacity) reason = "DEPARTMENT_CAPACITY_REACHED";
      if (date === today()) {
        // Times that have already started today cannot be booked; when none is left the day is over.
        const hadOpen = slots.some((s) => s.status !== "Unavailable");
        slots = markPast(slots, nowMinutes());
        if (!reason && hadOpen && slots.every((s) => s.status === "Unavailable")) reason = "DAY_OVER";
      }
      // Appointments belong to a department: a service not yet assigned to one cannot be booked.
      if (service && !departmentId) {
        reason = "SERVICE_UNASSIGNED";
        slots = [];
      }
      return {
        serviceId,
        date,
        maxParallelSlots: max,
        slotIntervalMinutes: schedule ? slotDuration(schedule) : 30,
        closedReason: reason,
        closedNote: rules.note,
        exceptionalWorkingDay: rules.exception?.type === "WORKING_DAY",
        dailyCapacity: schedule?.dailyCapacity ?? 0,
        bookedForDay,
        departmentCapacity: rules.departmentCapacity,
        departmentBooked,
        openingTime: schedule?.openingTime ?? null,
        closingTime: schedule?.closingTime ?? null,
        slots: applyDailyCapacity(slots, reason),
      };
    },

    /**
     * Public: which dates in [from, to] a citizen can book for the service. Only the verdict is
     * returned (available, and a reason code when not), never the configuration behind it.
     */
    async bookableDates({ serviceId, from, to }) {
      const service = await publicServices.findById(serviceId);
      if (!service) throw new NotFoundError();
      const departmentId = service.departmentId ?? null;
      if (!departmentId) return eachDate(from, to).map((date) => ({ date, available: false, reason: "SERVICE_UNASSIGNED" }));
      const [list, exceptions, serviceCounts, departmentCounts] = await Promise.all([
        schedules.findActiveList({ serviceId }),
        calendar.findExceptions({ from, to, departmentId }),
        appointments.countServiceDays({ serviceId, from, to }),
        departmentId ? appointments.countByDepartmentDay({ from, to, departmentIds: [departmentId] }) : {},
      ]);
      const relevant = list.filter(
        (s) => s.serviceId === serviceId || (departmentId && s.departmentId === departmentId) || (!s.departmentId && !s.serviceId),
      );
      const now = today();
      return eachDate(from, to).map((date) => {
        if (date < now) return { date, available: false, reason: "PAST" };
        const rules = resolveDay({
          date,
          baseSchedule: serviceScheduleOn(relevant, serviceId, departmentId, date),
          exceptions: exceptionsOn(exceptions, departmentId, date),
        });
        if (!rules.open) return { date, available: false, reason: rules.reason };
        if ((serviceCounts[date] ?? 0) >= rules.schedule.dailyCapacity) return { date, available: false, reason: "DAILY_CAPACITY_REACHED" };
        if (rules.departmentCapacity && (departmentCounts[`${departmentId}|${date}`] ?? 0) >= rules.departmentCapacity) {
          return { date, available: false, reason: "DEPARTMENT_CAPACITY_REACHED" };
        }
        return { date, available: true, reason: null, exceptionalWorkingDay: rules.exception?.type === "WORKING_DAY" };
      });
    },
  };
}
