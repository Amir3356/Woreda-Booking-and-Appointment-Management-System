import { useStore } from "@/context";
import { User, LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "@/hooks";

export default function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, setCurrentUser } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = pathname?.startsWith("/admin");
  const isOfficer = pathname?.startsWith("/officer");

  // Ensure appropriate display user per portal section
  let activeUser = currentUser;
  if (isAdmin && (!currentUser || currentUser?.role !== "ADMIN")) {
    activeUser = {
      fullName: currentUser?.role === "ADMIN" ? currentUser.fullName : "Ato Kibreab Demissie",
      email: currentUser?.role === "ADMIN" ? currentUser.email : "admin@woreda.gov.et",
      role: "ADMIN",
    };
  } else if (isOfficer && (!currentUser || currentUser?.role !== "OFFICER")) {
    activeUser = {
      fullName: currentUser?.role === "OFFICER" ? currentUser.fullName : "W/ro Tigist Mulugeta",
      email: currentUser?.role === "OFFICER" ? currentUser.email : "tigist.kbl@woreda.gov.et",
      role: "OFFICER",
    };
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setIsOpen(false);
    router.push("/login");
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-xs font-medium text-slate-700 shadow-xs cursor-pointer"
        title="User Profile"
      >
        <div className="w-7 h-7 rounded-lg bg-[#0b2545] text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
          {activeUser?.fullName?.charAt(0) || <User className="w-3.5 h-3.5" />}
        </div>
        <div className="text-left hidden sm:block">
          <span className="block font-semibold text-slate-800 leading-tight">
            {activeUser?.fullName || "User"}
          </span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            {activeUser?.role || "GUEST"}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Profile Summary Header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0b2545] text-white flex items-center justify-center font-bold text-sm uppercase shrink-0">
                {activeUser?.fullName?.charAt(0) || <User className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {activeUser?.fullName || "User Account"}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {activeUser?.email ||
                    `${(activeUser?.role || "user").toLowerCase()}@woreda.gov.et`}
                </p>
              </div>
            </div>
          </div>

          {/* Actions: Logout */}
          <div className="p-1.5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
