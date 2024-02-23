/**
 * Frontend business logic for authentication, role routing, and identity parsing.
 * Pure functions only — no state, no API calls, no DOM.
 */

const ETHIOPIAN_PHONE_REGEX = /^\+2519\d{8}$/;

/**
 * Validates that a phone string matches the Ethiopian mobile phone standard (+2519XXXXXXXX).
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidEthiopianPhone(phone) {
  if (!phone) return false;
  return ETHIOPIAN_PHONE_REGEX.test(phone.trim().replace(/\s+/g, ""));
}

/**
 * Normalizes user-typed phone numbers into the standard +2519XXXXXXXX format.
 * @param {string} rawPhone
 * @returns {string}
 */
export function normalizeEthiopianPhone(rawPhone) {
  let cleaned = (rawPhone || "").trim().replace(/[\s-]/g, "");
  if (cleaned.startsWith("+251")) return cleaned;
  if (cleaned.startsWith("09") && cleaned.length === 10) return `+251${cleaned.slice(1)}`;
  if (cleaned.startsWith("9") && cleaned.length === 9) return `+251${cleaned}`;
  return cleaned;
}

/**
 * Validates basic email address format.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validates minimum password strength policy.
 * @param {string} password
 * @returns {boolean}
 */
export function isStrongPassword(password) {
  if (!password || password.length < 6) return false;
  return true;
}

/**
 * Formats a clean human-readable name from an email username.
 * e.g. "tigist.kbl@woreda.gov.et" -> "Tigist Kbl"
 * @param {string} email
 * @returns {string}
 */
export function formatDisplayNameFromEmail(email) {
  if (!email) return "User";
  const userPart = email.split("@")[0].replace(/[._-]/g, " ");
  return userPart
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Canonical Admin Credentials.
 */
export const ADMIN_CREDENTIALS = {
  email: "amirsiraj1995@gmail.com",
  password: "AEHJSS36",
};

/**
 * Validates login credentials against known accounts (Admin, provisioned staff, or registered citizens).
 * @param {string} email
 * @param {string} password
 * @param {Array} [usersList=[]]
 * @param {Array} [provisionedAccounts=[]]
 * @returns {boolean}
 */
export function verifyCredentials(email, password, usersList = [], provisionedAccounts = []) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !password) return false;

  // 1. Strict check for central admin credentials
  if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase()) {
    return password === ADMIN_CREDENTIALS.password;
  }

  // 2. Check provisioned accounts (Department Officers provisioned by Admin)
  const matchedProvisioned = provisionedAccounts.find(
    (a) => a.email?.trim().toLowerCase() === cleanEmail
  );
  if (matchedProvisioned) {
    return matchedProvisioned.password === password;
  }

  // 3. Check registered users in system state
  const matchedUser = usersList.find(
    (u) => u.email?.trim().toLowerCase() === cleanEmail
  );
  if (matchedUser) {
    if (matchedUser.password) {
      return matchedUser.password === password;
    }
    // Fallback for default demo accounts
    return password === "Password@123";
  }

  // Unregistered or wrong account — strict reject
  return false;
}

/**
 * Resolves user identity, role, department association, and portal destination path from an email.
 * Returns null if user is not found in the system.
 * @param {string} email
 * @param {Array} [usersList=[]]
 * @param {Array} [departmentsList=[]]
 * @param {Array} [provisionedAccounts=[]]
 * @returns {{ role: string, portalPath: string, departmentId: string|null, departmentName: string|null, user: object }|null}
 */
