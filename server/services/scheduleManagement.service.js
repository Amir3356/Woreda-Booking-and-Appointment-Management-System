// Admin > Schedule Management beyond the weekly operating hours: calendar exceptions, per-date
// booking availability, department daily capacities, the calendar views and the impact of a change
// on booked appointments. Only the administrator changes anything (routes + CASL); department
// officers read their own department, read-only. Changes never touch existing appointments:
// they stay as booked, and the impact endpoint lets the administrator see them before confirming.
import { ForbiddenError, NotFoundError, ValidationError } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { today, weekdayOf } from "../utils/date.js";
import { cursorMeta } from "../utils/pagination.js";
import { departmentHoursOn, eachDate, exceptionsOn, resolveDay } from "../utils/calendar.js";
import * as calendar from "../repositories/calendar.repository.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as departments from "../repositories/department.repository.js";
import * as appointments from "../repositories/appointment.repository.js";

/** The department(s) a caller may see: officers only their own; the administrator any (or all). */
function scopeFor(caller, requested) {
  if (caller?.role === "ADMIN") return requested || null;
  if (!caller?.departmentId) throw new ForbiddenError("Your account is not assigned to a department.");
  if (requested && requested !== caller.departmentId) throw new ForbiddenError("You can only view your own department's schedule.");
  return caller.departmentId;
}

/** Day status shown on the calendars. */
function dayStatus(rules, booked) {
  if (!rules.open) return "UNAVAILABLE";
  if (rules.departmentCapacity && booked >= rules.departmentCapacity) return "FULL";
  return rules.exception?.type === "WORKING_DAY" ? "EXCEPTIONAL" : "AVAILABLE";
}

