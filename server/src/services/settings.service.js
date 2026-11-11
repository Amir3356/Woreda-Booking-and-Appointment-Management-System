// System settings (Admin > Settings).
import * as settings from "../repositories/settings.repository.js";

export function createSettingsService() {
  return {
    get() {
      return settings.findOrCreate();
    },

    /** s: validated body (validations/user.validation.js). Returns the saved settings. */
    async update(s) {
      await settings.upsert(s);
      return s;
    },
  };
}
