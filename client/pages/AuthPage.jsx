import { useState } from "react";
import { useRouter } from "@/hooks";
import { useStore } from "@/context";
import {
  resolveUserSession,
  verifyCredentials,
  CANONICAL_OFFICER_CREDENTIALS,
} from "@/services";
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
  const [signUpLocation, setSignUpLocation] = useState("");
  const [signUpWoreda, setSignUpWoreda] = useState("");
  const [signUpKebele, setSignUpKebele] = useState("");
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

    // Administrators and staff sign in against auth-service, returning an authenticated session.
    // In-browser fallback accounts are also supported.
    setLoading(true);
    try {
      const credentials = isPhone
        ? { phone: normalizedPhone, password: passwordClean }
        : { email: emailClean, password: passwordClean };
      const { data } = await http.post("/auth/login", credentials);
      if (data?.token && data?.user) {
        const u = data.user;
        const isOfficer = u.role === "OFFICER" || u.role === "Department Officer";
        const isAdmin = u.role === "ADMIN" || u.role === "Admin" || u.role === "Central Administrator";
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

        // Keep Admin > Account Provision in sync with server officer account
        if (isOfficer) {
          useStore.getState().addProvisionedAccount({
            id: u.id,
            fullName: u.fullName,
            phone: u.phone,
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
      if (err?.status === 401 && err.message?.includes("deactivated")) {
        setLoading(false);
        setError("This account is currently deactivated. Please contact administration.");
        return;
      }
      // If 401 or network error, proceed to fallback checking against client/in-browser provisioned accounts
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
        phone: "+251911000000",
        password: c.password,
        role: "OFFICER",
        departmentId: c.departmentId,
        departmentName: c.departmentName,
        isProvisioned: true,
        isActive: true,
      });
    });

    // 2. Overlay in-memory Zustand store
    const storeProv = useStore.getState().provisionedAccounts || [];
    storeProv.forEach((a) => {
      const k = (a.phone || a.email || a.id || "").trim().toLowerCase();
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

    // 3. Overlay browser localStorage ("woreda-booking-storage")
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
            const k = (a.phone || a.email || a.id || "").trim().toLowerCase();
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
            const k = (u.phone || u.email || u.id || "").trim().toLowerCase();
            if (k) usersMap.set(k, u);
          });

          if (localDepts.length > 0) currentDepts = localDepts;
        }

        // 4. Overlay secondary backup storage ("woreda_provisioned_accounts")
        const rawBackup = window.localStorage.getItem("woreda_provisioned_accounts");
        if (rawBackup) {
          const parsedBackup = JSON.parse(rawBackup);
          if (Array.isArray(parsedBackup)) {
            parsedBackup.forEach((a) => {
              const k = (a.phone || a.email || a.id || "").trim().toLowerCase();
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
      } catch {
        // ignore
      }
    }

    const storeUsers = useStore.getState().users || [];
    storeUsers.forEach((u) => {
      const k = (u.phone || u.email || u.id || "").trim().toLowerCase();
      if (k && !usersMap.has(k)) usersMap.set(k, u);
    });

    const currentProvisioned = Array.from(provMap.values());
    const currentUsers = Array.from(usersMap.values());

    // 1. Strict credential check against Admin, provisioned staff, and registered users
    const isValid = verifyCredentials(inputIdentifier, passwordClean, currentUsers, currentProvisioned);
    if (!isValid) {
      setError(isPhone ? "Invalid phone number or password." : "Invalid email or password.");
      return;
    }

    // 2. Resolve user session
    const session = resolveUserSession(inputIdentifier, currentUsers, currentDepts, currentProvisioned);
    if (!session || !session.user) {
      setError(isPhone ? "No registered account found for this phone number." : "No registered account found for this email.");
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
      router.push(session.portalPath || (session.role === "OFFICER" ? "/officer/appointments" : session.role === "ADMIN" ? "/admin" : "/citizen/book"));
    }, 200);
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
    if (!signUpLocation.trim()) {
      setError("Please enter your location (e.g. Addis Ababa, Bole Sub-City).");
      return;
    }
    if (!signUpWoreda.trim()) {
      setError("Please enter your woreda.");
      return;
    }
    if (!signUpKebele.trim()) {
      setError("Please enter your kebele.");
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
        location: signUpLocation.trim(),
        woreda: signUpWoreda.trim(),
        kebele: signUpKebele.trim(),
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

  /** Text field with a leading icon. */
  const textField = (id, label, Icon, value, setValue, placeholder, autoComplete) => (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className="auth-input-wrapper">
        {Icon && <Icon className="auth-input-icon" aria-hidden="true" />}
        <input
          id={id}
          type="text"
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={Icon ? "auth-input" : "auth-input auth-input--plain"}
        />
      </div>
    </div>
  );

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
              Book a Woreda public service online, track it with your reference number, and get
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

                <div className="auth-field-row auth-field-row--3">
                  {textField("signup-location", "Location", null, signUpLocation, setSignUpLocation, "Addis Ababa", "address-level1")}
                  {textField("signup-woreda", "Woreda", null, signUpWoreda, setSignUpWoreda, "Woreda 03", "address-level2")}
                  {textField("signup-kebele", "Kebele", null, signUpKebele, setSignUpKebele, "Kebele 05", "address-level3")}
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
