import { randomBytes } from "node:crypto";

/** "srv" -> "srv-7c2b063b8a1c" (prefix + 12 hex characters). */
export function newId(prefix) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}
