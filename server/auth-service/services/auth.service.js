// Registration, sign-in, profile lookup and logout (API.md module 1): validation, password hashing,
// login lockout and token revocation.
import bcrypt from "bcryptjs";
import {
  ConflictError, NotFoundError, TooManyAttemptsError, UnauthorizedError, ValidationError, isDuplicateKey,
} from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { TOKEN_TTL_SECONDS, issueToken } from "../utils/token.js";
import * as users from "../repositories/user.repository.js";
import { counter } from "../config/metrics.js";

const logins = counter(
  "woreda_auth_logins_total",
  "Sign-in attempts, by result (success, failure, locked, deactivated) and role.",
  ["result", "role"],
);

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;
export const BCRYPT_COST = 10;

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
// Go's len() counts UTF-8 bytes.
const byteLen = (s) => Buffer.byteLength(s, "utf8");

// ---- validation (Go utils/validator.go) ---------------------------------------------------

/** +2519XXXXXXXX after trimming. */
export const isValidEthiopianPhone = (phone) => /^\+2519\d{8}$/.test(str(phone).trim());

/** At least 8 bytes and at least one digit, punctuation or symbol (Go unicode.IsDigit/IsPunct/IsSymbol). */
export function isStrongPassword(password) {
  const p = str(password);
  return byteLen(p) >= 8 && /[\p{Nd}\p{P}\p{S}]/u.test(p);
}

/** Validates and normalizes a registration body, as Go AuthService.Register does. */
export function validateRegistration(input) {
  const f = {
    fullName: str(input.fullName).trim(),
    email: str(input.email).trim(),
    phone: str(input.phone).trim(),
    nationalId: str(input.nationalId).trim(), // optional; the sign-up form does not ask for it
    kebele: str(input.kebele),
    houseNumber: str(input.houseNumber),
    password: str(input.password),
  };
  const v = new ValidationError();
  if (byteLen(f.fullName) < 3) v.add("fullName", "Full name is required (min 3 characters).");
  if (!isValidEthiopianPhone(f.phone)) v.add("phone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).");
  if (!f.email.includes("@")) v.add("email", "A valid email address is required.");
  if (!isStrongPassword(f.password)) v.add("password", "Password must be at least 8 characters and include a digit or symbol.");
  v.throwIfAny();
  return f;
}

export const buildAddress = (kebele, houseNumber) => `${kebele}, House ${houseNumber}`;

// ---- user JSON (Go model.User) ------------------------------------------------------------

/** The API shape of a user: no passwordHash; departmentId always present (null when unset);
 *  departmentName, counterNumber and address omitted when null (Go omitempty on pointers). */
export function toUserJSON(doc) {
  const u = {
    id: doc._id, fullName: doc.fullName, email: doc.email, phone: doc.phone, nationalId: doc.nationalId,
    role: doc.role, departmentId: doc.departmentId ?? null,
  };
  if (doc.departmentName != null) u.departmentName = doc.departmentName;
  if (doc.counterNumber != null) u.counterNumber = doc.counterNumber;
  if (doc.address != null) u.address = doc.address;
  u.isActive = Boolean(doc.isActive);
  u.createdAt = doc.createdAt;
  u.updatedAt = doc.updatedAt;
  return u;
}

// ---- service ------------------------------------------------------------------------------

/** sessions (repositories/session.repository.js) may be null, which disables revocation and lockout. */
export function createAuthService({ sessions, jwtSecret, logger }) {
  const session = (user) => ({ token: issueToken(jwtSecret, user), user });

  return {
    /** Creates a CITIZEN account and returns a session token. */
    async register(input) {
      const f = validateRegistration(input);
      const exists =
        (await users.existsByEmail(f.email)) || (f.nationalId !== "" && (await users.existsByNationalId(f.nationalId)));
      const conflict = () => new ConflictError("email or national ID already registered");
      if (exists) throw conflict();
      const id = newId("usr");
      // users.nationalId is required and unique in the shared schema: without one, store an internal
      // placeholder from the account id (as provisioned staff get "ET-EMP-...").
      const nationalId = f.nationalId || `ET-CIT-${id.slice(4)}`;
      const passwordHash = await bcrypt.hash(f.password, BCRYPT_COST);
      let doc;
      try {
        doc = await users.create({
          _id: id, fullName: f.fullName, email: f.email, phone: f.phone, nationalId,
          passwordHash, role: "CITIZEN", departmentId: null, counterNumber: null,
          address: buildAddress(f.kebele, f.houseNumber), isActive: true,
        });
      } catch (err) {
        throw isDuplicateKey(err) ? conflict() : err;
      }
      return session(toUserJSON(doc));
    },

    /** Verifies credentials for any role. Redis errors are logged and ignored so an outage never blocks sign-in. */
    async login(input) {
      const email = str(input.email).trim();
      const password = str(input.password);
      if (sessions) {
        try {
          const n = await sessions.loginFailures(email);
          if (n >= MAX_LOGIN_FAILURES) {
            logins.inc({ result: "locked", role: "unknown" });
            throw new TooManyAttemptsError(`too many failed sign-in attempts, try again in ${LOGIN_LOCKOUT_WINDOW_SECONDS / 60} minutes`);
          }
        } catch (err) {
          if (err instanceof TooManyAttemptsError) throw err;
          logger.warn({ err: err.message }, "login lockout check unavailable");
        }
      }
      const user = await users.findByEmail(email);
      const valid = user && typeof user.passwordHash === "string" && (await bcrypt.compare(password, user.passwordHash));
      if (!valid) {
        if (sessions) {
          await sessions.recordLoginFailure(email, LOGIN_LOCKOUT_WINDOW_SECONDS)
            .catch((err) => logger.warn({ err: err.message }, "record login failure"));
        }
        logins.inc({ result: "failure", role: user?.role || "unknown" });
        throw new UnauthorizedError("invalid email or password");
      }
      if (!user.isActive) {
        logins.inc({ result: "deactivated", role: user.role });
        throw new UnauthorizedError("account is deactivated");
      }
      logins.inc({ result: "success", role: user.role });
      if (sessions) {
        await sessions.clearLoginFailures(email).catch((err) => logger.warn({ err: err.message }, "clear login failures"));
      }
      return session(toUserJSON(user));
    },

    /** The profile of the signed-in user. */
    async me(userId) {
      const user = await users.findById(userId);
      if (!user) throw new NotFoundError();
      return toUserJSON(user);
    },

    /** Denylists the token's jti in Redis for the token's full lifetime; the api-gateway rejects it. */
    async logout(caller) {
      if (!sessions || !caller.tokenId) return;
      await sessions.revokeToken(caller.tokenId, TOKEN_TTL_SECONDS);
    },
  };
}
