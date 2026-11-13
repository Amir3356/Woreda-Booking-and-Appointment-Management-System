import { useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  Layers,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldCheck,
  Compass,
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
import { useStore } from "@/context";
import { reportApi } from "@/api";
import { subscribe } from "@/api/realtime";

function parseAddress(addr) {
  if (!addr) return { kebele: "Kebele 01", woreda: "Woreda 01", location: "Central Sub-City" };
  const parts = String(addr).split(",").map((s) => s.trim()).filter(Boolean);
  let kebele = "";
  let woreda = "";
  let location = "";

  for (const p of parts) {
    const low = p.toLowerCase();
    if (!kebele && (low.startsWith("kebele") || low.startsWith("keb"))) {
      kebele = p;
    } else if (!woreda && (low.startsWith("woreda") || low.startsWith("wor"))) {
      woreda = p;
    } else if (!location && !low.startsWith("house") && !/^\d+$/.test(p)) {
      location = p;
    }
  }

  if (!kebele && parts[0]) {
    const p0 = parts[0];
    kebele = /^\d+$/.test(p0) ? `Kebele ${p0.padStart(2, "0")}` : (p0.toLowerCase().startsWith("kebele") ? p0 : `Kebele ${p0}`);
  }
  if (!woreda && parts[1]) {
    const p1 = parts[1];
    woreda = /^\d+$/.test(p1) ? `Woreda ${p1.padStart(2, "0")}` : (p1.toLowerCase().startsWith("woreda") ? p1 : `Woreda ${p1}`);
  }
  if (!location && parts[2]) {
    location = parts[2];
  } else if (!location && parts[0] && !/^\d+$/.test(parts[0]) && !parts[0].toLowerCase().startsWith("kebele") && !parts[0].toLowerCase().startsWith("woreda")) {
    location = parts[0];
  }

  return {
    kebele: kebele || "Kebele 01",
    woreda: woreda || "Woreda 01",
    location: location || "Central Sub-City",
  };
}

function computeClientGeoMetrics(appointments = [], citizens = []) {
  const palette = ["#0b2545", "#1d4ed8", "#059669", "#d97706", "#7c3aed", "#64748b", "#ec4899", "#06b6d4"];

  const locationMap = {};
  const woredaMap = {};
  const kebeleMap = {};

  citizens.forEach((c) => {
    const geo = parseAddress(c.address || c.locations || c.location);
    if (!locationMap[geo.location]) locationMap[geo.location] = { name: geo.location, users: 0, bookings: 0, completed: 0 };
    locationMap[geo.location].users++;

    if (!woredaMap[geo.woreda]) woredaMap[geo.woreda] = { name: geo.woreda, location: geo.location, users: 0, bookings: 0 };
    woredaMap[geo.woreda].users++;

    if (!kebeleMap[geo.kebele]) kebeleMap[geo.kebele] = { name: geo.kebele, woreda: geo.woreda, location: geo.location, users: 0, bookings: 0 };
    kebeleMap[geo.kebele].users++;
  });

  let completedCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;

  appointments.forEach((a) => {
    const geo = parseAddress(a.address || a.location || a.citizenAddress);
    if (!locationMap[geo.location]) locationMap[geo.location] = { name: geo.location, users: 0, bookings: 0, completed: 0 };
    locationMap[geo.location].bookings++;

    if (!woredaMap[geo.woreda]) woredaMap[geo.woreda] = { name: geo.woreda, location: geo.location, users: 0, bookings: 0 };
    woredaMap[geo.woreda].bookings++;

    if (!kebeleMap[geo.kebele]) kebeleMap[geo.kebele] = { name: geo.kebele, woreda: geo.woreda, location: geo.location, users: 0, bookings: 0 };
    kebeleMap[geo.kebele].bookings++;

    if (a.status === "COMPLETED") {
      completedCount++;
      locationMap[geo.location].completed++;
    } else if (["CANCELLED", "REJECTED", "NO_SHOW"].includes(a.status)) {
      cancelledCount++;
    } else {
      pendingCount++;
    }
  });

  const sortedLocations = Object.values(locationMap).sort((a, b) => b.bookings - a.bookings || b.users - a.users);
  const sortedWoredas = Object.values(woredaMap).sort((a, b) => b.bookings - a.bookings || b.users - a.users);
  const sortedKebeles = Object.values(kebeleMap).sort((a, b) => b.bookings - a.bookings || b.users - a.users);

  const totalBookings = appointments.length;
  const topLoc = sortedLocations[0] || { name: "Central Sub-City", users: citizens.length, bookings: totalBookings };
  const topWoreda = sortedWoredas[0] || { name: "Woreda 01", location: topLoc.name, users: citizens.length, bookings: totalBookings };
  const lowWoreda = sortedWoredas[sortedWoredas.length - 1] || topWoreda;
  const topKebele = sortedKebeles[0] || { name: "Kebele 01", woreda: topWoreda.name, users: citizens.length, bookings: totalBookings };
  const lowKebele = sortedKebeles[sortedKebeles.length - 1] || topKebele;

  return {
    geographicalSummary: {
      totalRegisteredUsers: citizens.length,
      totalBookings,
      activeLocationsCount: sortedLocations.length || (citizens.length > 0 ? 1 : 0),
      activeWoredasCount: sortedWoredas.length || (citizens.length > 0 ? 1 : 0),
      activeKebelesCount: sortedKebeles.length || (citizens.length > 0 ? 1 : 0),
      mostActiveLocation: {
        name: topLoc.name,
        users: topLoc.users,
        bookings: topLoc.bookings,
        share: totalBookings > 0 ? `${((topLoc.bookings / totalBookings) * 100).toFixed(1)}%` : "0%",
      },
      woredaExtremes: {
        highest: {
          name: topWoreda.name,
          location: topWoreda.location,
          users: topWoreda.users,
          bookings: topWoreda.bookings,
        },
        lowest: {
          name: lowWoreda.name,
          location: lowWoreda.location,
          users: lowWoreda.users,
          bookings: lowWoreda.bookings,
        },
      },
      kebeleExtremes: {
        highest: {
          name: topKebele.name,
          woreda: topKebele.woreda,
          users: topKebele.users,
          bookings: topKebele.bookings,
        },
        lowest: {
          name: lowKebele.name,
          woreda: lowKebele.woreda,
          users: lowKebele.users,
          bookings: lowKebele.bookings,
        },
      },
      mostActiveArea: {
        title: `${topLoc.name} · ${topWoreda.name} · ${topKebele.name}`,
        badge: "Highest System Traffic",
        summary: "Leading across registered citizens, appointment slots, and online service completions.",
        users: topLoc.users,
        bookings: topLoc.bookings,
      },
    },
    locationUsageData: sortedLocations.map((l) => ({
      location: l.name,
      users: l.users,
      bookings: l.bookings,
      fulfillmentRate: l.bookings > 0 ? Math.round((l.completed / l.bookings) * 100) : 0,
    })),
    locationShareData: sortedLocations.map((l, i) => ({
      name: l.name,
      value: l.bookings,
      color: palette[i % palette.length],
    })),
    woredaUsageData: sortedWoredas.map((w, i) => ({
      woreda: w.name,
      users: w.users,
      bookings: w.bookings,
      rank: i === 0 ? "Highest" : i === sortedWoredas.length - 1 ? "Lowest" : "Moderate",
    })),
    kebeleUsageData: sortedKebeles.map((k, i) => ({
      kebele: k.name,
      users: k.users,
      bookings: k.bookings,
      status: i === 0 ? "Highest Active" : i === sortedKebeles.length - 1 ? "Lowest Active" : "Moderate Active",
    })),
    fulfillmentStatusData: [
      { name: "Completed Desk Visits", value: completedCount, color: "#10b981" },
      { name: "Pending / Upcoming", value: pendingCount, color: "#3b82f6" },
      { name: "Cancelled / No-Show", value: cancelledCount, color: "#f43f5e" },
    ],
  };
}

function CustomChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-slate-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/60 text-xs">
      <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-1 mb-2">
        {label}
      </div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-white">
              {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
              {entry.unit || ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [serverData, setServerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [perspective, setPerspective] = useState("overview"); // "overview" | "locations" | "woredas"

  const appointments = useStore((s) => s.appointments) || [];
  const loadAppointments = useStore((s) => s.loadAppointments);
  const registeredCitizens = useStore((s) => s.registeredCitizens) || [];

  const loadRealAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.geographical();
      if (res?.data) {
        setServerData(res.data);
      }
    } catch {
      // Fallback relies on client store
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRealAnalytics();
    loadAppointments?.().catch(() => {});

    let timer = null;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadRealAnalytics();
        loadAppointments?.().catch(() => {});
      }, 300);
    };

    const offs = [
      subscribe("appointments.changed", reload),
      subscribe("catalog.changed", reload),
      subscribe("reconnected", reload),
    ];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [loadRealAnalytics, loadAppointments]);

  const fallbackData = useMemo(() => {
    return computeClientGeoMetrics(appointments, registeredCitizens);
  }, [appointments, registeredCitizens]);

  const data = serverData || fallbackData;
  const summary = data.geographicalSummary;
  const locationUsageData = data.locationUsageData;
  const locationShareData = data.locationShareData;
  const woredaUsageData = data.woredaUsageData;
  const kebeleUsageData = data.kebeleUsageData;
  const fulfillmentStatusData = data.fulfillmentStatusData;

  const completionCount = fulfillmentStatusData[0]?.value || 0;
  const completionRate = summary.totalBookings > 0 ? Math.round((completionCount / summary.totalBookings) * 100) : 0;
  const citizenEngagementRate = (summary.totalBookings / (summary.totalRegisteredUsers || 1)).toFixed(1);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Executive Intelligence Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Spatial Demographics & Geographical Intelligence
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 inline-flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time municipal jurisdiction distribution across Sub-Cities, Woredas, and grassroots Kebeles.
          </p>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPerspective("overview")}
              className={`geo-perspective-btn ${perspective === "overview" ? "active" : ""}`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>
            <button
              type="button"
              onClick={() => setPerspective("locations")}
              className={`geo-perspective-btn ${perspective === "locations" ? "active" : ""}`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Sub-Cities</span>
            </button>
            <button
              type="button"
              onClick={() => setPerspective("woredas")}
              className={`geo-perspective-btn ${perspective === "woredas" ? "active" : ""}`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Woredas & Kebeles</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadRealAnalytics()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Asymmetric Executive Hero & Core KPI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Primary Hero: Territorial Command Anchor (Span 2) */}
        <div className="lg:col-span-2 geo-hero-panel flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30">
                <Award className="w-3.5 h-3.5 text-amber-300" />
                <span>{summary.mostActiveArea.badge}</span>
              </span>
              <span className="text-[11px] font-mono text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                Woreda Municipal Jurisdiction
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {summary.mostActiveArea.title}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                {summary.mostActiveArea.summary}
              </p>
            </div>
          </div>

          {/* Key Metric Indicators inside Hero */}
          <div className="grid grid-cols-3 gap-3 pt-6 mt-4 border-t border-white/10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                Appointment Traffic
              </span>
              <span className="text-xl font-black text-amber-300 mt-0.5 block">
                {(summary.mostActiveArea?.bookings ?? 0).toLocaleString()}
                <span className="text-xs font-medium text-amber-200/80 ml-1">bookings</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                Citizen Footprint
              </span>
              <span className="text-xl font-black text-white mt-0.5 block">
                {(summary.mostActiveArea?.users ?? 0).toLocaleString()}
                <span className="text-xs font-medium text-slate-300 ml-1">residents</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                Territory Share
              </span>
              <span className="text-xl font-black text-emerald-400 mt-0.5 block">
                {summary.mostActiveLocation.share}
                <span className="text-xs font-medium text-emerald-300/80 ml-1">of city volume</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: High-Craft Operational Counters */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Total Bookings Card */}
          <div className="geo-stat-card flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Total Bookings</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div>
              <p className="text-3xl font-black text-[#0b2545] tracking-tight">
                {summary.totalBookings.toLocaleString()}
              </p>
              <div className="flex items-center gap-3 mt-2 text-[11px] font-medium text-slate-500">
                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {completionCount} Completed
                </span>
                <span className="text-slate-300">•</span>
                <span>Across {summary.activeWoredasCount} Woredas</span>
              </div>
            </div>
          </div>

          {/* Registered Citizens Card */}
          <div className="geo-stat-card flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Registered Citizens</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                {summary.totalRegisteredUsers.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-emerald-600">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Verified Citizen Profiles</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Administrative Territory Extremes Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Sub-Cities */}
        <div className="geo-stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sub-Cities Active</span>
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-black text-slate-900 mt-1">
            {summary.activeLocationsCount}
            <span className="text-xs font-medium text-slate-500 ml-1.5">jurisdictions</span>
          </p>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Top: <strong className="text-slate-800">{summary.mostActiveLocation.name}</strong>
          </span>
        </div>

        {/* Woreda Extremes */}
        <div className="geo-stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Woreda Extremes</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-bold truncate">▲ {summary.woredaExtremes.highest.name}</span>
              <span className="font-mono text-[11px] font-extrabold text-slate-800">{summary.woredaExtremes.highest.bookings}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-600 font-semibold truncate">▼ {summary.woredaExtremes.lowest.name}</span>
              <span className="font-mono text-[11px] font-medium text-slate-500">{summary.woredaExtremes.lowest.bookings}</span>
            </div>
          </div>
        </div>

        {/* Kebele Extremes */}
        <div className="geo-stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kebele Extremes</span>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div className="space-y-1 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-bold truncate">▲ {summary.kebeleExtremes.highest.name}</span>
              <span className="font-mono text-[11px] font-extrabold text-slate-800">{summary.kebeleExtremes.highest.bookings}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-rose-600 font-semibold truncate">▼ {summary.kebeleExtremes.lowest.name}</span>
              <span className="font-mono text-[11px] font-medium text-slate-500">{summary.kebeleExtremes.lowest.bookings}</span>
            </div>
          </div>
        </div>

        {/* Citizen Engagement Ratio */}
        <div className="geo-stat-card">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Service Frequency</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-black text-[#0b2545] mt-1">
            {citizenEngagementRate}
            <span className="text-xs font-medium text-slate-500 ml-1.5">bookings / citizen</span>
          </p>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
            High Civic Utilization
          </span>
        </div>
      </div>

      {/* 4. Sub-City Location Distribution & Territorial Leaderboard */}
      {(perspective === "overview" || perspective === "locations") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sub-City Usage Dual-Bar Chart */}
          <div className="lg:col-span-2 geo-card-elevated p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#0b2545]" />
                  <h3 className="font-bold text-slate-900 text-sm">Sub-City Service Volume & Citizen Base</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparison between total appointments booked and registered citizens by location
                </p>
              </div>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                {locationUsageData.length} Territories
              </span>
            </div>

            <div className="w-full h-[300px] min-h-[300px]">
              {locationUsageData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  No location usage records registered yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={locationUsageData}
                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="location"
                      tick={{ fontSize: 11, fill: "#475569", fontWeight: 600 }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar
                      dataKey="bookings"
                      name="Appointment Bookings"
                      fill="#0b2545"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="users"
                      name="Registered Citizens"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Territorial Leaderboard & Donut Chart */}
          <div className="geo-card-elevated p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Territory Share</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Proportional booking distribution
                </p>
              </div>
            </div>

            <div className="w-full h-[180px] min-h-[180px] flex items-center justify-center relative">
              {locationShareData.length === 0 || summary.totalBookings === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  No bookings recorded yet.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={locationShareData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {locationShareData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Stat Inside Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-base font-black text-slate-900">{summary.totalBookings}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bookings</span>
                  </div>
                </>
              )}
            </div>

            {/* Territory Breakdown Ranking List */}
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {locationUsageData.map((item, idx) => {
                const sharePct = summary.totalBookings > 0 ? Math.round((item.bookings / summary.totalBookings) * 100) : 0;
                return (
                  <div key={item.location} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800 truncate">{item.location}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-extrabold text-[#0b2545]">{item.bookings} bks</span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        {sharePct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. Woreda and Kebele Administrative Granularity */}
      {(perspective === "overview" || perspective === "woredas") && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Woreda Ranking Chart */}
          <div className="geo-card-elevated p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-[#0b2545]" />
                  <h3 className="font-bold text-slate-900 text-sm">Woreda Level Usage Distribution</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparative performance and citizen activity across municipal Woredas
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#0b2545] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                {woredaUsageData.length} Woredas
              </span>
            </div>

            <div className="w-full h-[280px] min-h-[280px]">
              {woredaUsageData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  No woreda booking data recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={woredaUsageData}
                    margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="woreda"
                      tick={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar
                      dataKey="bookings"
                      name="Appointment Bookings"
                      fill="#1d4ed8"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="users"
                      name="Registered Citizens"
                      fill="#38bdf8"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Kebele Ranking Chart */}
          <div className="geo-card-elevated p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Grassroots Kebele Activity</h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Grassroots citizen engagement and localized booking concentration
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                {kebeleUsageData.length} Kebeles
              </span>
            </div>

            <div className="w-full h-[280px] min-h-[280px]">
              {kebeleUsageData.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  No kebele booking data recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={kebeleUsageData}
                    margin={{ top: 10, right: 15, left: -10, bottom: 25 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="kebele"
                      tick={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar
                      dataKey="bookings"
                      name="Appointment Bookings"
                      fill="#059669"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="users"
                      name="Registered Citizens"
                      fill="#6ee7b7"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Service Delivery Efficiency & Outcomes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Fulfillment Status Donut */}
        <div className="geo-card-elevated p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Service Delivery Status</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Outcome breakdown for scheduled citizen requests
              </p>
            </div>
          </div>

          <div className="w-full h-[220px] min-h-[220px] flex items-center justify-center relative">
            {summary.totalBookings === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                No service fulfillment requests recorded yet.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={fulfillmentStatusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                    >
                      {fulfillmentStatusData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Stat */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-black text-emerald-600">{completionRate}%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fulfilled</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            {fulfillmentStatusData.map((f) => (
              <div key={f.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                  {f.name}
                </span>
                <span className="font-mono font-bold text-slate-800">{f.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Executive Metric Matrix */}
        <div className="lg:col-span-2 geo-card-elevated p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm">Geographical Performance Matrix</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Key operational benchmark metrics aggregated across all municipal areas
              </p>
            </div>
            <span className="text-xs font-bold text-[#0b2545] bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
              Civic Benchmark
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-auto py-2">
            {/* Metric 1 */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                Fulfillment Efficiency
              </span>
              <p className="text-3xl font-black text-emerald-700 mt-1">
                {completionRate}%
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1">
                Successful citizen service completions at counter desks.
              </p>
            </div>

            {/* Metric 2 */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">
                Citizen Utilization
              </span>
              <p className="text-3xl font-black text-blue-700 mt-1">
                {citizenEngagementRate}
              </p>
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                Average appointment bookings per registered resident.
              </p>
            </div>

            {/* Metric 3 */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                Woreda Density
              </span>
              <p className="text-3xl font-black text-[#0b2545] mt-1">
                {summary.activeWoredasCount > 0 ? Math.round(summary.totalBookings / summary.activeWoredasCount) : 0}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                Average appointment volume handled per active Woreda.
              </p>
            </div>

            {/* Metric 4 */}
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                Grassroots Kebele Coverage
              </span>
              <p className="text-3xl font-black text-amber-700 mt-1">
                {summary.activeKebelesCount}
              </p>
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                Distinct grassroots communities actively booking municipal services.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Spatial intelligence synchronized in real-time via WebSocket domain events.</span>
            <span className="font-semibold text-slate-700">Woreda Admin RBAC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
