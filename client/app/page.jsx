"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useStore } from "@/lib/store";
import {
  Calendar,
  Search,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  const { departments, services } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#0b2545] via-[#103058] to-[#133b5c] text-white py-16 lg:py-24 flex flex-col justify-between">
        {/* Subtle patterned overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full my-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-amber-300 mb-6 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Modernizing Ethiopian Municipal Public Administration</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white mb-6">
              Book Your Government Service Appointment{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-emerald-400">
                Online
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed mb-8">
              Eliminate physical waiting queues and unnecessary trips. Schedule appointments with Kebele Administration, Land Administration, Revenue, and Trade offices in minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-lg transition-transform active:scale-95"
              >
                <Calendar className="w-4 h-4" />
                <span>Book an Appointment</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/track"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm backdrop-blur-sm transition-colors"
              >
                <Search className="w-4 h-4 text-slate-300" />
                <span>Track Existing Booking</span>
              </Link>

              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                <span>Browse All Services</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Live Metrics Counter Strip */}
        <div className="relative mt-12 border-t border-white/10 bg-black/20 backdrop-blur-md w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-300">{departments.length}</p>
                <p className="text-xs text-slate-300 uppercase tracking-wider font-medium mt-1">
                  Active Departments
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{services.length}+</p>
                <p className="text-xs text-slate-300 uppercase tracking-wider font-medium mt-1">
                  Public Services
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-blue-300">100%</p>
                <p className="text-xs text-slate-300 uppercase tracking-wider font-medium mt-1">
                  Online Slot Reservation
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-extrabold text-purple-300">15 min</p>
                <p className="text-xs text-slate-300 uppercase tracking-wider font-medium mt-1">
                  Avg. Desk Service Speed
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
