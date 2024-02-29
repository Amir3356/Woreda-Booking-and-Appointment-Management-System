import { useState } from "react";
import { useRouter } from "@/hooks";
import { useStore } from "@/context";
import { DEFAULT_PROVISIONED_ACCOUNTS } from "@/context/store";
import {
  resolveUserSession,
  verifyCredentials,
  isValidEmail,
  CANONICAL_OFFICER_CREDENTIALS,
} from "@/services";
import { EthiopianFlag } from "@/components/ui";
import { http } from "@/api/httpClient";
import { normalizeEthiopianPhone } from "@/utils";
import {
  Building,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up Form State (Citizen only)
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("+251 9");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const inputEmail = signInEmail.trim();
    const passwordClean = signInPassword.trim();
    if (!inputEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!passwordClean) {
      setError("Please enter your password.");
      return;
    }

    let emailClean = inputEmail.toLowerCase();
    if (!emailClean.includes("@")) {
      emailClean = `${emailClean}@woreda.gov.et`;
    }

    // Administrators sign in against auth-service, so their token is accepted by the API and
    // they can manage the service catalog. Citizens and officers still use the in-browser
    // accounts below; their credentials are only checked here and then ignored.
    setLoading(true);
    try {
      const { data } = await http.post("/auth/login", { email: emailClean, password: passwordClean });
      if (data?.token && data?.user) {
        const u = data.user;
        const isOfficer = u.role === "OFFICER" || u.role === "Department Officer";
        const isAdmin = u.role === "ADMIN" || u.role === "Central Administrator";
        const role = isOfficer ? "OFFICER" : isAdmin ? "ADMIN" : "CITIZEN";
        const portalPath = isOfficer ? "/officer/appointments" : isAdmin ? "/admin" : "/citizen/book";

        const currentDepts = useStore.getState().departments || [];
        const matchedDept = currentDepts.find((d) => d.id === u.departmentId);
        const departmentName = isOfficer
          ? (u.departmentName || matchedDept?.name || "Kebele Office")
          : isAdmin
          ? "Woreda Central Administration"
          : null;

        const authenticatedUser = {
          ...u,
          role,
          departmentName,
          isProvisioned: true,
        };

        setCurrentUser(authenticatedUser, data.token);

        // Keep Admin > Account Provision in sync with a server officer account (officers only:
        // citizens and the administrator are not provisioned staff).
        if (isOfficer) {
          useStore.getState().addProvisionedAccount({
            fullName: u.fullName,
            email: u.email,
            password: passwordClean,
            role: departmentName || "Department Officer",
            departmentId: u.departmentId,
          });
        }

        router.push(portalPath);
        return;
      }
    } catch (err) {
      if (err?.status === 429) {
        setLoading(false);
        setError("Too many sign-in attempts. Please wait a few minutes and try again.");
        return;
      }
      // Not an account in the server database (401) or the server is unreachable:
      // continue with the in-browser accounts.
    }
    setLoading(false);

    // Refresh and assemble all provisioned accounts and users from memory, defaults, and localStorage
    const provMap = new Map();
    const usersMap = new Map();

    // 1. Seed canonical officers
    CANONICAL_OFFICER_CREDENTIALS.forEach((c) => {
      provMap.set(c.email.toLowerCase(), {
        fullName: c.fullName,
        email: c.email,
        password: c.password,
        role: "OFFICER",
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        isProvisioned: true,
        isActive: true,
      });
    });

    // 2. Seed defaults
    DEFAULT_PROVISIONED_ACCOUNTS.forEach((d) => {
      const k = (d.email || "").trim().toLowerCase();
      if (k) {
        provMap.set(k, {
          ...d,
          password: d.password || "Password@123",
          isProvisioned: true,
          isActive: true,
        });
      }
    });

    // 3. Overlay in-memory Zustand store
    const storeProv = useStore.getState().provisionedAccounts || [];
    storeProv.forEach((a) => {
      const k = (a.email || "").trim().toLowerCase();
      if (k) {
        const existing = provMap.get(k) || {};
        provMap.set(k, {
          ...existing,
          ...a,
          password: (a.password || "").trim() || existing.password || "Password@123",
          isProvisioned: true,
          isActive: a.isActive !== false,
        });
      }
    });

    // 4. Overlay browser localStorage ("woreda-booking-storage")
    let currentDepts = useStore.getState().departments || [];
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem("woreda-booking-storage");
        if (raw) {
          const parsed = JSON.parse(raw);
          const localProv = parsed?.state?.provisionedAccounts || [];
          const localUsers = parsed?.state?.users || [];
          const localDepts = parsed?.state?.departments || [];

          localProv.forEach((a) => {
            const k = (a.email || "").trim().toLowerCase();
            if (k) {
              const existing = provMap.get(k) || {};
              provMap.set(k, {
                ...existing,
                ...a,
                password: (a.password || "").trim() || existing.password || "Password@123",
                isProvisioned: true,
                isActive: a.isActive !== false,
              });
            }
          });

          localUsers.forEach((u) => {
            const k = (u.email || "").trim().toLowerCase();
            if (k) usersMap.set(k, u);
          });

          if (localDepts.length > 0) currentDepts = localDepts;
        }

        // 5. Overlay secondary backup storage ("woreda_provisioned_accounts")
        const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
        if (rawBackup) {
          const parsedBackup = JSON.parse(rawBackup);
          if (Array.isArray(parsedBackup)) {
            parsedBackup.forEach((a) => {
              const k = (a.email || "").trim().toLowerCase();
              if (k) {
                const existing = provMap.get(k) || {};
                provMap.set(k, {
                  ...existing,
                  ...a,
                  password: (a.password || "").trim() || existing.password || "Password@123",
                  isProvisioned: true,
                  isActive: a.isActive !== false,
                });
              }
            });
          }
        }
      } catch (err) {
        // ignore
      }
    }

    const storeUsers = useStore.getState().users || [];
    storeUsers.forEach((u) => {
      const k = (u.email || "").trim().toLowerCase();
      if (k && !usersMap.has(k)) usersMap.set(k, u);
    });

    const currentProvisioned = Array.from(provMap.values());
    const currentUsers = Array.from(usersMap.values());

    // 1. Strict credential check against Admin, provisioned staff, and registered users
    const isValid = verifyCredentials(emailClean, passwordClean, currentUsers, currentProvisioned);
    if (!isValid) {
      setError("Invalid email or password.");
      return;
    }

    // 2. Resolve user session
    const session = resolveUserSession(emailClean, currentUsers, currentDepts, currentProvisioned);
    if (!session || !session.user) {
      setError("No registered account found for this email.");
      return;
    }

    if (session.user.isActive === false) {
      setError("This account is currently deactivated. Please contact administration.");
      return;
    }

    setLoading(true);
    setCurrentUser(session.user);

    // Keep store synchronized so the active session immediately has all accounts
    useStore.setState({
      provisionedAccounts: currentProvisioned,
      users: currentUsers,
      departments: currentDepts,
    });

    setTimeout(() => {
      setLoading(false);
      router.push(session.portalPath);
    }, 300);
  };

  // Handle Sign Up (Public self-registration for Citizens ONLY)
  // Handle Sign Up (public self-registration for citizens only). The account is created in
  // auth-service (MongoDB), so the citizen can sign in from any device and their bookings are
  // visible to the officers of the department that provides the service.
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const fullNameClean = signUpFullName.trim();
    const emailClean = signUpEmail.trim().toLowerCase();
    const phoneClean = normalizeEthiopianPhone(signUpPhone);

    if (fullNameClean.length < 3) {
      setError("Please enter your full legal name (at least 3 characters).");
      return;
    }
    if (!emailClean || !isValidEmail(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Strict Role Policy: Department Officers and Admins CANNOT self-register
    if (
      emailClean.endsWith("@woreda.gov.et") ||
      emailClean.includes("admin") ||
      emailClean.includes("officer")
    ) {
      setError(
        "Department Officer and Administrator accounts cannot self-register. Official staff credentials are created exclusively by the Central Administrator in Account Provision."
      );
      return;
    }

    if (!/^\+2519\d{8}$/.test(phoneClean)) {
      setError("Please enter an Ethiopian mobile number, e.g. +251 911 234 567 or 0911 234 567.");
      return;
    }
    if (signUpPassword.length < 8 || !/[\p{Nd}\p{P}\p{S}]/u.test(signUpPassword)) {
      setError("Password must be at least 8 characters and include a number or symbol.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await http.post("/auth/register", {
        fullName: fullNameClean,
        email: emailClean,
        phone: phoneClean,
        password: signUpPassword,
      });
      setCurrentUser({ ...data.user, role: "CITIZEN", departmentName: null }, data.token);
      setSuccessMsg("Citizen account registered successfully! Redirecting...");
      setTimeout(() => {
        setLoading(false);
        router.push("/citizen/book");
      }, 500);
    } catch (err) {
      setLoading(false);
      if (err?.status === 409) {
        setError("An account with this email address already exists. Please sign in.");
      } else if (err?.status === 422 && err.details?.length) {
        setError(err.details.map((d) => d.issue).join(" "));
      } else if (err?.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError("Could not create your account: the server is unreachable. Please try again later.");
      }
    }
  };

  return (
    <div className="auth-page">
      {/* Main Authentication Card */}
      <div className="auth-card">
        {/* Top Government Emblem Header */}
        <div className="auth-header">
          <div className="auth-emblem-badge">
            <Building className="w-6 h-6 text-amber-400" />
          </div>
          <p className="auth-header-sub">
            FDRE — Woreda Public Administration
          </p>
          <h1 className="auth-header-title">
            WoredaCare Portal Login
          </h1>
          <p className="auth-header-desc">
            Appointment & Queue Management System
          </p>
        </div>

        {/* Form Body */}
        <div className="auth-body">
          {error && (
            <div className="auth-alert-error">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert-success">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ===================== SIGN IN FORM ===================== */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-label">
                  Email Address *
                </label>
                <div className="auth-input-wrapper">
                  <Mail className="auth-input-icon" />
                  <input
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="Enter email (e.g. name@woreda.gov.et)"
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">
                  Password *
                </label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type={showSignInPassword ? "text" : "password"}
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="auth-input"
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="auth-password-toggle"
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#94a3b8",
                      zIndex: 5,
                    }}
                    title={showSignInPassword ? "Hide password" : "Show password"}
                    aria-label={showSignInPassword ? "Hide password" : "Show password"}
                  >
                    {showSignInPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500 hover:text-slate-700 transition-colors" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-btn-submit"
              >
                <span>{loading ? "Signing In..." : "Sign In"}</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>

              <div className="auth-toggle-box">
                <span>Don't have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                  className="auth-toggle-btn"
                >
                  Sign Up here
                </button>
              </div>

            </form>
          )}

          {/* ===================== SIGN UP FORM ===================== */}
          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="auth-form">
              <div className="auth-form-group">
                <label className="auth-label">
                  Full Legal Name *
                </label>
                <div className="auth-input-wrapper">
                  <User className="auth-input-icon" />
                  <input
                    type="text"
                    required
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    placeholder="e.g. Almaz Hailu Mengistu"
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">
                  Email Address *
                </label>
                <div className="auth-input-wrapper">
                  <Mail className="auth-input-icon" />
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    placeholder="e.g. almaz@citizen.et"
                    className="auth-input"
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">
                  Phone Number *
                </label>
                <div className="auth-input-wrapper">
                  <div className="auth-input-icon flex items-center gap-2 pointer-events-none select-none">
                    <EthiopianFlag className="w-5 h-3.5 shadow-xs shrink-0" />
                    <span className="w-px h-4 bg-slate-300" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(e.target.value)}
                    placeholder="+251 9XX XXX XXX"
                    className="auth-input"
                    style={{ paddingLeft: "3.75rem" }}
                  />
                </div>
              </div>

              <div className="auth-form-group">
                <label className="auth-label">
                  Password *
                </label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type={showSignUpPassword ? "text" : "password"}
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="auth-input"
                    style={{ paddingRight: "2.75rem" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="auth-password-toggle"
                    style={{
                      position: "absolute",
                      right: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      padding: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#94a3b8",
                      zIndex: 5,
                    }}
                    title={showSignUpPassword ? "Hide password" : "Show password"}
                    aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                  >
                    {showSignUpPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500 hover:text-slate-700 transition-colors" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-btn-submit auth-btn-signup"
              >
                <span>{loading ? "Signing Up..." : "Sign Up"}</span>
              </button>

              <div className="auth-toggle-box">
                <span>Already have an account? </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className="auth-toggle-btn"
                >
                  Sign In here
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Card Footer */}
        <div className="auth-card-footer">
          <ShieldCheck className="auth-card-footer-icon" />
          <span>Role-Based Access Control (RBAC) Protected</span>
        </div>
      </div>

      {/* Bottom copyright notice */}
      <p className="auth-copyright">
        © 2026 Woreda Booking & Appointment Management System. All Rights Reserved.
      </p>
    </div>
  );
}
