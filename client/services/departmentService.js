/**
 * Frontend business logic for departments and municipal service catalogs.
 * Pure functions only — no state, no API calls, no DOM.
 */

/**
 * Filters the active services that belong to a specific department.
 * @param {Array} services - Complete list of services
 * @param {string} departmentId - Department identifier
 * @param {boolean} [activeOnly=true] - Whether to filter for active services only
 * @returns {Array} Services belonging to the department
 */
export function getDepartmentServices(services = [], departmentId, activeOnly = true) {
  if (!departmentId) return [];
  return services.filter((s) => {
    const matchesDept = s.departmentId === departmentId;
    return activeOnly ? matchesDept && s.isActive : matchesDept;
  });
}

/**
 * Searches and filters services across name, code, description, and requirements.
 * @param {Array} services
 * @param {string} query
 * @param {string} [departmentFilter="ALL"]
 * @returns {Array} Filtered list of services
 */
export function searchServices(services = [], query = "", departmentFilter = "ALL") {
  const q = query.trim().toLowerCase();

  return services.filter((s) => {
    const matchesDept =
      departmentFilter === "ALL" || s.departmentId === departmentFilter;

    if (!q) return matchesDept;

    const matchesQuery =
      s.name?.toLowerCase().includes(q) ||
      s.code?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q);

    return matchesDept && matchesQuery;
  });
}

/**
 * Calculates total daily appointment quota for a department across its services.
 * @param {Array} services
 * @param {string} departmentId
 * @returns {number} Sum of daily quotas
 */
export function calculateDepartmentDailyCapacity(services = [], departmentId) {
  const deptServices = getDepartmentServices(services, departmentId, true);
  return deptServices.reduce((sum, s) => sum + (s.dailyQuota || 40), 0);
}

