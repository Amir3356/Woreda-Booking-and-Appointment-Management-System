import { useState } from "react";
import { useRouter } from "@/hooks";
import Link from "@/components/ui/Link";
import { EthiopianFlag } from "@/components/ui";
import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";
import { useStore } from "@/context";
import { authApi } from "@/api";
import { normalizeEthiopianPhone } from "@/utils";
import { isValidEmail } from "@/services";
import { User, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { setCurrentUser } = useStore();

  const [form, setForm] = useState({
    fullName: "",
    phone: "+251 9",
    email: "",
    nationalId: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const fullNameClean = form.fullName.trim();
    const phoneClean = normalizeEthiopianPhone(form.phone);
    const emailClean = (form.email || "").trim().toLowerCase();

    if (fullNameClean.length < 3) {
      setError("Please enter your full legal name (at least 3 characters).");
      return;
    }

    if (!/^\+2519\d{8}$/.test(phoneClean)) {
      setError("Please enter a valid Ethiopian mobile number (e.g. +251 911 234 567 or 0911 234 567).");
      return;
    }

    if (emailClean && !isValidEmail(emailClean)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (
      emailClean.endsWith("@woreda.gov.et") ||
      emailClean.includes("admin") ||
      emailClean.includes("officer")
    ) {
      setError(
        "Department Officer and Administrator accounts cannot self-register. Official staff credentials are created exclusively by the Admin in Account Provision."
      );
      return;
    }

    if (!form.password || form.password.length < 8 || !/[\p{Nd}\p{P}\p{S}]/u.test(form.password)) {
      setError("Password must be at least 8 characters and include a number or symbol.");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        fullName: fullNameClean,
        phone: phoneClean,
        email: emailClean || null,
        password: form.password,
        nationalId: form.nationalId?.trim() || undefined,
      });

      if (res.data?.token && res.data?.user) {
        setCurrentUser({ ...res.data.user, role: "CITIZEN", departmentName: null }, res.data.token);
      }

      // Synchronize newly registered citizen into the Citizen Management pool
      useStore.getState().addRegisteredCitizen?.({
        id: res.data?.user?.id || `cit-${Date.now()}`,
        fullName: fullNameClean,
        phone: phoneClean,
        nationalId: form.nationalId?.trim() || res.data?.user?.nationalId || `ET-CIT-${Math.floor(1000 + Math.random() * 9000)}`,
        status: "VERIFIED",
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/citizen/book");
      }, 1200);
    } catch (err) {
      setLoading(false);
      if (err?.status === 409) {
        setError("An account with this phone number or email already exists. Please Sign In.");
      } else if (err?.status === 422 && err.details?.length) {
        setError(err.details.map((d) => d.issue).join(" "));
      } else if (err?.status === 429) {
        setError("Too many registration attempts. Please wait a few minutes and try again.");
      } else {
        setError(err?.message || "Could not create account: the server is unreachable. Please try again later.");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-lg mx-auto w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0b2545] text-amber-300 flex items-center justify-center mx-auto mb-3 shadow-md">
            <User className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Citizen Registration
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create an official citizen account for instant booking and tracking.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {success ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-900 text-base">Account Created Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">Redirecting to your citizen dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Almaz Hailu Mengistu"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 flex items-center gap-2 pointer-events-none select-none">
                      <EthiopianFlag className="w-5 h-3.5 shadow-xs shrink-0" />
                      <span className="w-px h-4 bg-slate-300" />
                    </div>
                    <input
                      type="tel"
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+251 9XX XXX XXX"
                      className="w-full pr-3 py-2 border rounded-lg text-xs"
                      style={{ paddingLeft: "3.75rem" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="almaz@example.et"
                    className="w-full px-3 py-2 border rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  National ID Number (Optional)
                </label>
                <input
                  type="text"
                  value={form.nationalId}
                  onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
                  placeholder="ET-CIT-XXXX"
                  className="w-full px-3 py-2 border rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 border rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-slate-500 hover:text-slate-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] disabled:opacity-50 text-white text-xs font-bold shadow transition-colors mt-2"
              >
                {loading ? "Creating account..." : "Sign Up"}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Already registered?{" "}
            <Link href="/login" className="font-bold text-blue-700 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

