"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useStore } from "@/lib/store";
import Link from "next/link";
import {
  Building2,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Calendar,
  Layers,
} from "lucide-react";

export default function DepartmentsPage() {
  const { departments, services } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[11px] uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Woreda Administration Directory
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
            Government Departments & Bureaus
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            All municipal offices are organized with designated counters, direct officer contacts, and clear operating schedules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const deptServices = services.filter((s) => s.departmentId === dept.id);
            return (
              <div
                key={dept.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-mono font-bold text-sm">
                      {dept.code}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active Operations
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-2">{dept.name}</h3>
                  <p className="text-xs text-slate-600 mb-4 leading-relaxed">{dept.description}</p>

                  <div className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{dept.buildingRoom}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{dept.contactPhone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Mon – Fri: 08:30 – 17:30</span>
                    </div>
                  </div>

                  {/* Services List Preview */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-700 mb-2">Available Services ({deptServices.length}):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {deptServices.map((s) => (
                        <span key={s.id} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    href={`/book?deptId=${dept.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-300" />
                    <span>Book Appointment with Desk</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}

