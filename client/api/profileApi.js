import { http } from "./httpClient";

// Module 2: /citizen/profile
export const profileApi = {
  get: () => http.get("/citizen/profile"),
  update: (payload) => http.put("/citizen/profile", payload),
};
