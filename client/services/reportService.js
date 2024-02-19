/**
 * Frontend business logic for reporting, metrics aggregation, and data export.
 * Pure functions only — no state, no API calls, no DOM.
 */

/**
 * Aggregates high-level system metrics for administrative dashboards.
 * @param {Array} appointments
 * @param {Array} users
 * @param {Array} departments
 * @returns {Object} Metric counts
 */
export function calculateDashboardMetrics(appointments = [], users = [], departments = []) {
  const citizens = users.filter((u) => u.role === "CITIZEN");
  const officers = users.filter((u) => u.role === "OFFICER");

  return {
    totalAppointments: appointments.length,
    pending: appointments.filter((a) => a.status === "PENDING").length,
    approved: appointments.filter((a) => a.status === "APPROVED").length,
    completed: appointments.filter((a) => a.status === "COMPLETED").length,
    rejected: appointments.filter((a) => a.status === "REJECTED").length,
    cancelled: appointments.filter((a) => a.status === "CANCELLED").length,
    totalCitizens: citizens.length,
    totalOfficers: officers.length,
    totalDepartments: departments.length,
  };
}

/**
 * Calculates appointment status distribution percentages for charts.
 * @param {Array} appointments
 * @returns {Array<{ name: string, value: number, color: string }>}
 */
export function calculateStatusDistribution(appointments = []) {
  const total = appointments.length || 1;
  const counts = {
    APPROVED: appointments.filter((a) => a.status === "APPROVED").length,
    PENDING: appointments.filter((a) => a.status === "PENDING").length,
    COMPLETED: appointments.filter((a) => a.status === "COMPLETED").length,
    REJECTED: appointments.filter((a) => a.status === "REJECTED").length,
  };

  return [
    { name: "Approved", value: counts.APPROVED, color: "#10b981" },
    { name: "Pending", value: counts.PENDING, color: "#f59e0b" },
    { name: "Completed", value: counts.COMPLETED, color: "#3b82f6" },
    { name: "Rejected", value: counts.REJECTED, color: "#ef4444" },
  ];
}

/**
 * Aggregates appointment count by department for volume charts.
 * @param {Array} appointments
 * @param {Array} departments
 * @returns {Array<{ department: string, count: number }>}
 */
export function calculateDepartmentVolume(appointments = [], departments = []) {
  return departments.map((dept) => {
    const count = appointments.filter((a) => a.departmentId === dept.id).length;
    return {
      department: dept.code || dept.name,
      fullName: dept.name,
      count,
    };
  });
}

/**
 * Generates CSV string from an array of appointments for client-side download.
 * @param {Array} appointments
 * @returns {string} CSV formatted content
 */
export function generateAppointmentsCSV(appointments = []) {
  const headers = [
    "Reference Number",
    "Citizen Name",
    "Citizen Phone",
    "Citizen Email",
    "Department",
    "Service",
    "Date",
    "Time Slot",
    "Status",
    "Token Number",
  ];

  const rows = appointments.map((a) => [
    `"${a.referenceNumber || ""}"`,
    `"${a.citizenName || ""}"`,
    `"${a.citizenPhone || ""}"`,
    `"${a.citizenEmail || ""}"`,
    `"${a.departmentName || ""}"`,
    `"${a.serviceName || ""}"`,
    `"${a.date || ""}"`,
    `"${a.timeSlot || ""}"`,
    `"${a.status || ""}"`,
    `"${a.tokenNumber || ""}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
