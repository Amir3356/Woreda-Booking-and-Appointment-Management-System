// Table "services": the public services citizens book.

/** services row -> API shape. */
export function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    departmentId: r.department_id,
    code: r.code,
    name: r.name,
    description: r.description,
    durationMinutes: r.duration_minutes,
    dailyQuota: r.daily_quota,
    feeETB: r.fee_etb,
    processingDays: r.processing_days,
    requiredDocuments: r.required_documents ?? [],
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
