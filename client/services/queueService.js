/**
 * Frontend business logic for the in-person counter queue.
 * Pure functions only — no state, no API calls, no DOM.
 */

/**
 * Returns the current local time formatted as "HH:MM", used for timestamps on queue slips and boards.
 * @returns {string} e.g. "09:30"
 */
export function currentClockTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
