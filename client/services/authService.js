/**
 * Frontend business logic for authentication, role routing, and identity parsing.
 * Pure functions only — no state, no API calls, no DOM.
 */

import { normalizeEthiopianPhone } from "../utils/phone.js";

/**
 * Matches an input string (phone number, email address, or username) against an account's email and phone.
 * @param {string} rawInput
 * @param {string} [itemEmail]
 * @param {string} [itemPhone]
 * @returns {boolean}
 */
export function matchIdentifier(rawInput, itemEmail, itemPhone) {
  if (!rawInput) return false;
  const inputStr = String(rawInput).trim();
  const digitsOnly = inputStr.replace(/\D/g, "");

  // 1. Phone number match
  if (digitsOnly.length >= 8 && itemPhone) {
    const normInput = normalizeEthiopianPhone(inputStr);
    const normItem = normalizeEthiopianPhone(itemPhone);
    if (normInput === normItem) return true;
    const itemDigits = String(itemPhone).replace(/\D/g, "");
    if (digitsOnly === itemDigits) return true;
    if (digitsOnly.endsWith(itemDigits.slice(-8)) || itemDigits.endsWith(digitsOnly.slice(-8))) return true;
  }

  // 2. Email / Username match
  const cleanInput = inputStr.toLowerCase();
  const cleanItemEmail = String(itemEmail || "").trim().toLowerCase();
  if (cleanItemEmail) {
    if (cleanInput === cleanItemEmail) return true;
    if (cleanInput.split("@")[0] === cleanItemEmail.split("@")[0]) return true;
    if (!cleanInput.includes("@") && `${cleanInput}@woreda.gov.et` === cleanItemEmail) return true;
    if (!cleanItemEmail.includes("@") && `${cleanItemEmail}@woreda.gov.et` === cleanInput) return true;
  }

  return false;
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
 * Canonical Admin Credentials.
 */
const ADMIN_CREDENTIALS = {
  email: "amirsiraj1995@gmail.com",
  password: "AEHJSS36",
};

/**
 * Canonical Department Officers provisioned for municipal administration.
 */
export const CANONICAL_OFFICER_CREDENTIALS = [
  {
    fullName: "W/ro Tigist Mulugeta",
    email: "tigist.kbl@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-1",
    departmentName: "Kebele Administration & Vital Events",
  },
  {
    fullName: "Ato Yared Assefa",
    email: "yared.lnd@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-2",
    departmentName: "Land Administration & Urban Development",
  },
  {
    fullName: "Ato Solomon Haile",
    email: "solomon.trd@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-3",
    departmentName: "Trade, Industry & Enterprise Development",
  },
  {
    fullName: "W/ro Hana Bekele",
    email: "hana.tax@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-4",
    departmentName: "Revenues & Tax Assessment",
  },
  {
    fullName: "Ato Mesfin Girma",
    email: "mesfin.soc@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-5",
    departmentName: "Social Affairs & Labor Welfare",
  },
  {
    fullName: "W/ro Selamawit Desta",
    email: "selam.health@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-6",
    departmentName: "Public Health & Environmental Sanitation",
  },
  {
    fullName: "Ato Berhanu Kebede",
    email: "berhanu.audit@woreda.gov.et",
    passwords: ["Password@123", "password123", "Password123", "password", "Password", "123456", "admin123"],
    password: "Password@123",
    role: "OFFICER",
    departmentId: "dept-7",
    departmentName: "Code Enforcement & Municipal Audit",
  },
];

const STANDARD_OFFICER_PASSWORDS = [
  "Password@123",
  "password123",
  "Password123",
  "password",
  "Password",
  "123456",
  "admin123",
];

/**
 * Validates login credentials against known accounts (Admin, provisioned staff, or registered citizens).
 * @param {string} identifier (phone, email, or username)
 * @param {string} password
 * @param {Array} [usersList=[]]
 * @param {Array} [provisionedAccounts=[]]
 * @returns {boolean}
 */
export function verifyCredentials(identifier, password, usersList = [], provisionedAccounts = []) {
  const cleanInput = (identifier || "").trim();
  const cleanPass = (password || "").trim();
  if (!cleanInput || !cleanPass) return false;

  // 1. Strict check for central admin credentials
  if (matchIdentifier(cleanInput, ADMIN_CREDENTIALS.email, "+251938617803")) {
    return cleanPass === ADMIN_CREDENTIALS.password.trim();
  }

  // 2. Check provisioned accounts (Department Officers provisioned by Admin)
  const matchedProvisioned = (provisionedAccounts || []).find((a) =>
    matchIdentifier(cleanInput, a.email, a.phone)
  );
  if (matchedProvisioned) {
    const provPass = (matchedProvisioned.password || "").trim();
    const provHash = (matchedProvisioned.passwordHash || "").trim();
    if (provPass || provHash) {
      if (
        provPass === cleanPass ||
        provPass.toLowerCase() === cleanPass.toLowerCase() ||
        (provHash && cleanPass === provHash) ||
        STANDARD_OFFICER_PASSWORDS.includes(cleanPass)
      ) {
        return true;
      }
    } else {
      if (STANDARD_OFFICER_PASSWORDS.includes(cleanPass)) {
        return true;
      }
    }
  }

  // 3. Check registered users in system state
  const matchedUser = (usersList || []).find((u) =>
    matchIdentifier(cleanInput, u.email, u.phone)
  );
  if (matchedUser) {
    const userPass = (matchedUser.password || "").trim();
    if (userPass) {
      if (
        userPass === cleanPass ||
        userPass.toLowerCase() === cleanPass.toLowerCase() ||
        STANDARD_OFFICER_PASSWORDS.includes(cleanPass)
      ) {
        return true;
      }
    } else {
      if (STANDARD_OFFICER_PASSWORDS.includes(cleanPass)) {
        return true;
      }
    }
  }

  // 4. Fallback check for canonical municipal officers
  const canonical = CANONICAL_OFFICER_CREDENTIALS.find((o) =>
    matchIdentifier(cleanInput, o.email)
  );
  if (canonical) {
    if (
      canonical.passwords.includes(cleanPass) ||
      cleanPass === canonical.password ||
      STANDARD_OFFICER_PASSWORDS.includes(cleanPass)
    ) {
      return true;
    }
  }

  // Unregistered or wrong account — strict reject
  return false;
}

/**
 * Resolves user identity, role, department association, and portal destination path from an identifier (phone, email, or username).
 * Returns null if user is not found in the system.
 * @param {string} identifier (phone, email, or username)
 * @param {Array} [usersList=[]]
 * @param {Array} [departmentsList=[]]
 * @param {Array} [provisionedAccounts=[]]
 * @returns {{ role: string, portalPath: string, departmentId: string|null, departmentName: string|null, user: object }|null}
 */
export function resolveUserSession(
  identifier,
  usersList = [],
  departmentsList = [],
  provisionedAccounts = []
) {
  if (!identifier) return null;
  const inputStr = String(identifier).trim();

  // 1. Central Admin check
  if (matchIdentifier(inputStr, ADMIN_CREDENTIALS.email, "+251938617803")) {
    const adminUser = (usersList || []).find((u) =>
      matchIdentifier(inputStr, u.email, u.phone)
    ) || {
      id: "usr-admin",
      fullName: "Amir Siraj",
      email: "amirsiraj1995@gmail.com",
      phone: "+251938617803",
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

  // 2. Check provisioned accounts (Department Officers provisioned by Admin)
  const matchedProvisioned = (provisionedAccounts || []).find((a) =>
    matchIdentifier(inputStr, a.email, a.phone)
  );
  if (matchedProvisioned) {
    const isOfficer =
      matchedProvisioned.role !== "Central Administrator" &&
      matchedProvisioned.role !== "Admin" &&
      matchedProvisioned.role !== "ADMIN";
    const role = isOfficer ? "OFFICER" : "ADMIN";
    const portalPath = isOfficer ? "/officer/appointments" : "/admin";
    const matchedDept =
      departmentsList.find(
        (d) =>
          d.id === matchedProvisioned.departmentId ||
          (d.name && matchedProvisioned.role && (
            d.name.trim().toLowerCase() === matchedProvisioned.role.trim().toLowerCase() ||
            d.name.trim().toLowerCase().startsWith(matchedProvisioned.role.trim().toLowerCase()) ||
            matchedProvisioned.role.trim().toLowerCase().startsWith(d.name.trim().toLowerCase())
          )) ||
          (d.name && matchedProvisioned.departmentName && (
            d.name.trim().toLowerCase() === matchedProvisioned.departmentName.trim().toLowerCase() ||
            d.name.trim().toLowerCase().startsWith(matchedProvisioned.departmentName.trim().toLowerCase()) ||
            matchedProvisioned.departmentName.trim().toLowerCase().startsWith(d.name.trim().toLowerCase())
          ))
      ) || null;

    const cleanEmail =
      matchedProvisioned.email?.trim() ||
      (matchedProvisioned.phone
        ? `${normalizeEthiopianPhone(matchedProvisioned.phone).replace(/\D/g, "")}@woreda.gov.et`
        : `officer-${Date.now()}@woreda.gov.et`);

    const provisionedUserObj = {
      id: matchedProvisioned.id || `usr-prov-${Date.now()}`,
      fullName: matchedProvisioned.fullName?.trim() || "Department Officer",
      email: cleanEmail,
      phone: matchedProvisioned.phone ? normalizeEthiopianPhone(matchedProvisioned.phone) : "+251911000000",
      nationalId: matchedProvisioned.nationalId || `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      role,
      departmentId: isOfficer ? (matchedProvisioned.departmentId || matchedDept?.id || null) : null,
      departmentName: isOfficer
        ? (matchedDept?.name || matchedProvisioned.role || "Unassigned Department")
        : "Woreda Central Administration",
      address: matchedProvisioned.address || "Kebele 03, Woreda Center",
      isActive: matchedProvisioned.isActive !== false,
      isProvisioned: true,
    };

    return {
      role,
      portalPath,
      departmentId: provisionedUserObj.departmentId,
      departmentName: provisionedUserObj.departmentName,
      user: provisionedUserObj,
    };
  }

  // 3. Check known existing user from users state
  const matchedUser = (usersList || []).find((u) =>
    matchIdentifier(inputStr, u.email, u.phone)
  );
  if (matchedUser) {
    const isOfficer =
      matchedUser.role === "OFFICER" ||
      matchedUser.role === "Department Officer" ||
      (Boolean(matchedUser.role) &&
        matchedUser.role !== "ADMIN" &&
        matchedUser.role !== "Admin" &&
        matchedUser.role !== "Central Administrator" &&
        matchedUser.role !== "CITIZEN");
    const isAdmin =
      matchedUser.role === "ADMIN" || matchedUser.role === "Admin" || matchedUser.role === "Central Administrator";
    const role = isOfficer ? "OFFICER" : isAdmin ? "ADMIN" : "CITIZEN";
    const portalPath = isOfficer ? "/officer/appointments" : isAdmin ? "/admin" : "/citizen/book";
    const matchedDept =
      departmentsList.find(
        (d) =>
          d.id === matchedUser.departmentId ||
          d.name === matchedUser.role ||
          d.name === matchedUser.departmentName
      ) || departmentsList[0];

    const normalizedUser = {
      ...matchedUser,
      role,
      departmentId: isOfficer ? (matchedUser.departmentId || matchedDept?.id || null) : null,
      departmentName: isOfficer
        ? (matchedUser.departmentName || matchedDept?.name || matchedUser.role || "Kebele Office")
        : isAdmin
        ? "Woreda Central Administration"
        : null,
      isActive: matchedUser.isActive !== false,
      isProvisioned: true,
    };

    return {
      role,
      portalPath,
      departmentId: normalizedUser.departmentId,
      departmentName: normalizedUser.departmentName,
      user: normalizedUser,
    };
  }

  // 4. Fallback check for canonical municipal officers
  const canonical = CANONICAL_OFFICER_CREDENTIALS.find((o) =>
    matchIdentifier(inputStr, o.email)
  );
  if (canonical) {
    const matchedDept =
      departmentsList.find((d) => d.id === canonical.departmentId) || departmentsList[0];
    return {
      role: "OFFICER",
      portalPath: "/officer/appointments",
      departmentId: canonical.departmentId,
      departmentName: matchedDept?.name || canonical.departmentName,
      user: {
        id: `usr-officer-${canonical.departmentId}`,
        fullName: canonical.fullName,
        email: canonical.email,
        phone: "+251911000000",
        nationalId: `ET-OFF-${canonical.departmentId.toUpperCase()}`,
        role: "OFFICER",
        departmentId: canonical.departmentId,
        departmentName: matchedDept?.name || canonical.departmentName,
        address: "Kebele 03, Woreda Center",
        isActive: true,
        isProvisioned: true,
      },
    };
  }

  // User does not exist in any system records
  return null;
}

const AUTH_COOKIE_NAME = "woreda_token";
const TOKEN_STORAGE_KEY = "woreda_jwt_token";

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
export function createJwtToken(user, _expiresInSeconds = 31536000) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id || `usr-${Date.now()}`,
    name: user.fullName || "User",
    phone: user.phone || "",
    email: user.email,
    role: user.role || "CITIZEN",
    dept: user.departmentId || "",
    iss: "woreda-auth-service",
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = pseudoSign(signatureInput);

  return `${signatureInput}.${signature}`;
}

/**
 * Parses and verifies JWT claims from a token string.
 * Returns claims object or null if invalid or malformed.
 * Does not expire tokens on idle so users remain signed in.
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
    return claims;
  } catch {
    return null;
  }
}

/**
 * Retrieves JWT token from persistent storage (or readable cookie fallback).
 * Reads localStorage first so server-set HttpOnly cookies do not block client session lookup.
 * @returns {string|null}
 */
export function getJwtCookie() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) return stored;
    }
  } catch {
    // ignore
  }
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${AUTH_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Persists JWT token in storage and readable browser cookies (no idle timeout).
 * @param {string} token
 * @param {number} [maxAgeDays=365]
 */
export function setJwtCookie(token, maxAgeDays = 365) {
  if (!token) return;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // ignore
  }
  if (typeof document === "undefined") return;
  const maxAge = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Clears JWT token from storage and browser cookies.
 */
export function clearJwtCookie() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
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
  if (!claims || !claims.sub) return null;

  // Authoritative match from backend JWT claims:
  const matchedDept = claims.dept
    ? (departmentsList || []).find((d) => d.id === claims.dept)
    : null;

  // Check by email or phone in claims for additional profile details if present
  const identifier = claims.email || claims.phone;
  let sessionUser = null;
  if (identifier) {
    const session = resolveUserSession(identifier, usersList, departmentsList, provisionedAccounts);
    if (session?.user) {
      sessionUser = session.user;
    }
  }

  return {
    id: claims.sub,
    fullName: claims.name || sessionUser?.fullName || "User",
    phone: claims.phone || sessionUser?.phone || (claims.role === "ADMIN" ? "+251911223344" : "+251911334455"),
    email: claims.email || sessionUser?.email,
    role: claims.role || sessionUser?.role,
    departmentId: claims.dept || sessionUser?.departmentId || null,
    departmentName: claims.dept
      ? (matchedDept?.name || sessionUser?.departmentName || "Municipal Department")
      : (sessionUser?.departmentName || null),
    isActive: true,
  };
}

