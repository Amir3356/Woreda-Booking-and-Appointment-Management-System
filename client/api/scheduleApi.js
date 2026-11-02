import { http } from "./httpClient";

// Module 5: /schedules
export const scheduleApi = {
  list: (params) => http.get("/schedules", params),
  create: (payload) => http.post("/schedules", payload),
  /** @param {{ serviceId: string, date: string }} params */
  availability: (params) => http.get("/schedules/availability", params),
};
