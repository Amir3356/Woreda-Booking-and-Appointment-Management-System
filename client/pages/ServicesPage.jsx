import { useState } from "react";
import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";
import { useStore } from "@/context";
import mockData from "@/data";
import { formatETB } from "@/utils";
import Link from "@/components/ui/Link";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Building,
  FileCheck2,
  AlertCircle,
  X,
  ArrowRight,
} from "lucide-react";

export default function ServicesPage() {
  const { services: storeServices, departments: storeDepartments } = useStore();
  const services = storeServices?.length ? storeServices : mockData.services;
  const departments = storeDepartments?.length ? storeDepartments : mockData.departments;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [activeModalService, setActiveModalService] = useState(null);

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === "ALL" || service.departmentId === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-[11px] uppercase tracking-widest font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Citizen Public Services
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-2">
            Woreda Government Services Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2">
            Explore public services, required documents, statutory fees, and book an appointment with our municipal departments.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services (e.g. ID, Birth, Tax)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => setSelectedDept("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDept === "ALL"
                  ? "bg-[#0b2545] text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              All
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDept(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedDept === d.id
                    ? "bg-[#0b2545] text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {d.code}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
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
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono">
                      {service.code}
                    </span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {service.durationMinutes} mins
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-2 group-hover:text-blue-700 transition-colors">
                    {service.name}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                    {service.description}
                  </p>

                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span>Department:</span>
                      <span className="font-semibold text-slate-800 text-right">{dept?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Statutory Fee:</span>
                      <span className="font-bold text-emerald-700">{formatETB(service.feeETB)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => setActiveModalService(service)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors text-center"
                  >
                    View Checklist
                  </button>
                  <Link
                    href={`/book?serviceId=${service.id}&deptId=${service.departmentId}`}
                    className="flex-1 px-3 py-2 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-semibold transition-colors text-center flex items-center justify-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-300" />
                    <span>Book Desk</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Service Details & Requirements Modal */}
        {activeModalService && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setActiveModalService(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-8 mb-4">
                <span className="text-[10px] uppercase font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {activeModalService.code}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-2">
                  {activeModalService.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {departments.find((d) => d.id === activeModalService.departmentId)?.name}
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Service Description
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    {activeModalService.description}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <h4 className="font-bold text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                    Required Documents Checklist
                  </h4>
                  <ul className="space-y-1.5 text-amber-800 pl-4 list-disc">
                    {activeModalService.requiredDocuments.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block font-medium">Estimated Duration:</span>
                    <p className="font-bold text-slate-800">{activeModalService.durationMinutes} minutes</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Statutory Fee:</span>
                    <p className="font-bold text-emerald-700">{formatETB(activeModalService.feeETB)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setActiveModalService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <Link
                  href={`/book?serviceId=${activeModalService.id}&deptId=${activeModalService.departmentId}`}
                  className="px-5 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-300" />
                  <span>Book Appointment Now</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

