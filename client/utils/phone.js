/** "+251 911 234 567", "0911234567", "911234567" or "11234567" -> "+251911234567" (the server's format). */
export function normalizeEthiopianPhone(value) {
  const digits = String(value || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+251")) return digits;
  if (digits.startsWith("251")) return `+${digits}`;
  if (digits.startsWith("09")) return `+251${digits.slice(1)}`;
  if (digits.startsWith("9")) return `+251${digits}`;
  if (/^\d{8}$/.test(digits)) return `+2519${digits}`;
  return digits;
}
