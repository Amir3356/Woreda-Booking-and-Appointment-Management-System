// Desk queue numbering and wait estimates.
import { pad } from "./time.js";

/** Rough per-citizen wait estimate (minutes). */
export const AVG_SERVICE_MINUTES = 15;

/** Daily sequential queue token "{DEPT_CODE}-{SEQ:02d}" (e.g. "KBL-01"), as Go's GenerateQueueToken. */
export function queueToken(deptCode, seq) {
  const code = String(deptCode ?? "").trim().toUpperCase() || "WRD";
  const n = seq < 1 ? 1 : seq;
  return `${code}-${pad(n)}`;
}
