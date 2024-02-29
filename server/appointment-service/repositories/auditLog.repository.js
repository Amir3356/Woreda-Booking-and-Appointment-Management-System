// Data access for audit_logs.
import { AuditLog } from "../models/auditLog.model.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const create = (doc) => AuditLog.create(doc);

/** Newest first; filters: action, departmentId, search (officer, citizen, reference, service). */
export async function findPage({ action, departmentId, search }, { page, limit }) {
  const q = {};
  if (action) q.action = action;
  if (departmentId) q.departmentId = departmentId;
  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    q.$or = [{ actorName: re }, { citizenName: re }, { referenceNumber: re }, { serviceName: re }, { departmentName: re }];
  }
  const [docs, total] = await Promise.all([
    AuditLog.find(q).sort({ at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(q),
  ]);
  return { docs, total };
}
