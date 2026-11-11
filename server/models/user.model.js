// Table "users": citizens, department officers and administrators.
const LABEL_OFFICER = "Department Officer";
const LABEL_ADMIN = "Central Administrator";

/** users row (optionally joined with department_name) -> user object (includes passwordHash). */
export function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    passwordHash: r.password_hash,
    nationalId: r.national_id,
    role: r.role,
    departmentId: r.department_id ?? null,
    departmentName: r.department_name ?? null,
    counterNumber: r.counter_number ?? null,
    address: r.address ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** API shape: no passwordHash; departmentName, counterNumber and address omitted when null. */
export function toJSON(u) {
  const out = {
    id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, nationalId: u.nationalId,
    role: u.role, departmentId: u.departmentId ?? null,
  };
  if (u.departmentName != null) out.departmentName = u.departmentName;
  if (u.counterNumber != null) out.counterNumber = u.counterNumber;
  if (u.address != null) out.address = u.address;
  out.isActive = Boolean(u.isActive);
  out.createdAt = u.createdAt;
  out.updatedAt = u.updatedAt;
  return out;
}

/** Client label for a staff role. */
export function roleLabel(role) {
  if (role === "OFFICER") return LABEL_OFFICER;
  if (role === "ADMIN") return LABEL_ADMIN;
  return role;
}
