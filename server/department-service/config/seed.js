// The seven Woreda departments, created on startup when missing (existing ones are left as they are).
// IDs match DEFAULT_DEPARTMENTS in client/context/store.js.
import { insertMissing } from "../repositories/department.repository.js";
import { logger } from "./logger.js";

const DEPARTMENTS = [];

export async function seedDepartments() {
  if (!DEPARTMENTS || DEPARTMENTS.length === 0) return;
  const created = await insertMissing(
    DEPARTMENTS.map(([_id, code, name, description, buildingRoom, contactPhone]) => ({ _id, code, name, description, buildingRoom, contactPhone })),
  );
  if (created > 0) logger.info({ created }, "seeded departments");
}
