// Table "schedules": operating hours per department, optionally per service.
export const STATUSES = Object.freeze(["ACTIVE", "INACTIVE"]);

const clock = (t) => (t == null ? null : String(t).slice(0, 5)); // TIME "08:30:00" -> "08:30"

/** schedules row joined with department_name / service_name -> API shape (status stays raw). */
export function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    department: r.department_name,
    departmentId: r.department_id,
    service: r.service_id != null ? (r.service_name ?? null) : null,
    serviceId: r.service_id ?? null,
    workingDays: r.working_days ?? [],
    openingTime: clock(r.opening_time),
    closingTime: clock(r.closing_time),
    dailyCapacity: r.daily_capacity,
    effectiveStartDate: r.effective_start_date,
    effectiveEndDate: r.effective_end_date ?? null,
    status: r.status,
  };
}

/** Client status label ("Active" | "Inactive"). */
export const statusLabel = (status) => (status === "ACTIVE" ? "Active" : "Inactive");
