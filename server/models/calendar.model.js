// Tables "calendar_exceptions" + "calendar_exception_departments" (Admin > Schedule Management).
export const EXCEPTION_TYPES = Object.freeze(["PUBLIC_HOLIDAY", "NON_WORKING_DAY", "BLOCKED", "WORKING_DAY"]);
export const SCOPES = Object.freeze(["ALL", "DEPARTMENT", "DEPARTMENTS"]);

const clock = (t) => (t == null ? null : String(t).slice(0, 5)); // TIME "08:30:00" -> "08:30"

/** calendar_exceptions row with department_ids / department_names arrays -> API shape. */
export function exceptionFromRow(r) {
  if (!r) return null;
  const ids = (r.department_ids ?? []).filter(Boolean);
  const names = (r.department_names ?? []).filter(Boolean);
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description ?? "",
    startDate: r.start_date,
    endDate: r.end_date,
    scope: r.scope,
    departmentIds: r.scope === "ALL" ? [] : ids,
    departments: r.scope === "ALL" ? [] : names,
    openingTime: clock(r.opening_time),
    closingTime: clock(r.closing_time),
    dailyCapacity: r.daily_capacity ?? null,
    createdBy: r.created_by ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Whether an exception covers a department (scope ALL covers every department). */
export const coversDepartment = (exception, departmentId) =>
  exception.scope === "ALL" || exception.departmentIds.includes(departmentId);