export function createScheduleManagementService({ events }) {
  async function checkDepartments(ids, field = "departmentIds") {
    const v = new ValidationError();
    for (const id of ids) {
      if (!(await departments.exists(id))) v.add(field, `Department ${id} does not exist.`);
    }
    v.throwIfAny();
  }

  async function getException(id) {
    const e = await calendar.findExceptionById(id);
    if (!e) throw new NotFoundError();
    return e;
  }

  const announce = (type, id, data) => events.publish(`catalog.schedule.${type}`, id, data);

  return {
    // ---- calendar exceptions ----

    async listExceptions(caller, { from, to, departmentId, type }) {
      const scoped = scopeFor(caller, departmentId);
      return calendar.findExceptions({ from, to, departmentId: scoped, types: type ? [type] : undefined });
    },

    async listExceptionsPaged(caller, { from, to, departmentId, type, cursor = 0, pageSize = 5 }) {
      const scoped = scopeFor(caller, departmentId);
      const { total, items } = await calendar.findExceptionsPage({
        from,
        to,
        departmentId: scoped,
        types: type ? [type] : undefined,
        offset: cursor,
        limit: pageSize,
      });
      return { items, cursor: cursorMeta(cursor, pageSize, total) };
    },

    async createException(caller, fields) {
      await checkDepartments(fields.departmentIds);
      const id = newId("EXC");
      await calendar.createException({ id, ...fields, createdBy: caller.userId });
      const created = await getException(id);
      announce("exception_created", id, created);
      return created;
    },

    async updateException(id, fields) {
      await checkDepartments(fields.departmentIds);
      if (!(await calendar.updateException(id, fields))) throw new NotFoundError();
      const updated = await getException(id);
      announce("exception_updated", id, updated);
      return updated;
    },

    async removeException(id) {
      if (!(await calendar.removeException(id))) throw new NotFoundError();
      announce("exception_deleted", id, null);
    },

    // ---- appointment availability (per-date booking switch) ----

    async setDateAvailability(caller, { departmentIds, startDate, endDate, enabled, reason }) {
      await checkDepartments(departmentIds);
      const range = { departmentIds, from: startDate, to: endDate };
      const changed = enabled
        ? await calendar.openDates(range)
        : await calendar.closeDates({ ...range, reason, by: caller.userId });
      announce(enabled ? "booking_enabled" : "booking_disabled", departmentIds.join(","), range);
      return { enabled, departmentIds, startDate, endDate, changed };
    },

    // ---- department daily capacities ----

    async listCapacities(caller) {
      const scoped = scopeFor(caller, null);
      const [list, caps] = await Promise.all([departments.findAll(), calendar.findCapacities()]);
      return list
        .filter((d) => !scoped || d.id === scoped)
        .map((d) => ({ departmentId: d.id, department: d.name, isActive: d.isActive, dailyCapacity: caps[d.id] ?? null }));
    },

    async setCapacity(caller, departmentId, dailyCapacity) {
      if (!(await departments.exists(departmentId))) throw new NotFoundError();
      if (dailyCapacity === null) await calendar.removeCapacity(departmentId);
      else await calendar.upsertCapacity(departmentId, dailyCapacity, caller.userId);
      announce("capacity_updated", departmentId, { dailyCapacity });
      return { departmentId, dailyCapacity };
    },

    // ---- calendar views (month / week) ----

    /**
     * Every date in [from, to] for each department in scope: its status, why, hours, capacity
     * and booked appointments, with the exceptions and closure in force.
     */
    async calendar(caller, { from, to, departmentId }) {
      const scoped = scopeFor(caller, departmentId);
      const deptIds = scoped ? [scoped] : undefined;
      const [deptList, scheduleList, exceptions, closures, caps, counts] = await Promise.all([
        departments.findAll(),
        schedules.findActiveList({ departmentId: scoped }),
        calendar.findExceptions({ from, to, departmentId: scoped }),
        calendar.findClosures({ from, to, departmentIds: deptIds }),
        calendar.findCapacities(),
        appointments.countByDepartmentDay({ from, to, departmentIds: deptIds }),
      ]);
      const depts = deptList.filter((d) => !scoped || d.id === scoped);
      if (scoped && depts.length === 0) throw new NotFoundError();
      const closed = new Map(closures.map((c) => [`${c.departmentId}|${c.date}`, c]));
      const now = today();
      const days = eachDate(from, to).map((date) => ({
        date,
        weekday: weekdayOf(date),
        past: date < now,
        entries: depts.map((d) => {
          const onDay = exceptionsOn(exceptions, d.id, date);
          const closure = closed.get(`${d.id}|${date}`) ?? null;
          const rules = resolveDay({
            date,
            baseSchedule: departmentHoursOn(scheduleList, d.id, date),
            exceptions: onDay,
            closure,
            departmentCapacity: caps[d.id] ?? null,
          });
          const booked = counts[`${d.id}|${date}`] ?? 0;
          return {
            departmentId: d.id,
            status: dayStatus(rules, booked),
            reason: rules.reason,
            note: rules.note,
            openingTime: rules.schedule?.openingTime ?? null,
            closingTime: rules.schedule?.closingTime ?? null,
            capacity: rules.departmentCapacity,
            booked,
            remaining: rules.departmentCapacity ? Math.max(0, rules.departmentCapacity - booked) : null,
            bookingDisabled: Boolean(closure),
            closureReason: closure?.reason ?? null,
            exceptions: onDay.map((e) => ({ id: e.id, type: e.type, title: e.title })),
          };
        }),
      }));
      return {
        from,
        to,
        departments: depts.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive, dailyCapacity: caps[d.id] ?? null })),
        days,
      };
    },

    /** Outstanding appointments on [from, to] for the departments (all when empty) — never modified here. */
    async impact({ from, to, departmentIds }) {
      const start = from < today() ? today() : from;
      if (start > to) return { from: start, to, total: 0, byStatus: {}, departments: [] };
      const list = await appointments.countOutstanding({ from: start, to, departmentIds });
      const byStatus = {};
      const byDept = new Map();
      for (const r of list) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + r.n;
        const d = byDept.get(r.department_id) ?? { departmentId: r.department_id, department: r.department_name, count: 0 };
        d.count += r.n;
        byDept.set(r.department_id, d);
      }
      return {
        from: start,
        to,
        total: list.reduce((sum, r) => sum + r.n, 0),
        byStatus,
        departments: [...byDept.values()],
      };
    },
  };
}
