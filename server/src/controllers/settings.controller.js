// /api/v1/admin/settings.
import { ok } from "../utils/response.js";

export function createSettingsController(settingsService) {
  return {
    async get(_req, res) {
      ok(res, 200, "Settings retrieved successfully.", await settingsService.get());
    },
    async update(req, res) {
      ok(res, 200, "Settings updated successfully.", await settingsService.update(req.body));
    },
  };
}
