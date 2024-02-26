// HTTP handlers for /api/v1/citizen/profile: read the request, call the service, send the envelope.
import { body, ok } from "../utils/response.js";

export function createProfileController(profileService) {
  return {
    async get(req, res) {
      ok(res, 200, "Profile retrieved successfully.", await profileService.get(req.caller.userId));
    },
    async update(req, res) {
      ok(res, 200, "Profile updated successfully.", await profileService.update(req.caller.userId, body(req)));
    },
  };
}
