// Citizen profile: read and update with the unique email/national ID.
import { ConflictError, NotFoundError, isDuplicateKey } from "../utils/errors.js";
import * as users from "../repositories/user.repository.js";

export function createProfileService() {
  return {
    async get(userId) {
      const u = await users.findCitizen(userId);
      if (!u) throw new NotFoundError();
      return { fullName: u.fullName, phone: u.phone, email: u.email, nationalId: u.nationalId, address: u.address ?? "" };
    },

    /** p: validated body (validations/user.validation.js). */
    async update(userId, p) {
      const found = await users.updateCitizen(userId, p).catch((err) => {
        throw isDuplicateKey(err) ? new ConflictError("email or national ID already registered") : err;
      });
      if (!found) throw new NotFoundError();
      return p;
    },
  };
}
