// Citizen profile rules: Go-style decoding, field validation and the unique email/national ID.
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { byteLen, decodeStruct } from "../utils/decode.js";
import * as users from "../repositories/user.repository.js";

const ETHIOPIAN_PHONE = /^\+2519\d{8}$/;
const DUPLICATE = "email or national ID already registered";

export const isValidEthiopianPhone = (phone) => ETHIOPIAN_PHONE.test(String(phone).trim());

export const decodeProfile = (input) =>
  decodeStruct(input, "CitizenProfile", { fullName: "string", phone: "string", email: "string", nationalId: "string", address: "string" });

/** Trims and validates a profile update; returns the profile to save and echo back. */
export function validateProfile(p) {
  const out = { ...p, fullName: p.fullName.trim(), phone: p.phone.trim(), address: p.address.trim() };
  const v = new ValidationError();
  if (byteLen(out.fullName) < 3) v.add("fullName", "Full name is required (min 3 characters).");
  if (!isValidEthiopianPhone(out.phone)) v.add("phone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).");
  v.throwIfAny();
  return out;
}

export function createProfileService() {
  return {
    async get(userId) {
      const u = await users.findCitizen(userId);
      if (!u) throw new NotFoundError();
      return { fullName: u.fullName, phone: u.phone, email: u.email, nationalId: u.nationalId, address: u.address ?? "" };
    },

    /** input: the JSON request body. */
    async update(userId, input) {
      const p = validateProfile(decodeProfile(input));
      const found = await users
        .updateCitizen(userId, { fullName: p.fullName, phone: p.phone, email: p.email, nationalId: p.nationalId, address: p.address })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError(DUPLICATE) : err;
        });
      if (!found) throw new NotFoundError();
      return p;
    },
  };
}
