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
 * Resolves user identity, role, department association, and portal destination path from an email.
 * @param {string} email
 * @param {Array} [usersList=[]]
 * @param {Array} [departmentsList=[]]
 * @returns {{ role: string, portalPath: string, departmentId: string|null, departmentName: string|null }}
 */
export function resolveUserSession(email, usersList = [], departmentsList = []) {
  const cleanEmail = (email || "").trim().toLowerCase();

  // Check known existing user
  const matchedUser = usersList.find((u) => u.email?.toLowerCase() === cleanEmail);
  if (matchedUser) {
    let portalPath = "/citizen";
    if (matchedUser.role === "ADMIN") portalPath = "/admin";
    else if (matchedUser.role === "OFFICER") portalPath = "/officer";

    return {
      role: matchedUser.role,
      portalPath,
      departmentId: matchedUser.departmentId || null,
      departmentName: matchedUser.departmentName || null,
      user: matchedUser,
    };
  }

  // Dynamic fallback for any other email
  let role = "CITIZEN";
  let portalPath = "/citizen";
  let departmentId = null;
  let departmentName = null;

  if (cleanEmail.includes("admin")) {
    role = "ADMIN";
    portalPath = "/admin";
    departmentName = "Woreda Central Administration";
  } else if (cleanEmail.includes("officer") || cleanEmail.endsWith("@woreda.gov.et")) {
    role = "OFFICER";
    portalPath = "/officer";
    const matchedDept = departmentsList[0];
    departmentId = matchedDept?.id || "dept-1";
    departmentName = matchedDept?.name || "Kebele Administration & Vital Events";
  }

  return {
    role,
    portalPath,
    departmentId,
    departmentName,
    user: null,
  };
}

