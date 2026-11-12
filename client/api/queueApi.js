import { http } from "./httpClient";

// Module 7: /queue
export const queueApi = {
  /** Citizen: own place in today's queue (token, position, citizens ahead, now serving). */
  mine: () => http.get("/queue/me"),
  verifyCheckIn: (payload) => http.post("/queue/verify-checkin", payload),
  board: (params) => http.get("/queue", params),
  callNext: (payload) => http.post("/queue/call-next", payload),
  /** status: "COMPLETED" | "NO_SHOW" */
  finalize: (id, status) => http.patch(`/queue/${id}/status`, { status }),
};
