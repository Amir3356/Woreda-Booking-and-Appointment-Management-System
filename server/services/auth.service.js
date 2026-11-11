// Registration, sign-in, profile lookup and logout: password hashing,
// login lockout and token revocation.
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError, TooManyAttemptsError, UnauthorizedError, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { TOKEN_TTL_SECONDS, issueToken } from "../utils/token.js";
import { toJSON } from "../models/user.model.js";
import * as users from "../repositories/user.repository.js";
import * as sessions from "../repositories/session.repository.js";

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;
export const BCRYPT_COST = 10;

export function createAuthService({ jwtSecret, logger }) {
  const session = (user) => ({ token: issueToken(jwtSecret, user), user });

  return {
    /** Creates a CITIZEN account and returns a session token. f: validated body (validations/auth.validation.js). */
    async register(f) {
      const conflict = () => new ConflictError("email or national ID already registered");
      if ((await users.existsByEmail(f.email)) || (f.nationalId !== "" && (await users.existsByNationalId(f.nationalId)))) {
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
          departmentId: null, counterNumber: null, address: `${f.kebele}, House ${f.houseNumber}`, isActive: true,
        });
      } catch (err) {
        throw isDuplicateKey(err) ? conflict() : err;
      }
      return session(toJSON(user));
    },

    /** Verifies credentials for any role; locks the email for 15 minutes after 5 failures. */
    async login({ email, password }) {
      if ((await sessions.loginFailures(email)) >= MAX_LOGIN_FAILURES) {
        throw new TooManyAttemptsError(`too many failed sign-in attempts, try again in ${LOGIN_LOCKOUT_WINDOW_SECONDS / 60} minutes`);
      }
      const user = await users.findByEmail(email);
      const valid = user && (await bcrypt.compare(password, user.passwordHash));
      if (!valid) {
        await sessions.recordLoginFailure(email, LOGIN_LOCKOUT_WINDOW_SECONDS)
          .catch((err) => logger.warn({ err: err.message }, "record login failure"));
        throw new UnauthorizedError("invalid email or password");
      }
      if (!user.isActive) throw new UnauthorizedError("account is deactivated");
      await sessions.clearLoginFailures(email).catch((err) => logger.warn({ err: err.message }, "clear login failures"));
      return session(toJSON(user));
    },

    /** The profile of the signed-in user. */
    async me(userId) {
      const user = await users.findById(userId);
      if (!user) throw new NotFoundError();
      return toJSON(user);
    },

    /** Revokes the token for its full lifetime; middleware/auth.js then treats it as no token. */
    async logout(caller) {
      if (caller.tokenId) await sessions.revokeToken(caller.tokenId, TOKEN_TTL_SECONDS);
    },

    /** Used by middleware/auth.js on every request carrying a token. */
    isRevoked(jti) {
      return jti ? sessions.isRevoked(jti) : false;
    },
  };
}
