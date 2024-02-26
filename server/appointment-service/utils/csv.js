// Appointment report CSV, written like Go's encoding/csv (no I/O).

function csvField(field) {
  const needsQuotes = field !== "" && (field === "\\." || /[",\r\n]/.test(field) || /^\s/u.test(field));
  return needsQuotes ? `"${field.replaceAll('"', '""')}"` : field;
}

export const CSV_HEADER = ["Reference", "Citizen", "Phone", "Department", "Service", "Date", "Time Slot", "Status"];

export function appointmentsCsv(list) {
  const rows = [CSV_HEADER, ...list.map((a) => [
    a.referenceNumber, a.citizenName, a.citizenPhone, a.departmentName, a.serviceName, a.date, a.timeSlot, a.status,
  ])];
  return rows.map((r) => r.map((f) => csvField(String(f ?? ""))).join(",") + "\n").join("");
}
