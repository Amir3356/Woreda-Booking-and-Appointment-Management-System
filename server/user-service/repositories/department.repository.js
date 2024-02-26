// Read-only lookups in "departments" (owned by department-service; was a foreign key / LEFT JOIN in Postgres).
import mongoose from "mongoose";

const departments = () => mongoose.connection.collection("departments");

export async function exists(id) {
  return Boolean(await departments().findOne({ _id: id }, { projection: { _id: 1 } }));
}

/** {departmentId -> name} for the given ids. */
export async function namesFor(ids) {
  const names = new Map();
  if (ids.length > 0) {
    for (const d of await departments().find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray()) {
      names.set(d._id, d.name);
    }
  }
  return names;
}
