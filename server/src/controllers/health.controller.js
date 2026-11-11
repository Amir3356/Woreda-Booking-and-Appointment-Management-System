// GET /healthz: the server is up and the database answers.
import { pool } from "../config/database.js";
import { fail } from "../utils/response.js";

export function createHealthController() {
  return {
    async check(req, res) {
      try {
        await pool.query("SELECT 1");
        res.status(200).json({ success: true, service: "woreda-server", status: "healthy" });
      } catch {
        fail(res, req, 503, "SERVICE_UNAVAILABLE", "Database is not reachable.");
      }
    },
  };
}
