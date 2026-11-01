"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useStore } from "@/lib/store";
import { formatETB } from "@/lib/utils";
import {
  Calendar,
  Search,
  CheckCircle,
  Clock,
  Building2,
  FileCheck2,
  ArrowRight,
  Shield,
  Users,
  Sparkles,
  HelpCircle,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

export default function HomePage() {
  const { departments, services } = useStore();
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");

  const filteredServices = selectedDeptFilter === "ALL"
    ? services.slice(0, 6)
    : services.filter((s) => s.departmentId === selectedDeptFilter);

  const faqs = [
    {
      q: "Can I book an appointment without visiting the Woreda office in person?",
      a: "Yes! Citizens can browse services, review required documents, select an available date and time slot, and receive a confirmed appointment reference code online from any phone or computer.",
    },
    {
      q: "What should I bring on the day of my appointment?",
      a: "Please bring your printed appointment confirmation slip (or reference number on your phone) along with the specific required original documents indicated on your service voucher.",
    },
    {
      q: "Can I reschedule or cancel my appointment if I cannot make it?",
      a: "Yes, you can track and reschedule or cancel your appointment up to 4 hours before the scheduled time slot through the Citizen Portal or the Track Booking page.",
    },
    {
      q: "How does the in-office queue work when I arrive at the Woreda office?",
      a: "Upon arriving at the designated department desk, show your reference code. The officer will verify your details, check you in, and issue a digital queue token (e.g., KBL-02). You will be called to the service counter promptly.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0b2545] via-[#103058] to-[#133b5c] text-white py-16 lg:py-24">
        {/* Subtle patterned overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="relative mt-12 border-t border-white/10 bg-black/20 backdrop-blur-md">
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

      {/* How It Works Workflow */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs uppercase font-bold tracking-widest text-blue-700 mb-2">
              Simple 4-Step Process
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              How the Online Appointment System Works
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Book your slot in advance and experience prompt, dignified service at our local municipal offices.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative group hover:border-blue-400 transition-colors">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-4">
                1
              </span>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Select Department & Service</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Choose the responsible municipal bureau and view exact document requirements and statutory fees.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative group hover:border-blue-400 transition-colors">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-4">
                2
              </span>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Pick Date & Available Slot</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Select your preferred day and time. Only real-time available desk slots will be shown.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative group hover:border-blue-400 transition-colors">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-4">
                3
              </span>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Receive Appointment Slip</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Get an official reference code (e.g., <code className="text-[11px] font-mono bg-slate-200 px-1 py-0.5 rounded">WRD-20261101-001</code>) and printable receipt.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 relative group hover:border-blue-400 transition-colors">
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center mb-4">
                4
              </span>
              <h3 className="font-bold text-slate-900 text-sm mb-1.5">Arrive & Be Served Promptly</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Present your slip at the desk. The officer will verify your file and serve you at your scheduled counter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Government Services Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-xs uppercase font-bold tracking-widest text-emerald-700 mb-1">
                Citizen Service Catalog
              </h2>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                Most Requested Government Services
              </p>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Filter by department and schedule your appointment with required paperwork checklist.
              </p>
            </div>

            {/* Department Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedDeptFilter("ALL")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedDeptFilter === "ALL"
                    ? "bg-[#0b2545] text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                All Departments
              </button>
              {departments.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeptFilter(d.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedDeptFilter === d.id
                      ? "bg-[#0b2545] text-white"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {d.name.split("&")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const dept = departments.find((d) => d.id === service.departmentId);
              return (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {dept?.code || "GOV"}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {service.durationMinutes} mins
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base mb-2 group-hover:text-blue-700 transition-colors">
                      {service.name}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                      {service.description}
                    </p>

                    <div className="space-y-2 mb-4 text-xs">
                      <div className="flex items-center justify-between py-1 border-t border-slate-100">
                        <span className="text-slate-500">Department:</span>
                        <span className="font-medium text-slate-800 text-right">{dept?.name}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-t border-slate-100">
                        <span className="text-slate-500">Statutory Fee:</span>
                        <span className="font-bold text-emerald-700">{formatETB(service.feeETB)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href={`/book?serviceId=${service.id}&deptId=${service.departmentId}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-800 text-white font-semibold text-xs transition-colors"
                    >
                      <Calendar className="w-3.5 h-3.5 text-amber-300" />
                      <span>Book Service</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors"
            >
              <span>View All Government Services Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Departments Directory Section */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs uppercase font-bold tracking-widest text-blue-700 mb-2">
              Administration Directory
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              Woreda Government Departments
            </p>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              Each department is equipped with trained service officers and dedicated counters.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                    {dept.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{dept.name}</h3>
                    <p className="text-[11px] text-emerald-700 font-medium">● Operating Normally</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-4 line-clamp-2">{dept.description}</p>

                <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-200/80 pt-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{dept.buildingRoom}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Mon - Fri (08:30 - 17:30)</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {services.filter((s) => s.departmentId === dept.id).length} services available
                  </span>
                  <Link
                    href={`/book?deptId=${dept.id}`}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                  >
                    Book Desk <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-xs uppercase font-bold tracking-widest text-slate-600 mb-2">
              Citizen Support
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900">
              Frequently Asked Questions
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs"
              >
                <h3 className="font-bold text-slate-900 text-sm flex items-start gap-2.5 mb-2">
                  <HelpCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <span>{faq.q}</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 pl-6 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Public Assistance Banner */}
      <section className="bg-[#0b2545] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              Need Assistance with Government Services?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Our citizen helpdesk is open Monday to Friday, 08:30 AM – 05:30 PM.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/contact"
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold"
            >
              Woreda Helpdesk
            </Link>
            <Link
              href="/book"
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold shadow"
            >
              Book an Appointment
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
