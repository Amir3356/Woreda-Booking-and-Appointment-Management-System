// Admin > Schedule Management beyond the weekly working hours: calendar exceptions, the calendar
// view and the impact of a change on booked appointments. Administrator only (routes + CASL).
// Changes never touch existing appointments: they stay as booked, and the impact endpoint lets the
// administrator see them before confirming.
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { today, weekdayOf } from "../utils/date.js";
import { cursorMeta } from "../utils/pagination.js";
import { departmentHoursOn, eachDate, exceptionsOn, resolveDay } from "../utils/calendar.js";
import * as calendar from "../repositories/calendar.repository.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as departments from "../repositories/department.repository.js";
import * as appointments from "../repositories/appointment.repository.js";

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

    async listExceptions(_caller, { from, to, departmentId, type }) {
      return calendar.findExceptions({ from, to, departmentId: departmentId || null, types: type ? [type] : undefined });
    },

    async listExceptionsPaged(_caller, { from, to, departmentId, type, cursor = 0, pageSize = 5 }) {
      const { total, items } = await calendar.findExceptionsPage({
        from,
        to,
        departmentId: departmentId || null,
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

    // ---- calendar views (month / week) ----

    /**
     * Every date in [from, to] for each department (or the one asked for): its status, why,
     * hours, capacity and booked appointments, with the exceptions in force.
     */
    async calendar(_caller, { from, to, departmentId }) {
      const scoped = departmentId || null;
      const deptIds = scoped ? [scoped] : undefined;
      const [deptList, scheduleList, exceptions, counts] = await Promise.all([
        departments.findAll(),
        schedules.findActiveList({ departmentId: scoped }),
        calendar.findExceptions({ from, to, departmentId: scoped }),
        appointments.countByDepartmentDay({ from, to, departmentIds: deptIds }),
      ]);
      const depts = deptList.filter((d) => !scoped || d.id === scoped);
      if (scoped && depts.length === 0) throw new NotFoundError();
      const now = today();
      const days = eachDate(from, to).map((date) => ({
        date,
        weekday: weekdayOf(date),
        past: date < now,
        entries: depts.map((d) => {
          const onDay = exceptionsOn(exceptions, d.id, date);
          const rules = resolveDay({
            date,
            baseSchedule: departmentHoursOn(scheduleList, d.id, date),
            exceptions: onDay,
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
            exceptions: onDay.map((e) => ({ id: e.id, type: e.type, title: e.title })),
          };
        }),
      }));
      return {
        from,
        to,
        departments: depts.map((d) => ({ id: d.id, name: d.name, isActive: d.isActive })),
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
