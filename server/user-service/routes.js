// /api/v1/citizen/profile, /api/v1/admin/users and /api/v1/admin/settings (API.md modules 2 and 8).
import { Router, body, ok, requireRole, timestamp } from "./lib/index.js";
import { decodeProfile, decodeProvision, decodeSettings } from "./validation.js";

export function userRoutes(users) {
  const r = Router();
  const citizen = requireRole("CITIZEN");
  const admin = requireRole("ADMIN");

  r.get("/api/v1/citizen/profile", citizen, async (req, res) => {
    ok(res, 200, "Profile retrieved successfully.", await users.profile(req.caller.userId));
  });
  r.put("/api/v1/citizen/profile", citizen, async (req, res) => {
    const p = await users.updateProfile(req.caller.userId, decodeProfile(body(req)));
    ok(res, 200, "Profile updated successfully.", p);
  });

  r.get("/api/v1/admin/users", admin, async (req, res) => {
    const { items, cursor } = await users.listStaff(req.query.search, req.query.cursor, req.query.pageSize);
    // OKWithMeta: meta is {cursor, timestamp} (no "version"), as in the Go controller.
    res.status(200).json({
      success: true, message: "Accounts retrieved successfully.", data: items, meta: { cursor, timestamp: timestamp() },
    });
  });
  r.post("/api/v1/admin/users/provision", admin, async (req, res) => {
    const id = await users.provision(decodeProvision(body(req)));
    ok(res, 201, "Staff account provisioned successfully.", { id });
  });
  r.patch("/api/v1/admin/users/:id/status", admin, async (req, res) => {
    ok(res, 200, "Account status updated.", { id: req.params.id, isActive: await users.toggleStaffStatus(req.params.id) });
  });
  r.delete("/api/v1/admin/users/:id", admin, async (req, res) => {
    await users.deleteStaff(req.params.id);
    ok(res, 200, "Account deleted.", null);
  });

  r.get("/api/v1/admin/settings", admin, async (_req, res) => {
    ok(res, 200, "Settings retrieved successfully.", await users.settings());
  });
  r.put("/api/v1/admin/settings", admin, async (req, res) => {
    ok(res, 200, "Settings updated successfully.", await users.updateSettings(decodeSettings(body(req))));
  });

  return r;
}
