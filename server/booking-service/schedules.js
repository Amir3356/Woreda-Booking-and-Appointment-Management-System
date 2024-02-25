// Operating schedules and per-slot availability (Go service/schedule_service.go + repository).
import { NotFoundError, ValidationError, newId } from "./lib/index.js";
import { Schedule, appointments, departments, services, systemSettings } from "./models.js";
import { buildSlots, decodeSchedule, scheduleLabel, validateAvailability, validateSchedule } from "./rules.js";

// Joins department and service names, as Go's selectSchedule did (INNER JOIN departments,
// LEFT JOIN services). Schedules whose department no longer exists are left out.
const joinNames = [
  { $lookup: { from: "departments", localField: "departmentId", foreignField: "_id", as: "dept" } },
  { $unwind: "$dept" },
  { $lookup: { from: "services", localField: "serviceId", foreignField: "_id", as: "srv" } },
];

function toSchedule(row) {
  const srv = row.srv?.[0];
  return {
    id: row._id,
    department: row.dept.name,
    departmentId: row.departmentId,
    service: row.serviceId != null && srv ? srv.name : null,
    serviceId: row.serviceId ?? null,
    workingDays: row.workingDays ?? [],
    openingTime: row.openingTime,
    closingTime: row.closingTime,
    dailyCapacity: row.dailyCapacity,
    effectiveStartDate: row.effectiveStartDate,
    effectiveEndDate: row.effectiveEndDate ?? null,
    status: row.status, // raw; labelled by the callers below
  };
}

const labelled = (s) => ({ ...s, status: scheduleLabel(s.status) });

export class Schedules {
  /** All schedules, ordered by department name, then newest effective start first. */
  async list() {
    const rows = await Schedule.aggregate([...joinNames, { $sort: { "dept.name": 1, effectiveStartDate: -1 } }]).collation({ locale: "en" });
    return rows.map((r) => labelled(toSchedule(r)));
  }

  async get(id) {
    const [row] = await Schedule.aggregate([{ $match: { _id: id } }, ...joinNames]);
    if (!row) throw new NotFoundError();
    return toSchedule(row);
  }

  async create(input) {
    const fields = validateSchedule(decodeSchedule(input));
    // Postgres foreign keys (a violation was a 500 in Go): report them as field errors instead.
    const v = new ValidationError();
    if (!(await departments().findOne({ _id: fields.departmentId }, { projection: { _id: 1 } }))) {
      v.add("departmentId", "Department does not exist.");
    }
    if (fields.serviceId !== null && !(await services().findOne({ _id: fields.serviceId }, { projection: { _id: 1 } }))) {
      v.add("serviceId", "Service does not exist.");
    }
    v.throwIfAny();
    const id = newId("SCH");
    await Schedule.create({ _id: id, ...fields, status: "ACTIVE" });
    return labelled(await this.get(id));
  }

  /**
   * The schedule in force for a service on date: ACTIVE, effective on that date, either for the
   * service itself or department-wide (serviceId null) for the service's department. A
   * service-specific schedule wins over a department-wide one.
   */
  async active(serviceId, date) {
    const svc = await services().findOne({ _id: serviceId }, { projection: { departmentId: 1 } });
    const scope = [{ serviceId }];
    if (svc) scope.push({ serviceId: null, departmentId: svc.departmentId });
    const rows = await Schedule.aggregate([
      {
        $match: {
          status: "ACTIVE",
          $or: scope,
          effectiveStartDate: { $lte: date },
          $and: [{ $or: [{ effectiveEndDate: null }, { effectiveEndDate: { $gte: date } }] }],
        },
      },
      ...joinNames,
      { $addFields: { departmentWide: { $cond: [{ $eq: [{ $ifNull: ["$serviceId", null] }, null] }, 1, 0] } } },
      { $sort: { departmentWide: 1 } }, // ORDER BY service_id NULLS LAST
      { $limit: 1 },
    ]);
    return rows.length ? toSchedule(rows[0]) : null;
  }

  /** Active bookings (not CANCELLED/REJECTED) per time slot for a service on date. */
  async slotCounts(serviceId, date) {
    const rows = await appointments()
      .aggregate([
        { $match: { serviceId, date, status: { $nin: ["CANCELLED", "REJECTED"] } } },
        { $group: { _id: "$timeSlot", n: { $sum: 1 } } },
      ])
      .toArray();
    return Object.fromEntries(rows.map((r) => [r._id, r.n]));
  }

  /** system_settings.maxParallelSlots, default 3. */
  async maxParallelSlots() {
    const s = await systemSettings().findOne({ _id: "primary" }, { projection: { maxParallelSlots: 1 } });
    return s?.maxParallelSlots ?? 3;
  }

  async availability(serviceId, date) {
    const day = validateAvailability(serviceId, date);
    const [max, schedule, counts] = await Promise.all([
      this.maxParallelSlots(),
      this.active(serviceId, date),
      this.slotCounts(serviceId, date),
    ]);
    // TODO (as in Go): also enforce schedules.dailyCapacity / services.dailyQuota and public holidays.
    return { serviceId, date, maxParallelSlots: max, slots: buildSlots(schedule, day, counts, max) };
  }
}
