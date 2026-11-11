// Table "departments".

/** departments row (optionally with officer_count / service_count) -> API shape. */
export function fromRow(r) {
  if (!r) return null;
  const d = {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    buildingRoom: r.building_room,
    contactPhone: r.contact_phone,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (r.officer_count !== undefined) d.officerCount = r.officer_count;
  if (r.service_count !== undefined) d.serviceCount = r.service_count;
  return d;
}
