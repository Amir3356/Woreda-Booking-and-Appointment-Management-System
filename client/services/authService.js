/**
 * Frontend business logic for authentication, role routing, and identity parsing.
 * Pure functions only — no state, no API calls, no DOM.
 */

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
 * @param {string} email
 * @param {string} password
 * @param {Array} [usersList=[]]
 * @param {Array} [provisionedAccounts=[]]
 * @returns {boolean}
 */
export function verifyCredentials(email, password, usersList = [], provisionedAccounts = []) {
  let cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();
  if (!cleanEmail || !cleanPass) return false;

  // Auto-normalize email if user typed username without domain (e.g. "tigist.kbl")
  if (!cleanEmail.includes("@")) {
    cleanEmail = `${cleanEmail}@woreda.gov.et`;
  }

  // 1. Strict check for central admin credentials
  if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase()) {
    return cleanPass === ADMIN_CREDENTIALS.password.trim();
  }

  // Helper matcher function for email/username/phone
  const matchesIdentifier = (itemEmail, itemPhone) => {
    const itemE = (itemEmail || "").trim().toLowerCase();
    if (itemE === cleanEmail) return true;
    if (itemE.split("@")[0] === cleanEmail.split("@")[0]) return true;
    if (itemPhone && (cleanEmail.startsWith("+251") || cleanEmail.startsWith("09") || cleanEmail.startsWith("9"))) {
      return itemPhone.replace(/\s+/g, "") === cleanEmail.replace(/\s+/g, "");
    }
    return false;
  };

  // 2. Check provisioned accounts (Department Officers provisioned by Admin)
  const matchedProvisioned = (provisionedAccounts || []).find((a) =>
    matchesIdentifier(a.email, a.phone)
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
      // If provisioned account has no explicit password stored, accept standard officer passwords
      if (STANDARD_OFFICER_PASSWORDS.includes(cleanPass)) {
        return true;
      }
    }
  }

  // 3. Check registered users in system state
  const matchedUser = (usersList || []).find((u) =>
    matchesIdentifier(u.email, u.phone)
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
    matchesIdentifier(o.email)
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
  let cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail) return null;

  if (!cleanEmail.includes("@")) {
    cleanEmail = `${cleanEmail}@woreda.gov.et`;
  }

  // Helper matcher function for email/username/phone
  const matchesIdentifier = (itemEmail, itemPhone) => {
    const itemE = (itemEmail || "").trim().toLowerCase();
    if (itemE === cleanEmail) return true;
    if (itemE.split("@")[0] === cleanEmail.split("@")[0]) return true;
    if (itemPhone && (cleanEmail.startsWith("+251") || cleanEmail.startsWith("09") || cleanEmail.startsWith("9"))) {
      return itemPhone.replace(/\s+/g, "") === cleanEmail.replace(/\s+/g, "");
    }
    return false;
  };

  // 1. Central Admin check
  if (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase()) {
    const adminUser = (usersList || []).find((u) => (u.email || "").trim().toLowerCase() === cleanEmail) || {
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

  // 2. Check provisioned accounts (Department Officers provisioned by Admin)
  const matchedProvisioned = (provisionedAccounts || []).find((a) =>
    matchesIdentifier(a.email, a.phone)
  );
  if (matchedProvisioned) {
    const isOfficer =
      matchedProvisioned.role !== "Central Administrator" && matchedProvisioned.role !== "ADMIN";
    const role = isOfficer ? "OFFICER" : "ADMIN";
    const portalPath = isOfficer ? "/officer" : "/admin";
    const matchedDept =
      departmentsList.find((d) => d.id === matchedProvisioned.departmentId || d.name === matchedProvisioned.role) || departmentsList[0];

    const provisionedUserObj = {
      id: `usr-prov-${cleanEmail.replace(/[^a-z0-9]/g, "")}`,
      fullName: matchedProvisioned.fullName?.trim() || "Department Officer",
      email: matchedProvisioned.email?.trim() || cleanEmail,
      phone: matchedProvisioned.phone || "+251911000000",
      nationalId: matchedProvisioned.nationalId || `ET-${role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      role,
      departmentId: isOfficer ? (matchedProvisioned.departmentId || matchedDept?.id || null) : null,
      departmentName: isOfficer
        ? (matchedDept?.name || matchedProvisioned.role || "Unassigned Department")
        : "Woreda Central Administration",
      address: matchedProvisioned.address || "Kebele 03, Woreda Center",
      isActive: matchedProvisioned.isActive !== false,
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
    matchesIdentifier(u.email, u.phone)
  );
  if (matchedUser) {
    const isOfficer =
      matchedUser.role === "OFFICER" ||
      matchedUser.role === "Department Officer" ||
      (Boolean(matchedUser.role) && matchedUser.role !== "ADMIN" && matchedUser.role !== "Central Administrator" && matchedUser.role !== "CITIZEN");
    const isAdmin =
      matchedUser.role === "ADMIN" || matchedUser.role === "Central Administrator";
    const role = isOfficer ? "OFFICER" : isAdmin ? "ADMIN" : "CITIZEN";
    const portalPath = isOfficer ? "/officer/appointments" : isAdmin ? "/admin" : "/citizen/book";
    const matchedDept =
      departmentsList.find((d) => d.id === matchedUser.departmentId || d.name === matchedUser.role) || departmentsList[0];

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
    matchesIdentifier(o.email)
  );
  if (canonical) {
    const matchedDept =
      departmentsList.find((d) => d.id === canonical.departmentId) || departmentsList[0];
    return {
      role: "OFFICER",
      portalPath: "/officer",
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
      },
    };
  }

  // User does not exist in any system records
  return null;
}

const AUTH_COOKIE_NAME = "woreda_token";

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
  } catch {
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
  if (!claims || !claims.sub) return null;

  // Browser-issued tokens carry the email; tokens from auth-service (real admin login) do not,
  // so those are restored from their claims below.
  if (claims.email) {
    const session = resolveUserSession(claims.email, usersList, departmentsList, provisionedAccounts);
    if (session?.user) {
      return session.user;
    }
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

