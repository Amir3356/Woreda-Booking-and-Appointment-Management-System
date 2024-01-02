import Link from "next/link";
import { Building, Phone, Mail, MapPin, Clock, ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand & Mission */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-800 flex items-center justify-center text-amber-300">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">WoredaCare</h3>
                <p className="text-xs text-slate-400">Public Administration Portal</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Empowering citizens with efficient, transparent, and queue-free local government appointments across all Woreda departments.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Official FDRE Local Government Portal</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Citizen Services
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/book" className="hover:text-white transition-colors">
                  Book New Appointment
                </Link>
              </li>
              <li>
                <Link href="/track" className="hover:text-white transition-colors">
                  Track Existing Booking
                </Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-white transition-colors">
                  Service Requirements & Documents
                </Link>
              </li>
              <li>
                <Link href="/citizen" className="hover:text-white transition-colors">
                  Citizen Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Key Departments */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Woreda Departments
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/departments" className="hover:text-white transition-colors">
                  Kebele Administration & Vital Events
                </Link>
              </li>
              <li>
                <Link href="/departments" className="hover:text-white transition-colors">
                  Land Administration & Cadastre
                </Link>
              </li>
              <li>
                <Link href="/departments" className="hover:text-white transition-colors">
                  Trade, Industry & Enterprise
                </Link>
              </li>
              <li>
                <Link href="/departments" className="hover:text-white transition-colors">
                  Revenue & Tax Administration
                </Link>
              </li>
              <li>
                <Link href="/departments" className="hover:text-white transition-colors">
                  Social Welfare & Labor
                </Link>
              </li>
            </ul>
          </div>

          {/* Operating Hours & Contact */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">
              Working Hours & Desk
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Monday – Friday</p>
                  <p>08:30 AM – 12:30 PM</p>
                  <p>01:30 PM – 05:30 PM</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Hotline: 9840 / +251 11 551 0000</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>support@woreda.gov.et</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Woreda Administration Complex, Addis Ababa, Ethiopia</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-800 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Woreda Booking and Appointment Management System. All Rights Reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-slate-400">Privacy Policy</Link>
            <Link href="/about" className="hover:text-slate-400">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-400">Citizen Charter</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
