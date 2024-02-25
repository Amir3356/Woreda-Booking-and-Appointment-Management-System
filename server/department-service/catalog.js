// Department and service catalog rules. Every successful change is announced on Kafka
// (topic woreda.catalog) so the gateway can refresh caches and open pages.
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey, newId } from "./lib/index.js";
import { Department, Service, appointments, schedules, users } from "./models.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

export class Catalog {
  constructor(events) {
    this.events = events;
  }

  // ---- departments -------------------------------------------------------------------------

  async listDepartments(isActive) {
    const filter = isActive === undefined ? {} : { isActive };
    const list = await Department.find(filter).collation({ locale: "en" }).sort({ name: 1 });
    return this.#withCounts(list);
  }

  async getDepartment(id) {
    const d = await Department.findById(id);
    if (!d) throw new NotFoundError();
    return (await this.#withCounts([d]))[0];
  }

  async createDepartment(input) {
    const fields = validateDepartment(input);
    const id = newId("dept");
    try {
      await Department.create({ _id: id, ...fields });
    } catch (err) {
      throw isDuplicateKey(err) ? new ConflictError(`department code ${fields.code} already exists`) : err;
    }
    const d = await this.getDepartment(id);
    this.events.publish("catalog.department.created", id, d);
    return d;
  }

  async updateDepartment(id, input) {
    const fields = validateDepartment(input);
    let res;
    try {
      res = await Department.updateOne({ _id: id }, { $set: fields });
    } catch (err) {
      throw isDuplicateKey(err) ? new ConflictError(`department code ${fields.code} already exists`) : err;
    }
    if (res.matchedCount === 0) throw new NotFoundError();
    const d = await this.getDepartment(id);
    this.events.publish("catalog.department.updated", id, d);
    return d;
  }

  async toggleDepartment(id) {
    const isActive = await toggle(Department, id);
    this.events.publish("catalog.department.status_changed", id, { isActive });
    return isActive;
  }

  async deleteDepartment(id) {
    if (await Service.exists({ departmentId: id })) {
      throw new ConflictError("department still has services; delete or move them first");
    }
    const res = await Department.deleteOne({ _id: id });
    if (res.deletedCount === 0) throw new NotFoundError();
    // The Postgres schema cleared users.department_id (ON DELETE SET NULL).
    await users().updateMany({ departmentId: id }, { $set: { departmentId: null, updatedAt: new Date() } });
    this.events.publish("catalog.department.deleted", id, null);
  }

  // ---- services ----------------------------------------------------------------------------

  async listServices({ departmentId, search, isActive }) {
    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: re }, { code: re }];
    }
    if (isActive !== undefined) filter.isActive = isActive;
    return Service.find(filter).collation({ locale: "en" }).sort({ name: 1 });
  }

  async getService(id) {
    const s = await Service.findById(id);
    if (!s) throw new NotFoundError();
    return s;
  }

  async createService(input) {
    const fields = validateService(input);
    await requireDepartment(fields.departmentId);
    const id = newId("srv");
    try {
      await Service.create({ _id: id, ...fields });
    } catch (err) {
      throw isDuplicateKey(err) ? new ConflictError(`service code ${fields.code} already exists`) : err;
    }
    const s = await this.getService(id);
    this.events.publish("catalog.service.created", id, s.toJSON());
    return s;
  }

  async updateService(id, input) {
    const fields = validateService(input);
    await requireDepartment(fields.departmentId);
    let res;
    try {
      res = await Service.updateOne({ _id: id }, { $set: fields });
    } catch (err) {
      throw isDuplicateKey(err) ? new ConflictError(`service code ${fields.code} already exists`) : err;
    }
    if (res.matchedCount === 0) throw new NotFoundError();
    const s = await this.getService(id);
    this.events.publish("catalog.service.updated", id, s.toJSON());
    return s;
  }

  async toggleService(id) {
    const isActive = await toggle(Service, id);
    this.events.publish("catalog.service.status_changed", id, { isActive });
    return isActive;
  }

  async deleteService(id) {
    // Postgres refused this (appointments.service_id ON DELETE RESTRICT).
    if (await appointments().findOne({ serviceId: id }, { projection: { _id: 1 } })) {
      throw new ConflictError("service has appointments; deactivate it instead");
    }
    const res = await Service.deleteOne({ _id: id });
    if (res.deletedCount === 0) throw new NotFoundError();
    // The Postgres schema cleared schedules.service_id (ON DELETE SET NULL).
    await schedules().updateMany({ serviceId: id }, { $set: { serviceId: null, updatedAt: new Date() } });
    this.events.publish("catalog.service.deleted", id, null);
  }

  // ---- helpers -----------------------------------------------------------------------------

  async #withCounts(departments) {
    const ids = departments.map((d) => d._id);
    const [officers, services] = await Promise.all([
      users().aggregate([{ $match: { departmentId: { $in: ids }, role: "OFFICER" } }, { $group: { _id: "$departmentId", n: { $sum: 1 } } }]).toArray(),
      Service.aggregate([{ $match: { departmentId: { $in: ids } } }, { $group: { _id: "$departmentId", n: { $sum: 1 } } }]),
    ]);
    const count = (rows) => new Map(rows.map((r) => [r._id, r.n]));
    const o = count(officers);
    const s = count(services);
    return departments.map((d) => ({ ...d.toJSON(), officerCount: o.get(d._id) ?? 0, serviceCount: s.get(d._id) ?? 0 }));
  }
}

