/**
 * Frontend business logic for the in-person counter queue.
 * Pure functions only — no state, no API calls, no DOM.
 */

/**
 * Builds a sequential queue token like KBL-03 from the department code and position.
 * @param {string} departmentCode - Department acronym (e.g. "KBL", "LND")
 * @param {number} currentQueueLength - Number of citizens currently in queue today
 * @returns {string} Formatted token (e.g. "KBL-01")
 */
export function generateTokenNumber(departmentCode = "KBL", currentQueueLength = 0) {
  const position = Math.max(1, currentQueueLength + 1);
  const code = (departmentCode || "WRD").toUpperCase().trim();
  return `${code}-${position.toString().padStart(2, "0")}`;
}

/**
 * Returns the current local time formatted as "HH:MM", used for timestamps on queue slips and boards.
 * @returns {string} e.g. "09:30"
 */
export function currentClockTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Estimates remaining wait time in minutes based on queue position and average desk time.
 * @param {number} position - Citizen's index in the waiting list (0-based or 1-based)
 * @param {number} [avgMinutesPerCitizen=15] - Estimated service duration per counter
 * @returns {number} Estimated wait duration in minutes
 */
export function estimateWaitTime(position = 0, avgMinutesPerCitizen = 15) {
  const count = Math.max(0, position);
  return count * avgMinutesPerCitizen;
}

/**
 * Filters the active queue for citizens currently in WAITING status for a department.
 * @param {Array} queue - List of queue items
 * @param {string} [departmentId] - Optional department filter
 * @returns {Array} Waiting queue items
 */
export function filterWaitingQueue(queue = [], departmentId) {
  return queue.filter((item) => {
    const matchesDept = !departmentId || item.departmentId === departmentId;
    return matchesDept && item.status === "WAITING";
  });
}

/**
 * Filters the active queue for citizens currently being SERVED at a counter desk.
 * @param {Array} queue - List of queue items
 * @param {string} [departmentId] - Optional department filter
 * @returns {Array} Serving queue items
 */
export function filterServingQueue(queue = [], departmentId) {
  return queue.filter((item) => {
    const matchesDept = !departmentId || item.departmentId === departmentId;
    return matchesDept && item.status === "SERVING";
  });
}
