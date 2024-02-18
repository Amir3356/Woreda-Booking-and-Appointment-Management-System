// Frontend business logic for the counter queue.

/** Builds a queue token like KBL-03 from the department code and its current queue length. */
export function generateTokenNumber(departmentCode = "KBL", currentQueueLength = 0) {
  const position = currentQueueLength + 1;
  return `${departmentCode}-${position.toString().padStart(2, "0")}`;
}

/** Current local time as HH:MM, used for check-in / called timestamps on the queue board. */
export function currentClockTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
