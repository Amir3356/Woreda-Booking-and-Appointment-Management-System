// Data access for "users" (citizen profiles and staff accounts).
import { one, query, rows } from "../config/database.js";
import { fromRow } from "../models/user.model.js";
import { containsPattern } from "../utils/pagination.js";

const WOREDA_EXPR = `COALESCE((SELECT btrim(seg) FROM unnest(string_to_array(COALESCE(u.address, ''), ',')) AS seg WHERE btrim(seg) ~* '^woreda' LIMIT 1), 'Woreda 03')`;
const KEBELE_EXPR = `COALESCE((SELECT btrim(seg) FROM unnest(string_to_array(COALESCE(u.address, ''), ',')) AS seg WHERE btrim(seg) ~* '^kebele' LIMIT 1), 'Kebele 03')`;
const LOCATION_EXPR = `COALESCE(NULLIF(array_to_string(ARRAY(SELECT btrim(seg) FROM unnest(string_to_array(COALESCE(u.address, ''), ',')) AS seg WHERE btrim(seg) <> '' AND btrim(seg) !~* '^(kebele|woreda|house)'), ', '), ''), 'Addis Ababa')`;

const SELECT_WITH_DEPARTMENT = `
  SELECT u.*, d.name AS department_name
  FROM users u LEFT JOIN departments d ON d.id = u.department_id`;

