// Registration, sign-in, profile lookup and logout (API.md module 1).
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import {
  ConflictError, NotFoundError, TooManyAttemptsError, UnauthorizedError, ValidationError, isDuplicateKey, newId,
} from "./lib/index.js";
import { User } from "./models.js";

export const TOKEN_TTL_SECONDS = 12 * 3600;
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCKOUT_WINDOW_SECONDS = 15 * 60;
export const BCRYPT_COST = 10;
export const ISSUER = "woreda-auth-service";

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
// Go's len() counts UTF-8 bytes.
const byteLen = (s) => Buffer.byteLength(s, "utf8");
const caseInsensitive = { locale: "en", strength: 2 };

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
    nationalId: str(input.nationalId),
    kebele: str(input.kebele),
    houseNumber: str(input.houseNumber),
    password: str(input.password),
  };
  const v = new ValidationError();
  if (byteLen(f.fullName) < 3) v.add("fullName", "Full name is required (min 3 characters).");
  if (!isValidEthiopianPhone(f.phone)) v.add("phone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).");
  if (!f.email.includes("@")) v.add("email", "A valid email address is required.");
  if (!f.nationalId.trim()) v.add("nationalId", "National ID is required.");
  if (!isStrongPassword(f.password)) v.add("password", "Password must be at least 8 characters and include a digit or symbol.");
  v.throwIfAny();
  return f;
}

export const buildAddress = (kebele, houseNumber) => `${kebele}, House ${houseNumber}`;

// ---- tokens (Go service/token.go) ---------------------------------------------------------

/** HS256 JWT with name, role, dept (omitted when empty), iss, sub, iat, exp (+12h) and a 16-hex jti. */
export function issueToken(secret, user, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const claims = { name: user.fullName, role: user.role };
  if (user.departmentId) claims.dept = user.departmentId;
  Object.assign(claims, {
    iss: ISSUER, sub: user.id, exp: iat + TOKEN_TTL_SECONDS, iat, jti: randomBytes(8).toString("hex"),
  });
  return jwt.sign(claims, secret, { algorithm: "HS256" }); // keeps the iat given in claims
}

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

export class AuthService {
  /** sessions may be null, which disables revocation and lockout. */
  constructor({ sessions, jwtSecret, logger }) {
    this.sessions = sessions;
    this.secret = jwtSecret;
    this.logger = logger;
  }

  /** Creates a CITIZEN account and returns a session token. */
  async register(input) {
    const f = validateRegistration(input);
    // Email compares case-insensitively (Go: LOWER(email) = LOWER($1)), national ID exactly.
    const exists = (await User.exists({ email: f.email }).collation(caseInsensitive)) || (await User.exists({ nationalId: f.nationalId }));
    const conflict = () => new ConflictError("email or national ID already registered");
    if (exists) throw conflict();
    const passwordHash = await bcrypt.hash(f.password, BCRYPT_COST);
    let doc;
    try {
      doc = await User.create({
        _id: newId("usr"), fullName: f.fullName, email: f.email, phone: f.phone, nationalId: f.nationalId,
        passwordHash, role: "CITIZEN", departmentId: null, counterNumber: null,
        address: buildAddress(f.kebele, f.houseNumber), isActive: true,
      });
    } catch (err) {
      throw isDuplicateKey(err) ? conflict() : err;
    }
    return this.#session(toUserJSON(doc.toObject()));
  }

  /** Verifies credentials for any role. Redis errors are logged and ignored so an outage never blocks sign-in. */
  async login(input) {
    const email = str(input.email).trim();
    const password = str(input.password);
    if (this.sessions) {
      try {
        const n = await this.sessions.loginFailures(email);
        if (n >= MAX_LOGIN_FAILURES) {
          throw new TooManyAttemptsError(`too many failed sign-in attempts, try again in ${LOGIN_LOCKOUT_WINDOW_SECONDS / 60} minutes`);
        }
      } catch (err) {
        if (err instanceof TooManyAttemptsError) throw err;
        this.logger.warn({ err: err.message }, "login lockout check unavailable");
      }
    }
    const user = await findUser({ email }, true);
    const valid = user && typeof user.passwordHash === "string" && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) {
      if (this.sessions) {
        await this.sessions.recordLoginFailure(email, LOGIN_LOCKOUT_WINDOW_SECONDS)
          .catch((err) => this.logger.warn({ err: err.message }, "record login failure"));
      }
      throw new UnauthorizedError("invalid email or password");
    }
    if (!user.isActive) throw new UnauthorizedError("account is deactivated");
    if (this.sessions) {
      await this.sessions.clearLoginFailures(email).catch((err) => this.logger.warn({ err: err.message }, "clear login failures"));
    }
    return this.#session(toUserJSON(user));
  }

  /** The profile of the signed-in user. */
  async me(userId) {
    const user = await findUser({ _id: userId }, false);
    if (!user) throw new NotFoundError();
    return toUserJSON(user);
  }

  /** Denylists the token's jti in Redis for the token's full lifetime; the api-gateway rejects it. */
  async logout(caller) {
    if (!this.sessions || !caller.tokenId) return;
    await this.sessions.revokeToken(caller.tokenId, TOKEN_TTL_SECONDS);
  }

  #session(user) {
    return { token: issueToken(this.secret, user), user };
  }
}

/** One user with departmentName joined from departments (Go: LEFT JOIN departments). */
async function findUser(match, ignoreCase) {
  const pipeline = [
    { $match: match },
    { $limit: 1 },
    { $lookup: { from: "departments", localField: "departmentId", foreignField: "_id", as: "dept", pipeline: [{ $project: { name: 1 } }] } },
    { $set: { departmentName: { $ifNull: [{ $first: "$dept.name" }, null] } } },
    { $project: { dept: 0 } },
  ];
  const agg = mongoose.connection.collection("users").aggregate(pipeline, ignoreCase ? { collation: caseInsensitive } : {});
  const [user] = await agg.toArray();
  return user ?? null;
}
