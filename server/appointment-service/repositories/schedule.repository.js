// Reads "schedules" (owned by booking-service; Admin > Schedule Management). Read-only here.
import mongoose from "mongoose";

const schedules = () => mongoose.connection.collection("schedules");

/**
 * The ACTIVE schedule in force on date for the service, or department-wide (serviceId null) for its
 * department; a service-specific schedule wins (same rule as booking-service availability). Null if none.
 */
export async function findActive(serviceId, departmentId, date) {
  const rows = await schedules()
    .find({
      status: "ACTIVE",
      $or: [{ serviceId }, { serviceId: null, departmentId }],
      effectiveStartDate: { $lte: date },
      $and: [{ $or: [{ effectiveEndDate: null }, { effectiveEndDate: { $gte: date } }] }],
    })
    .toArray();
  return rows.find((s) => s.serviceId === serviceId) ?? rows[0] ?? null;
}
