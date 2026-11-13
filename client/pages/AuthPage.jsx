import { useState } from "react";
import { useRouter } from "@/hooks";
import { useStore } from "@/context";
import { EthiopianFlag } from "@/components/ui";
import { http } from "@/api/httpClient";
import { normalizeEthiopianPhone } from "@/utils";
import {
  Landmark,
  Activity,
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  CircleCheck,
} from "lucide-react";

// Server role code (or its label) -> client role, and the portal each role lands on.
const ROLE_CODES = {
  ADMIN: "ADMIN",
  Admin: "ADMIN",
  OFFICER: "OFFICER",
  "Department Officer": "OFFICER",
  CITIZEN: "CITIZEN",
};
const PORTAL_PATHS = {
  ADMIN: "/admin",
  OFFICER: "/officer/appointments", // the department's own desk: appointments of that department only
  CITIZEN: "/citizen/book",
};

// What the portal does, shown on the brand panel (one line each).
const PORTAL_FEATURES = [
  "Online Booking with a Printable Appointment Slip",
  "Live Desk Queue with Token Numbers",
  "Audit Trail of Every Decision",
];

export default function AuthPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  // Sign In Form State: staff use their email, citizens their phone number
  const [signInIdentifier, setSignInIdentifier] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up Form State (Citizen only)
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpPhone, setSignUpPhone] = useState(""); // digits after the fixed +251 prefix
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [showSignUpConfirm, setShowSignUpConfirm] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle Sign In
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const inputIdentifier = signInIdentifier.trim();
    const passwordClean = signInPassword.trim();
    if (!inputIdentifier) {
      setError("Please enter your phone number.");
      return;
    }
    if (!passwordClean) {
      setError("Please enter your password.");
      return;
    }

    const digitsOnly = inputIdentifier.replace(/\D/g, "");
    const isPhone = !inputIdentifier.includes("@") && digitsOnly.length >= 8;
    const normalizedPhone = isPhone ? normalizeEthiopianPhone(inputIdentifier) : null;

    let emailClean = inputIdentifier.toLowerCase();
    if (!emailClean.includes("@")) {
      emailClean = `${emailClean}@woreda.gov.et`;
    }

    // Every account (administrator, department staff provisioned in Admin > Account Provision,
    // citizen) signs in against the database. The server checks the password and returns the
    // role and department, which decide the portal: role-based access is enforced by the server
    // token, never by data kept in the browser.
    setLoading(true);
    try {
      const credentials = isPhone
        ? { phone: normalizedPhone, password: passwordClean }
        : { email: emailClean, password: passwordClean };
      const { data } = await http.post("/auth/login", credentials);
      const u = data?.user;
      if (!data?.token || !u) throw new Error("unexpected sign-in response");

      const role = ROLE_CODES[u.role] || "CITIZEN";
      const departmentName =
        role === "OFFICER" ? u.departmentName || "Department" : role === "ADMIN" ? "Woreda Central Administration" : null;

      setCurrentUser({ ...u, role, departmentName }, data.token);
      router.push(PORTAL_PATHS[role]);
    } catch (err) {
      setLoading(false);
      if (err?.status === 429) {
        setError("Too many sign-in attempts. Please wait a few minutes and try again.");
      } else if (err?.status === 401 && /deactivated/i.test(err.message || "")) {
        setError("This account is currently deactivated. Please contact administration.");
      } else if (err?.status === 401 && /department/i.test(err.message || "")) {
        setError("Your staff account is not assigned to a department. Please contact administration.");
      } else if (err?.status === 401 || err?.status === 422) {
        setError(isPhone ? "Invalid phone number or password." : "Invalid email or password.");
      } else if (err instanceof TypeError) {
        setError("Cannot reach the server. Check your connection and try again.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    }
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
    const phoneClean = normalizeEthiopianPhone(signUpPhone);

    if (fullNameClean.length < 3) {
      setError("Please enter your full legal name (at least 3 characters).");
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
    if (signUpConfirmPassword !== signUpPassword) {
      setError("The passwords do not match. Please type the same password in both fields.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await http.post("/auth/register", {
        fullName: fullNameClean,
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
        setError("An account with this phone number already exists. Please sign in.");
      } else if (err?.status === 422 && err.details?.length) {
        setError(err.details.map((d) => d.issue).join(" "));
      } else if (err?.status === 429) {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError("Could not create your account: the server is unreachable. Please try again later.");
      }
    }
  };

  const isSignIn = mode === "signin";
  const switchMode = (next) => {
    setMode(next);
    setError("");
    setSuccessMsg("");
  };

  /** Password field with a show/hide toggle. */
  const passwordField = (id, value, setValue, shown, setShown, autoComplete, label = "Password", placeholder = null) => (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className="auth-input-wrapper">
        <Lock className="auth-input-icon" aria-hidden="true" />
        <input
          id={id}
          type={shown ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? (autoComplete === "new-password" ? "At least 8 characters" : "Enter your password")}
          className="auth-input auth-input--with-toggle"
        />
        <button
          type="button"
          onClick={() => setShown(!shown)}
          className="auth-password-toggle"
          aria-label={shown ? "Hide password" : "Show password"}
          title={shown ? "Hide password" : "Show password"}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand panel */}
        <section className="auth-brand" aria-label="WoredaCare">
          <div className="auth-brand-top">
            <div className="auth-logo-row">
              <span className="auth-logo-tile" aria-hidden="true">
                <Landmark />
              </span>
              <span className="auth-logo-name">WoredaCare</span>
            </div>
            <span className="auth-status-pill">
              <Activity aria-hidden="true" />
              FDRE · Woreda Public Administration
            </span>
          </div>

          <div className="auth-brand-body">
            <h1 className="auth-brand-title">Appointment &amp; Queue Management</h1>
            <p className="auth-brand-desc">
              Book a Woreda service online, track it with your reference number, and get
              served at the desk queue — citizens, department officers and administrators in one place.
            </p>
            <ul className="auth-feature-list">
              {PORTAL_FEATURES.map((f) => (
                <li key={f}>
                  <CircleCheck aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <footer className="auth-brand-footer">
            <span>© 2026 Woreda Booking &amp; Appointment Management System</span>
            <span className="auth-brand-footer-badge">
              <ShieldCheck aria-hidden="true" />
              RBAC Protected
            </span>
          </footer>
        </section>

        {/* Form panel */}
        <section className={`auth-form-panel${isSignIn ? "" : " is-signup"}`}>
          <div className="auth-form-inner">
            <header className="auth-form-header">
              <h2 className="auth-form-title">{isSignIn ? "Welcome Back" : "Create Your Account"}</h2>
              <p className="auth-form-subtitle">
                {isSignIn
                  ? "Sign in to access your WoredaCare portal"
                  : "Register as a citizen to book Woreda services online"}
              </p>
            </header>

            {error && (
              <div className="auth-alert auth-alert--error" role="alert">
                <AlertCircle aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="auth-alert auth-alert--success" role="status">
                <CheckCircle2 aria-hidden="true" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* ===================== SIGN IN FORM ===================== */}
            {isSignIn && (
              <form onSubmit={handleSignIn} className="auth-form" noValidate>
                <div className="auth-field">
                  <label htmlFor="signin-identifier" className="auth-label">Phone Number</label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-flag" aria-hidden="true">
                      <EthiopianFlag className="auth-flag" />
                      <span className="auth-input-code">+251</span>
                      <span className="auth-input-flag-divider" />
                    </span>
                    <input
                      id="signin-identifier"
                      type="text"
                      required
                      autoComplete="username"
                      inputMode="tel"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={signInIdentifier}
                      onChange={(e) => setSignInIdentifier(e.target.value)}
                      placeholder="9XX XXX XXX"
                      className="auth-input auth-input--with-flag"
                    />
                  </div>
                </div>

                {passwordField("signin-password", signInPassword, setSignInPassword, showSignInPassword, setShowSignInPassword, "current-password")}

                <button type="submit" disabled={loading} className="auth-submit">
                  <span>{loading ? "Signing In…" : "Sign In"}</span>
                  {!loading && <ArrowRight aria-hidden="true" />}
                </button>

                <p className="auth-switch">
                  Don&apos;t have an account?
                  <button type="button" onClick={() => switchMode("signup")} className="auth-switch-btn">
                    Sign up
                  </button>
                </p>
              </form>
            )}

            {/* ===================== SIGN UP FORM ===================== */}
            {!isSignIn && (
              <form onSubmit={handleSignUp} className="auth-form" noValidate>
                <div className="auth-field-row">
                <div className="auth-field">
                  <label htmlFor="signup-name" className="auth-label">Full Legal Name</label>
                  <div className="auth-input-wrapper">
                    <User className="auth-input-icon" aria-hidden="true" />
                    <input
                      id="signup-name"
                      type="text"
                      required
                      autoComplete="name"
                      value={signUpFullName}
                      onChange={(e) => setSignUpFullName(e.target.value)}
                      placeholder="e.g. Almaz Hailu"
                      className="auth-input"
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <label htmlFor="signup-phone" className="auth-label">Phone Number</label>
                  <div className="auth-input-wrapper">
                    <span className="auth-input-flag" aria-hidden="true">
                      <EthiopianFlag className="auth-flag" />
                      <span className="auth-input-code">+251</span>
                      <span className="auth-input-flag-divider" />
                    </span>
                    <input
                      id="signup-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      value={signUpPhone}
                      onChange={(e) => setSignUpPhone(e.target.value)}
                      placeholder="9XX XXX XXX"
                      className="auth-input auth-input--with-flag"
                    />
                  </div>
                </div>
                </div>

                <div className="auth-field-row">
                  {passwordField("signup-password", signUpPassword, setSignUpPassword, showSignUpPassword, setShowSignUpPassword, "new-password", "Password", "8+ characters")}
                  {passwordField("signup-confirm-password", signUpConfirmPassword, setSignUpConfirmPassword, showSignUpConfirm, setShowSignUpConfirm, "new-password", "Confirm Password", "Type again")}
                </div>

                <button type="submit" disabled={loading} className="auth-submit">
                  <span>{loading ? "Creating Account…" : "Create Account"}</span>
                  {!loading && <ArrowRight aria-hidden="true" />}
                </button>

                <p className="auth-switch">
                  Already have an account?
                  <button type="button" onClick={() => switchMode("signin")} className="auth-switch-btn">
                    Sign in
                  </button>
                </p>
              </form>
            )}

            <p className="auth-footnote">
              <ShieldCheck aria-hidden="true" />
              Role-Based Access Control (RBAC) Protected
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
