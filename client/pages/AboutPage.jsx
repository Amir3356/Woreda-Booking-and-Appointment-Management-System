import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";
import { useStore } from "@/context";
import { Building, ShieldCheck, Clock, Users, CheckCircle2 } from "lucide-react";
import Link from "@/components/ui/Link";

export default function AboutPage() {
  const { departments = [], services = [], users = [] } = useStore();
  const officerCount = users.filter((u) => u.role === "OFFICER").length;
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <span className="text-[11px] uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            About WoredaCare
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
            Modernizing Local Government Public Service Delivery
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            An official initiative to transform Ethiopian Woreda and Kebele citizen interactions through technology.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-700" />
              Our Vision & Purpose
            </h2>
            <p>
              In traditional local government administration, citizens often spent hours or multiple days queuing at Kebele, Land, and Revenue offices without assurance of being served. The <strong>Woreda Booking and Appointment Management System</strong> transforms this experience by establishing transparent, predictable, and accountable digital scheduling for every citizen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <Clock className="w-6 h-6 text-amber-600 mb-2" />
              <h3 className="font-bold text-slate-900 text-xs mb-1">Zero Congestion</h3>
              <p className="text-[11px] text-slate-500">
                Eliminates early morning crowds and waiting lines at government gates.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <ShieldCheck className="w-6 h-6 text-emerald-600 mb-2" />
              <h3 className="font-bold text-slate-900 text-xs mb-1">Fair & Transparent</h3>
              <p className="text-[11px] text-slate-500">
                Immutable queues and appointment timestamps prevent queue jumping or favoritism.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <Users className="w-6 h-6 text-blue-600 mb-2" />
              <h3 className="font-bold text-slate-900 text-xs mb-1">Dignified Experience</h3>
              <p className="text-[11px] text-slate-500">
                Guaranteed time slots empower citizens and service officers with orderly desks.
              </p>
            </div>
          </div>

          {/* Dynamic System Highlights */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-center">
            <div>
              <p className="text-xl font-black text-blue-900">{departments.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Woreda Departments</p>
            </div>
            <div>
              <p className="text-xl font-black text-blue-900">{services.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Services</p>
            </div>
            <div>
              <p className="text-xl font-black text-blue-900">{officerCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Desk Officers</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-base font-bold text-slate-900 mb-3">Citizen Service Charter</h2>
            <ul className="space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Every citizen is entitled to courteous, timely, and corruption-free service.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>All required documentation and fees are publicized transparently before booking.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Department officers are held accountable to designated desk durations and waiting time benchmarks.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/contact"
              className="text-xs font-bold text-blue-700 hover:text-blue-900"
            >
              Contact Citizen Complaints & Feedback Desk →
            </Link>
            <Link
              href="/book"
              className="px-4 py-2 rounded-xl bg-[#0b2545] text-white text-xs font-bold"
            >
              Book an Appointment
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

