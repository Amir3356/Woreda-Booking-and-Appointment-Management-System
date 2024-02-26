import { randomBytes } from "node:crypto";

/** "apt" -> "apt-7c2b063b8a1c" (prefix + 12 hex characters). */
export function newId(prefix) {
  const hex = randomBytes(6).toString("hex");
  const p = String(prefix || "").trim().replace(/-$/, "");
  return p ? `${p}-${hex}` : hex;
}