/** Emails compare case-insensitively. */
export async function existsByEmail(email) {
  return Boolean(await one("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [email]));
}

export async function existsByPhone(phone) {
  return Boolean(await one("SELECT 1 FROM users WHERE phone = $1 AND phone <> ''", [phone]));
}

export async function existsByNationalId(nationalId) {
  return Boolean(await one("SELECT 1 FROM users WHERE national_id = $1", [nationalId]));
}

export async function exists(id) {
  return Boolean(await one("SELECT 1 FROM users WHERE id = $1", [id]));
}

/** Inserts a user and returns it. */
export async function create(u) {
  const row = await one(
    `INSERT INTO users (id, full_name, email, phone, password_hash, national_id, role, department_id, counter_number, address, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [u.id, u.fullName, u.email, u.phone ?? "", u.passwordHash, u.nationalId, u.role, u.departmentId ?? null,
      u.counterNumber ?? null, u.address ?? null, u.isActive ?? true],
  );
  return fromRow(row);
}

/** Case-insensitive email lookup with departmentName (includes passwordHash). */
export async function findByEmail(email) {
  return fromRow(await one(`${SELECT_WITH_DEPARTMENT} WHERE LOWER(u.email) = LOWER($1)`, [email]));
}

/** Lookup by normalized phone number (includes passwordHash). */
export async function findByPhone(phone) {
  return fromRow(await one(`${SELECT_WITH_DEPARTMENT} WHERE u.phone = $1 AND u.phone <> ''`, [phone]));
}

export async function findById(id) {
  return fromRow(await one(`${SELECT_WITH_DEPARTMENT} WHERE u.id = $1`, [id]));
}

export async function findCitizen(id) {
  return fromRow(await one("SELECT * FROM users WHERE id = $1 AND role = 'CITIZEN'", [id]));
}

/** Returns false when no citizen has this id. */
export async function updateCitizen(id, f) {
  const { rowCount } = await query(
    `UPDATE users SET full_name = $2, phone = $3, email = $4, national_id = $5, address = $6, updated_at = now()
     WHERE id = $1 AND role = 'CITIZEN'`,
    [id, f.fullName, f.phone, f.email, f.nationalId, f.address],
  );
  return rowCount > 0;
}

/** Citizen accounts matching search + woreda/kebele/location filters: {total, totalRegistered, addresses, items} for one page, newest first. */
export async function findCitizenPage({ search = "", woreda = "", kebele = "", location = "", offset = 0, limit = 5 }) {
  const params = [];
  const where = ["u.role = 'CITIZEN'"];
  if (search !== "") {
    params.push(containsPattern(search));
    const p = `$${params.length}`;
    where.push(`(u.full_name ILIKE ${p} OR u.phone ILIKE ${p} OR COALESCE(u.address, '') ILIKE ${p})`);
  }
  if (woreda !== "" && woreda.toUpperCase() !== "ALL") {
    params.push(woreda);
    where.push(`LOWER(${WOREDA_EXPR}) = LOWER($${params.length})`);
  }
  if (kebele !== "" && kebele.toUpperCase() !== "ALL") {
    params.push(kebele);
    where.push(`LOWER(${KEBELE_EXPR}) = LOWER($${params.length})`);
  }
  if (location !== "" && location.toUpperCase() !== "ALL") {
    params.push(location);
    where.push(`LOWER(${LOCATION_EXPR}) = LOWER($${params.length})`);
  }
  const whereSql = where.join(" AND ");
  const [{ total }] = await rows(`SELECT COUNT(*)::int AS total FROM users u WHERE ${whereSql}`, params);
  const [{ total_registered: totalRegistered }] = await rows("SELECT COUNT(*)::int AS total_registered FROM users WHERE role = 'CITIZEN'");
  const addressRows = await rows("SELECT DISTINCT address FROM users WHERE role = 'CITIZEN'");
  const items = await rows(
    `SELECT u.id, u.full_name, u.email, u.phone, u.national_id, u.address, u.is_active, u.created_at, u.updated_at
     FROM users u WHERE ${whereSql} ORDER BY u.created_at DESC, u.id DESC
     OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    [...params, offset, limit],
  );
  return {
    total,
    totalRegistered,
    addresses: addressRows.map((r) => r.address),
    items: items.map(fromRow),
  };
}

/** Staff (non-citizen) accounts matching search/role/department (ILIKE): {total, items} for one page, newest first. */
export async function findStaffPage(opts, maybeOffset, maybeLimit) {
  let search = "";
  let role = "";
  let departmentId = "";
  let offset = 0;
  let limit = 4;

  if (typeof opts === "object" && opts !== null) {
    search = opts.search || "";
    role = opts.role || "";
    departmentId = opts.departmentId || "";
    offset = opts.offset ?? 0;
    limit = opts.limit ?? 4;
  } else {
    search = opts || "";
    offset = maybeOffset ?? 0;
    limit = maybeLimit ?? 4;
  }

  const params = [];
  let where = "u.role <> 'CITIZEN'";

  if (role && role !== "ALL") {
    if (role === "ADMIN" || role === "Admin" || role === "Central Administrator") {
      where += " AND u.role = 'ADMIN'";
    } else if (role === "OFFICER" || role === "Department Officer") {
      where += " AND u.role = 'OFFICER'";
    } else {
      params.push(role);
      where += ` AND (d.name = $${params.length} OR u.department_id = $${params.length})`;
    }
  }

  if (departmentId && departmentId !== "ALL") {
    params.push(departmentId);
    where += ` AND u.department_id = $${params.length}`;
  }

  if (search && search.trim() !== "") {
    params.push(containsPattern(search.trim()));
    const pIdx = params.length;
    where += ` AND (u.full_name ILIKE $${pIdx} OR u.phone ILIKE $${pIdx} OR COALESCE(u.email, '') ILIKE $${pIdx} OR COALESCE(d.name, '') ILIKE $${pIdx})`;
  }

  const [{ total }] = await rows(
    `SELECT COUNT(*)::int AS total FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE ${where}`,
    params,
  );
  const items = await rows(
    `${SELECT_WITH_DEPARTMENT} WHERE ${where} ORDER BY u.created_at DESC, u.id DESC
     OFFSET $${params.length + 1} LIMIT $${params.length + 2}`,
    [...params, offset, limit],
  );
  return { total, items: items.map(fromRow) };
}

/** Updates a staff (non-citizen) account; updates passwordHash only when provided. Returns false when not found. */
export async function updateStaff(id, f) {
  const fields = [
    "full_name = $2",
    "phone = $3",
    "email = $4",
    "role = $5",
    "department_id = $6",
    "updated_at = now()",
  ];
  const params = [id, f.fullName, f.phone, f.email, f.role, f.departmentId ?? null];
  if (f.passwordHash) {
    params.push(f.passwordHash);
    fields.push(`password_hash = $${params.length}`);
  }
  const { rowCount } = await query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $1 AND role <> 'CITIZEN'`,
    params,
  );
  return rowCount > 0;
}

/** Flips is_active of a staff account; returns the new value, or null when not found. */
export async function toggleStaffActive(id) {
  const row = await one(
    "UPDATE users SET is_active = NOT is_active, updated_at = now() WHERE id = $1 AND role <> 'CITIZEN' RETURNING is_active",
    [id],
  );
  return row ? row.is_active : null;
}

/** Returns false when no staff account has this id. */
export async function removeStaff(id) {
  const { rowCount } = await query("DELETE FROM users WHERE id = $1 AND role <> 'CITIZEN'", [id]);
  return rowCount > 0;
}

/** The officer's desk counter number (null when unset or unknown). */
export async function findCounterNumber(id, client) {
  const row = await one("SELECT counter_number FROM users WHERE id = $1", [id], client);
  return row?.counter_number ?? null;
}
