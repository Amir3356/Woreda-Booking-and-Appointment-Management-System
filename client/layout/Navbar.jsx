import Link from "@/components/ui/Link";
import { usePathname } from "@/hooks";
import { useState } from "react";
import { Calendar, Building, Menu, X } from "lucide-react";
import RoleSwitcher from "@/components/ui/RoleSwitcher";
import { useStore } from "@/context";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentUser } = useStore();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/services", label: "Public Services" },
    { href: "/departments", label: "Departments" },
    { href: "/track", label: "Track Booking" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Help & Contact" },
  ];

  const getDashboardLink = () => {
    if (currentUser?.role === "ADMIN") return { href: "/admin", label: "Admin Console" };
    if (currentUser?.role === "OFFICER") return { href: "/officer", label: "Officer Desk" };
    return { href: "/citizen", label: "My Citizen Dashboard" };
  };

  const dashboard = getDashboardLink();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* Top National Banner */}
      <div className="bg-[#0b2545] text-white text-[11px] py-1.5 px-4 font-medium tracking-wide">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span>Federal Democratic Republic of Ethiopia — Woreda Public Administration Portal</span>
          </div>
          <div className="hidden md:flex items-center gap-4 text-slate-300">
            <span>Office Hours: Mon - Fri (08:30 - 17:30)</span>
            <span>Hotline: 9840</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0b2545] to-[#133b5c] flex items-center justify-center text-amber-400 shadow-md group-hover:scale-105 transition-transform">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base text-slate-900 tracking-tight">WoredaCare</span>
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold rounded bg-blue-100 text-blue-800">
                  Gov Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none">
                Appointment & Queue Management System
              </p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? "text-[#0b2545] bg-slate-100"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs & Role Switcher */}
          <div className="hidden sm:flex items-center gap-2.5">
            <RoleSwitcher />

            <Link
              href={dashboard.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              {dashboard.label}
            </Link>

            <Link
              href="/book"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0b2545] hover:bg-[#133b5c] text-white shadow-sm transition-all shadow-blue-900/10 active:scale-95"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>Book Appointment</span>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="flex sm:hidden items-center gap-2">
            <RoleSwitcher />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <Link
              href={dashboard.href}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700"
            >
              {dashboard.label}
            </Link>
            <Link
              href="/book"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0b2545] text-white text-sm font-semibold"
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              Book New Appointment
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