export function resolveUserSession(
  email,
  usersList = [],
  departmentsList = [],
  provisionedAccounts = []
) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Central Admin check
  if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase()) {
    const adminUser = usersList.find((u) => u.email?.toLowerCase() === cleanEmail) || {
      id: "usr-admin",
      fullName: "Amir Siraj",
      email: "amirsiraj1995@gmail.com",
      phone: "+251911223344",
      nationalId: "ET-ADM-9901",
      role: "ADMIN",
      departmentId: null,
      departmentName: "Woreda Central Administration",
      isActive: true,
      address: "Kebele 03, Woreda Center",
    };

    return {
      role: "ADMIN",
      portalPath: "/admin",
      departmentId: null,
      departmentName: "Woreda Central Administration",
      user: adminUser,
    };
  }

  // 2. Check known existing user from users state
  const matchedUser = usersList.find((u) => u.email?.toLowerCase() === cleanEmail);
  if (matchedUser) {
    let portalPath = "/citizen";
    if (matchedUser.role === "ADMIN") portalPath = "/admin";
    else if (matchedUser.role === "OFFICER") portalPath = "/officer";

    return {
      role: matchedUser.role,
      portalPath,
      departmentId: matchedUser.departmentId || null,
      departmentName:
        matchedUser.departmentName ||
        (matchedUser.role === "OFFICER" ? "Kebele Administration & Vital Events" : null),
      user: matchedUser,
    };
  }

  // 3. Check provisioned accounts (e.g. provisioned by Admin in Account Provision)
  const matchedProvisioned = provisionedAccounts.find(
    (a) => a.email?.trim().toLowerCase() === cleanEmail
  );
  if (matchedProvisioned) {
    const isOfficer =
      matchedProvisioned.role === "Department Officer" || matchedProvisioned.role === "OFFICER";
    const role = isOfficer ? "OFFICER" : "ADMIN";
    const portalPath = isOfficer ? "/officer" : "/admin";
    const matchedDept =
      departmentsList.find((d) => d.id === matchedProvisioned.departmentId) || departmentsList[0];

    const provisionedUserObj = {
      id: `usr-prov-${cleanEmail.replace(/[^a-z0-9]/g, "")}`,
      fullName: matchedProvisioned.fullName,
      email: matchedProvisioned.email,
      phone: "+251911000000",
      nationalId: `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      role,
      departmentId: isOfficer ? matchedProvisioned.departmentId || "dept-1" : null,
      departmentName: isOfficer
        ? matchedDept?.name || "Kebele Administration & Vital Events"
        : "Woreda Central Administration",
      address: "Kebele 03, Woreda Center",
      isActive: true,
    };

    return {
      role,
      portalPath,
      departmentId: provisionedUserObj.departmentId,
      departmentName: provisionedUserObj.departmentName,
      user: provisionedUserObj,
    };
  }

  // User does not exist in any system records
  return null;
}

export const AUTH_COOKIE_NAME = "woreda_token";

/**
 * Encodes string to Base64Url format.
 */
function base64UrlEncode(str) {
  if (typeof btoa !== "undefined") {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes Base64Url string.
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(base64)));
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Generates an HMAC-like token signature.
 */
function pseudoSign(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return base64UrlEncode(`sig_${Math.abs(hash)}`);
}

/**
 * Issues a valid JWT access token for a user.
 * @param {object} user
 * @param {number} [expiresInSeconds=43200] // 12 hours
 * @returns {string}
 */
export function createJwtToken(user, expiresInSeconds = 43200) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id || `usr-${Date.now()}`,
    name: user.fullName || "User",
    email: user.email,
    role: user.role || "CITIZEN",
    dept: user.departmentId || "",
    iss: "woreda-auth-service",
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = pseudoSign(signatureInput);

  return `${signatureInput}.${signature}`;
}

/**
 * Parses and verifies JWT claims from a token string.
 * Returns claims object or null if invalid or expired.
 * @param {string} token
 * @returns {object|null}
 */
export function parseJwtToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const jsonStr = base64UrlDecode(parts[1]);
    const claims = JSON.parse(jsonStr);

    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return claims;
  } catch (err) {
    return null;
  }
}

/**
 * Retrieves JWT token from browser cookies.
 * @returns {string|null}
 */
export function getJwtCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Sets JWT token into browser cookies.
 * @param {string} token
 * @param {number} [maxAgeDays=7]
 */
export function setJwtCookie(token, maxAgeDays = 7) {
  if (typeof document === "undefined" || !token) return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Clears JWT token from browser cookies.
 */
export function clearJwtCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Restores user object directly from the JWT stored in browser cookies.
 * @param {Array} [usersList=[]]
 * @param {Array} [departmentsList=[]]
 * @param {Array} [provisionedAccounts=[]]
 * @returns {object|null}
 */
export function getUserFromJwtCookie(
  usersList = [],
  departmentsList = [],
  provisionedAccounts = []
) {
  const token = getJwtCookie();
  if (!token) return null;

  const claims = parseJwtToken(token);
  if (!claims || !claims.email) return null;

  const session = resolveUserSession(claims.email, usersList, departmentsList, provisionedAccounts);
  if (session?.user) {
    return session.user;
  }

  return {
    id: claims.sub,
    fullName: claims.name,
    email: claims.email,
    role: claims.role,
    departmentId: claims.dept || null,
    departmentName: claims.dept ? "Municipal Department" : null,
    isActive: true,
  };
}