/** Flips isActive atomically and returns the new value. */
async function toggle(Model, id) {
  const doc = await Model.collection.findOneAndUpdate(
    { _id: id },
    [{ $set: { isActive: { $not: "$isActive" }, updatedAt: "$$NOW" } }],
    { returnDocument: "after", projection: { isActive: 1 } },
  );
  if (!doc) throw new NotFoundError();
  return doc.isActive;
}

async function requireDepartment(departmentId) {
  if (!(await Department.exists({ _id: departmentId }))) {
    new ValidationError().add("departmentId", "Parent department does not exist.").throwIfAny();
  }
}

function validateDepartment(input) {
  const f = {
    name: str(input.name).trim(),
    code: str(input.code).trim().toUpperCase(),
    description: str(input.description),
    buildingRoom: str(input.buildingRoom),
    contactPhone: str(input.contactPhone),
  };
  const v = new ValidationError();
  if (!f.name) v.add("name", "Department name is required.");
  if (!f.code || f.code.length > 16) v.add("code", "Code is required (max 16 characters).");
  if (!f.buildingRoom.trim()) v.add("buildingRoom", "Building/room is required.");
  if (!f.contactPhone.trim()) v.add("contactPhone", "Contact phone is required.");
  v.throwIfAny();
  return f;
}

function validateService(input) {
  const f = {
    departmentId: str(input.departmentId),
    name: str(input.name).trim(),
    code: str(input.code).trim().toUpperCase(),
    description: str(input.description),
    durationMinutes: int(input.durationMinutes) || 30,
    dailyQuota: int(input.dailyQuota) || 40,
    feeETB: Number(input.feeETB) || 0,
    processingDays: str(input.processingDays) || "Same day",
    requiredDocuments: Array.isArray(input.requiredDocuments) ? input.requiredDocuments.map(str) : [],
  };
  const v = new ValidationError();
  if (!f.departmentId) v.add("departmentId", "Parent department is required.");
  if (!f.name) v.add("name", "Service name is required.");
  if (!f.code) v.add("code", "Service code is required.");
  if (f.durationMinutes < 0 || f.dailyQuota < 0) v.add("durationMinutes", "Duration and daily quota must be positive.");
  if (f.feeETB < 0) v.add("feeETB", "Fee cannot be negative.");
  v.throwIfAny();
  return f;
}
