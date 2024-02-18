import { http, tokenStorage } from "./httpClient";

// Module 1: /auth
export const authApi = {
  register: (payload) => http.post("/auth/register", payload),
  async login(credentials) {
    const res = await http.post("/auth/login", credentials);
    if (res.data?.token) tokenStorage.set(res.data.token);
    return res;
  },
  me: () => http.get("/auth/me"),
  async logout() {
    try {
      return await http.post("/auth/logout");
    } finally {
      tokenStorage.clear();
    }
  },
};
