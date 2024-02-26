// Reads of collections owned by other services: services and departments (department-service),
// users (auth-service) and system_settings (admin). Plain handles: no schema, no indexes.
import mongoose from "mongoose";

const services = () => mongoose.connection.collection("services");
const departments = () => mongoose.connection.collection("departments");
const users = () => mongoose.connection.collection("users");
const systemSettings = () => mongoose.connection.collection("system_settings");

export async function departmentExists(id) {
  return Boolean(await departments().findOne({ _id: id }, { projection: { _id: 1 } }));
}

export async function serviceExists(id) {
  return Boolean(await services().findOne({ _id: id }, { projection: { _id: 1 } }));
}

/** {_id, departmentId} of the service, or null when it does not exist. */
export const findServiceDepartment = (id) => services().findOne({ _id: id }, { projection: { departmentId: 1 } });

/** The department's code ("" when unset), or null when the department does not exist. */
export async function findDepartmentCode(id) {
  const d = await departments().findOne({ _id: id }, { projection: { code: 1 } });
  return d ? d.code ?? "" : null;
}

/** The service's name ("" when unset), or null when the service does not exist. */
export async function findServiceName(id) {
  const s = await services().findOne({ _id: id }, { projection: { name: 1 } });
  return s ? s.name ?? "" : null;
}

/** serviceId -> name ("" when unset) for the services that exist. */
export async function findServiceNames(ids) {
  const srvs = await services().find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray();
  return new Map(srvs.map((s) => [s._id, s.name ?? ""]));
}

/** The officer's desk counter number (undefined when unset or the user does not exist). */
export async function findOfficerCounter(userId, { session } = {}) {
  const officer = await users().findOne({ _id: userId }, { projection: { counterNumber: 1 }, session });
  return officer?.counterNumber;
}

/** system_settings.maxParallelSlots, default 3. */
export async function maxParallelSlots() {
  const s = await systemSettings().findOne({ _id: "primary" }, { projection: { maxParallelSlots: 1 } });
  return s?.maxParallelSlots ?? 3;
}
