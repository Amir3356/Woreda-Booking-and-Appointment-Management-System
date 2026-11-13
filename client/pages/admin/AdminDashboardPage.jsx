import {
  Users,
  Calendar,
  MapPin,
  Building2,
  Flame,
  BarChart2,
  PieChart as PieIcon,
  TrendingUp,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  geographicalSummary,
  locationUsageData,
  locationShareData,
  woredaUsageData,
  kebeleUsageData,
  fulfillmentStatusData,
} from "@/data/geographicalAnalyticsData";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Geographical Usage Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Live System Insights
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Insights into citizen registrations, appointment bookings, and service usage across locations, Woredas, and Kebeles.
          </p>
        </div>
      </div>

      {/* KPI Analytical Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Users */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Registered Users</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {geographicalSummary.totalRegisteredUsers.toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold inline-flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> Across {geographicalSummary.activeLocationsCount} Sub-Cities
          </span>
        </div>

        {/* Total Bookings */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Bookings</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-[#0b2545]">
            {geographicalSummary.totalBookings.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Across {geographicalSummary.activeWoredasCount} Woredas
          </span>
        </div>

        {/* Most Active Location */}
        <div className="bg-white p-4.5 rounded-2xl border border-blue-200/80 shadow-xs bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">Most Active Location</span>
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <MapPin className="w-4 h-4" />
            </span>
          </div>
          <p className="text-lg font-extrabold text-blue-950 truncate">
            {geographicalSummary.mostActiveLocation.name}
          </p>
          <span className="text-[11px] text-blue-700 font-bold block mt-1">
            {geographicalSummary.mostActiveLocation.bookings.toLocaleString()} bookings ({geographicalSummary.mostActiveLocation.share})
          </span>
        </div>

        {/* Woreda Usage Extremes */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Woreda Extremes</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-bold truncate">▲ {geographicalSummary.woredaExtremes.highest.name}</span>
              <span className="font-mono text-[11px] font-semibold text-slate-700">{geographicalSummary.woredaExtremes.highest.bookings}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-600 font-bold truncate">▼ {geographicalSummary.woredaExtremes.lowest.name}</span>
              <span className="font-mono text-[11px] font-semibold text-slate-500">{geographicalSummary.woredaExtremes.lowest.bookings}</span>
            </div>
          </div>
        </div>

        {/* Kebele Usage Extremes */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kebele Extremes</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-bold truncate">▲ {geographicalSummary.kebeleExtremes.highest.name}</span>
              <span className="font-mono text-[11px] font-semibold text-slate-700">{geographicalSummary.kebeleExtremes.highest.bookings}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-600 font-bold truncate">▼ {geographicalSummary.kebeleExtremes.lowest.name}</span>
              <span className="font-mono text-[11px] font-semibold text-slate-500">{geographicalSummary.kebeleExtremes.lowest.bookings}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Most Active Area Highlight Card */}
      <div className="bg-gradient-to-r from-[#0b2545] to-[#133b5c] p-4.5 rounded-2xl text-white shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-white/10 text-amber-300 border border-white/10 shrink-0">
            <Award className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-amber-300">
                {geographicalSummary.mostActiveArea.badge}
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-mono">
                Top Jurisdiction
              </span>
            </div>
            <h3 className="text-base font-bold text-white mt-0.5">
              {geographicalSummary.mostActiveArea.title}
            </h3>
            <p className="text-xs text-slate-200 mt-0.5">
              {geographicalSummary.mostActiveArea.summary}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium shrink-0 bg-white/10 px-3.5 py-2 rounded-xl border border-white/10">
          <div>
            <span className="text-slate-300 block text-[10px] uppercase">Registered Citizens</span>
            <span className="font-bold text-white text-sm">2,840</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          <div>
            <span className="text-slate-300 block text-[10px] uppercase">Total Bookings</span>
            <span className="font-bold text-amber-300 text-sm">5,620</span>
          </div>
        </div>
      </div>

      {/* Row 1: Location Usage (Bar graph) & Location Booking Share (Pie chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Location Usage Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#0b2545]" />
                <h3 className="font-bold text-slate-900 text-sm">Location Usage</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Number of registered users and appointment bookings across locations
              </p>
            </div>
          </div>
          <div className="w-full h-[290px] min-h-[290px]">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart
                data={locationUsageData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="location"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar
                  dataKey="bookings"
                  name="Appointment Bookings"
                  fill="#0b2545"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="users"
                  name="Registered Citizens"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Location Booking Share Pie Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Location Booking Share</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Geographical percentage distribution of appointments
              </p>
            </div>
          </div>
          <div className="w-full h-[290px] min-h-[290px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={locationShareData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {locationShareData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value.toLocaleString()} bookings`, "Volume"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Woreda Usage Distribution (Bar graph) & Kebele Usage Extremes (Bar graph) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Woreda Usage Bar Graph */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Woreda Usage (Highest to Lowest)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Identification of highest and lowest Woredas by citizen activity and bookings
              </p>
            </div>
          </div>
          <div className="w-full h-[290px] min-h-[290px]">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart
                data={woredaUsageData}
                margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="woreda"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar
                  dataKey="bookings"
                  name="Appointment Bookings"
                  fill="#1d4ed8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="users"
                  name="Registered Citizens"
                  fill="#38bdf8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Kebele Usage Bar Graph */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Kebele Usage (Highest vs. Lowest)</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison of most active and least active Kebeles across the jurisdiction
              </p>
            </div>
          </div>
          <div className="w-full h-[290px] min-h-[290px]">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart
                data={kebeleUsageData}
                margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="kebele"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar
                  dataKey="bookings"
                  name="Appointment Bookings"
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="users"
                  name="Registered Citizens"
                  fill="#a7f3d0"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Geographical Service Fulfillment Pie Chart & Geographical Comparison Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Geographical Comparison Bar Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Geographical Comparison</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparative user activity and appointment booking statistics across locations
              </p>
            </div>
          </div>
          <div className="w-full h-[290px] min-h-[290px]">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart
                data={locationUsageData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="location"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  unit="%"
                  domain={[70, 100]}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="bookings"
                  name="Total Bookings"
                  fill="#7c3aed"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="fulfillmentRate"
                  name="Fulfillment Rate (%)"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Service Fulfillment Distribution Pie Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Service Fulfillment Status</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Outcome breakdown for geographical appointment requests
              </p>
            </div>
          </div>
          <div className="w-full h-[290px] min-h-[290px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height={290}>
              <PieChart>
                <Pie
                  data={fulfillmentStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {fulfillmentStatusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value.toLocaleString()} requests`, "Total"]}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
