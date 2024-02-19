import { useState } from "react";
import { useRouter } from "@/hooks";
import { useStore } from "@/context";
import { resolveUserSession, formatDisplayNameFromEmail } from "@/services";
import {
  Building,
  User,
  Mail,
  Lock,
  Shield,
  Phone,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  UserPlus,
  LogIn,
  CheckCircle2,
} from "lucide-react";

export default function AuthPage() {
  const router = useRouter();
  const { setCurrentUser, addUser, departments, users } = useStore();

  const [mode, setMode] = useState("signin"); // "signin" | "signup"

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  // Sign Up Form State
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpRole, setSignUpRole] = useState("Citizen");
  const [signUpDeptId, setSignUpDeptId] = useState("dept-1");
  const [signUpPassword, setSignUpPassword] = useState("");

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper for role mapping
  const resolveRoleMeta = (roleString, deptIdParam) => {
    let targetRole = "CITIZEN";
    let targetPath = "/citizen";
    let deptName = null;
    let deptId = null;

    if (roleString === "Admin") {
      targetRole = "ADMIN";
      targetPath = "/admin";
      deptName = "Woreda Central Administration";
    } else if (roleString === "Department Officer") {
      targetRole = "OFFICER";
      targetPath = "/officer";
      const matchedDept = departments.find((d) => d.id === deptIdParam) || departments[0];
      deptName = matchedDept?.name || "Kebele Administration & Vital Events";
      deptId = matchedDept?.id || "dept-1";
    } else {
      targetRole = "CITIZEN";
      targetPath = "/citizen";
    }

    return { targetRole, targetPath, deptName, deptId };
  };

  // Handle Sign In
  const handleSignIn = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const emailClean = signInEmail.trim().toLowerCase();
    if (!emailClean) {
      setError("Please enter your email address.");
      return;
    }
    if (!signInPassword) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    const session = resolveUserSession(signInEmail, users, departments);
    const authenticatedUser = session.user || {
      id: `usr-${Date.now()}`,
      fullName: formatDisplayNameFromEmail(signInEmail),
      email: signInEmail.trim(),
      phone: "+251911000000",
      nationalId: `ET-${session.role.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      role: session.role,
      departmentId: session.departmentId,
      departmentName: session.departmentName,
      isActive: true,
      address: "Kebele 03, Woreda Center",
    };

    setCurrentUser(authenticatedUser);

    setTimeout(() => {
      setLoading(false);
      router.push(session.portalPath);
    }, 400);
  };

  // Handle Sign Up
  const handleSignUp = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!signUpFullName.trim()) {
      setError("Please enter your fullname.");
      return;
    }
    if (!signUpEmail.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!signUpPassword || signUpPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    const { targetRole, targetPath, deptName, deptId } = resolveRoleMeta(
      signUpRole,
      signUpDeptId
    );

    const newUser = addUser({
      fullName: signUpFullName.trim(),
      email: signUpEmail.trim(),
      phone: "+251911000000",
      role: targetRole,
      departmentId: deptId,
      departmentName: deptName,
      nationalId: `ET-${targetRole.slice(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}`,
      address: "Kebele 03, Woreda Center",
    });

    setCurrentUser(newUser);
    setSuccessMsg("Account registered successfully! Redirecting...");

    setTimeout(() => {
      setLoading(false);
      router.push(targetPath);
    }, 600);
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
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••"
                    className="auth-input"
                  />
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
                  Fullname *
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
                  Register As Role *
                </label>
                <div className="auth-input-wrapper">
                  <Shield className="auth-input-icon" />
                  <select
                    value={signUpRole}
                    onChange={(e) => setSignUpRole(e.target.value)}
                    className="auth-select"
                  >
                    <option value="Citizen">Citizen</option>
                    <option value="Department Officer">Department Officer</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>

              {signUpRole === "Department Officer" && (
                <div className="auth-form-group">
                  <label className="auth-label">
                    Assigned Department Office *
                  </label>
                  <select
                    value={signUpDeptId}
                    onChange={(e) => setSignUpDeptId(e.target.value)}
                    className="auth-select"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="auth-form-group">
                <label className="auth-label">
                  Password *
                </label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••••"
                    className="auth-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-btn-submit auth-btn-signup"
              >
                <span>{loading ? "Creating Account..." : "Sign Up"}</span>
                <UserPlus className="w-4 h-4 text-white" />
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
