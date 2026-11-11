// Registration, sign-in, profile lookup and logout: password hashing,
// login lockout and token revocation.
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError, TooManyAttemptsError, UnauthorizedError, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { TOKEN_TTL_SECONDS, issueToken } from "../utils/token.js";
import { toJSON } from "../models/user.model.js";
import * as users from "../repositories/user.repository.js";
import * as sessions from "../repositories/session.repository.js";

const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;
const BCRYPT_COST = 10;

/** "Kebele 05, Woreda 03, Addis Ababa" (+ ", House 123" when a house number is given). */
function residentialAddress({ kebele, woreda, location, houseNumber }) {
  return [kebele, woreda, location, houseNumber ? `House ${houseNumber}` : ""].filter(Boolean).join(", ");
}

export function createAuthService({ jwtSecret, logger, events }) {
  const session = (user) => ({ token: issueToken(jwtSecret, user), user });

  return {
    /** Creates a CITIZEN account and returns a session token. f: validated body (validations/auth.validation.js). */
    async register(f) {
      const conflict = () => new ConflictError("phone number, email or national ID already registered");
      if (
        (await users.existsByPhone(f.phone))
        || (f.email !== null && (await users.existsByEmail(f.email)))
        || (f.nationalId !== "" && (await users.existsByNationalId(f.nationalId)))
      ) {
        throw conflict();
      }
      const id = newId("usr");
      // national_id is required and unique: without one, store an internal placeholder from the account id.
      const nationalId = f.nationalId || `ET-CIT-${id.slice(4)}`;
      const passwordHash = await bcrypt.hash(f.password, BCRYPT_COST);
      let user;
      try {
        user = await users.create({
          id, fullName: f.fullName, email: f.email, phone: f.phone, nationalId, passwordHash, role: "CITIZEN",
          departmentId: null, counterNumber: null, address: residentialAddress(f), isActive: true,
        });
      } catch (err) {
        throw isDuplicateKey(err) ? conflict() : err;
      }
      const userData = toJSON(user);
      events?.publish("citizen.registered", user.id, userData);
      return session(userData);
    },

    /**
     * Verifies credentials for any role: staff by email, citizens by phone number.
     * Locks that email or phone for 15 minutes after 5 failures.
     */
    async login({ email, phone, password }) {
      const identifier = email ?? phone;
      if ((await sessions.loginFailures(identifier)) >= MAX_LOGIN_FAILURES) {
        throw new TooManyAttemptsError(`too many failed sign-in attempts, try again in ${LOGIN_LOCKOUT_WINDOW_SECONDS / 60} minutes`);
      }
      const hasEmail = email != null && email !== "";
      const user = hasEmail ? await users.findByEmail(email) : await users.findByPhone(phone);
      const valid = user && (await bcrypt.compare(password, user.passwordHash));
      if (!valid) {
        await sessions.recordLoginFailure(identifier, LOGIN_LOCKOUT_WINDOW_SECONDS)
          .catch((err) => logger.warn({ err: err.message }, "record login failure"));
        throw new UnauthorizedError(hasEmail ? "invalid email or password" : "invalid phone number or password");
      }
      if (!user.isActive) throw new UnauthorizedError("account is deactivated");
      await sessions.clearLoginFailures(identifier).catch((err) => logger.warn({ err: err.message }, "clear login failures"));
      return session(toJSON(user));
    },

    /** The profile of the signed-in user. */
    async me(userId) {
      const user = await users.findById(userId);
      if (!user) throw new NotFoundError();
      return toJSON(user);
    },

    /** Revokes the token for its full lifetime; middleware/jwt.js then treats it as no token. */
    async logout(caller) {
      if (caller.tokenId) await sessions.revokeToken(caller.tokenId, TOKEN_TTL_SECONDS);
    },

    /** Used by middleware/jwt.js on every request carrying a token. */
    isRevoked(jti) {
      return jti ? sessions.isRevoked(jti) : false;
    },
  };
}
