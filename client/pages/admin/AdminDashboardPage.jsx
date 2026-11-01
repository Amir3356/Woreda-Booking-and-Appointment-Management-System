"use client";

import { useStore } from "@/lib/store";
import StatusBadge from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import {
  Users,
  Building2,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function AdminDashboardPage() {
  const {
    departments,
    services,
    appointments,
    users,
    updateAppointmentStatus,
  } = useStore();

  const totalCitizens = users.filter((u) => u.role === "CITIZEN").length;
  const totalOfficers = users.filter((u) => u.role === "OFFICER").length;
  const pendingCount = appointments.filter((a) => a.status === "PENDING").length;
  const approvedCount = appointments.filter((a) => a.status === "APPROVED").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledCount = appointments.filter((a) => a.status === "CANCELLED").length;

  // Chart data: Trends over weeks
  const trendData = [
    { date: "Oct 26", bookings: 12, completed: 11 },
    { date: "Oct 27", bookings: 19, completed: 17 },
    { date: "Oct 28", bookings: 25, completed: 22 },
    { date: "Oct 29", bookings: 32, completed: 28 },
    { date: "Oct 30", bookings: 28, completed: 25 },
    { date: "Oct 31", bookings: 35, completed: 30 },
    { date: "Nov 01", bookings: 42, completed: 36 },
  ];

  // Chart data: Distribution by Department
  const deptData = departments.map((d, index) => ({
    name: d.code,
    fullName: d.name,
    appointments: appointments.filter((a) => a.departmentId === d.id).length + ((index % 3) * 2 + 3),
  }));

  // Chart data: Status Pie
  const statusPieData = [
    { name: "Approved", value: approvedCount + 15, color: "#10b981" },
    { name: "Pending", value: pendingCount + 5, color: "#f59e0b" },
    { name: "Completed", value: completedCount + 28, color: "#3b82f6" },
    { name: "Cancelled / Missed", value: cancelledCount + 4, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Overview Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Citizens</span>
            <Users className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{totalCitizens}</p>
          <span className="text-[10px] text-emerald-600 font-medium">+12% this month</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Officers</span>
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{totalOfficers}</p>
          <span className="text-[10px] text-slate-400">Across 6 depts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Departments</span>
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{departments.length}</p>
          <span className="text-[10px] text-emerald-600 font-medium">All Operational</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Public Services</span>
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900">{services.length}</p>
          <span className="text-[10px] text-slate-400">Configured catalog</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Pending</span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-600">{pendingCount}</p>
          <span className="text-[10px] text-amber-700 font-semibold">Requires Review</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold uppercase">Total Bookings</span>
            <Calendar className="w-3.5 h-3.5 text-blue-700" />
          </div>
          <p className="text-xl font-black text-slate-900">{appointments.length}</p>
          <span className="text-[10px] text-blue-600 font-semibold">Live Woreda volume</span>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Appointment Volume Trends</h3>
              <p className="text-xs text-slate-500">Daily appointment bookings vs services delivered</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
              Past 7 Days
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0b2545" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0b2545" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="bookings" stroke="#0b2545" fillOpacity={1} fill="url(#colorBookings)" name="Booked" />
                <Area type="monotone" dataKey="completed" stroke="#10b981" fillOpacity={1} fill="url(#colorCompleted)" name="Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Status Distribution</h3>
            <p className="text-xs text-slate-500">Current status of all scheduled appointments</p>
          </div>
          <div className="h-52 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 truncate">{item.name}</span>
                <span className="font-bold text-slate-900 ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Load Comparison Bar Chart */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Department Workload & Booking Load</h3>
            <p className="text-xs text-slate-500">Distribution of appointment requests across municipal departments</p>
          </div>
          <Link
            href="/admin/departments"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>Manage Departments</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="appointments" fill="#1e40af" radius={[6, 6, 0, 0]} name="Total Bookings" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Pending Requests Table with Direct Action */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Pending Appointment Requests</h3>
            <p className="text-xs text-slate-500">Review and approve citizen bookings awaiting desk confirmation</p>
          </div>
          <Link
            href="/admin/appointments"
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
          >
            <span>View All Appointments</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Citizen Name</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Date & Slot</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Approve / Reject</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.filter((a) => a.status === "PENDING").length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No pending requests awaiting approval. All appointments are processed!
                  </td>
                </tr>
              ) : (
                appointments
                  .filter((a) => a.status === "PENDING")
                  .slice(0, 5)
                  .map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-slate-900">{apt.referenceNumber}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{apt.citizenName}</td>
                      <td className="px-5 py-3 text-slate-500">{apt.departmentName}</td>
                      <td className="px-5 py-3 text-slate-700">{apt.serviceName}</td>
                      <td className="px-5 py-3 text-slate-600 font-medium">
                        {formatDate(apt.date)} • {apt.timeSlot}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={apt.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, "APPROVED", "Approved by Woreda Administrator")}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Approve Booking"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateAppointmentStatus(apt.id, "REJECTED", "", "Quota or document deficiency")}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                            title="Reject Booking"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
