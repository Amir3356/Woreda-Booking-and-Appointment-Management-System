import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { DataTable, EthiopianFlag } from "@/components/ui";
import { useStore } from "@/context";
import { staffApi } from "@/api";
import { subscribe } from "@/api/realtime";
import {
  Users,
  Search,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 5;

function formatCitizenFromEvent(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    fullName: raw.fullName,
    phone: raw.phone,
    email: raw.email,
    nationalId: raw.nationalId,
    isActive: raw.isActive ?? true,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export default function AdminCitizenManagementPage() {
  // Search state
  const [search, setSearch] = useState("");

  // Cursor-based server-side pagination state (5 items per page)
  const [cursor, setCursor] = useState(0);
  const [serverCitizens, setServerCitizens] = useState([]);
  const [serverTotalRegistered, setServerTotalRegistered] = useState(0);
  const [serverCursorMeta, setServerCursorMeta] = useState({
    current: 0,
    pageSize: PAGE_SIZE,
    totalCount: 0,
    hasPrev: false,
    hasNext: false,
    nextCursor: null,
    prevCursor: null,
  });
  const [loadingPage, setLoadingPage] = useState(false);
  const fetchSeqRef = useRef(0);

  const fetchPagedCitizens = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setLoadingPage(true);
    try {
      const res = await staffApi.listCitizens({
        search,
        cursor,
        pageSize: PAGE_SIZE,
      });
      if (seq !== fetchSeqRef.current) return;
      if (res && Array.isArray(res.data)) {
        const totalReg = res.meta?.totalRegistered ?? 0;
        setServerTotalRegistered(totalReg);
        setServerCitizens(res.data);
        if (res.meta?.cursor) {
          setServerCursorMeta(res.meta.cursor);
          if (cursor > 0 && res.meta.cursor.totalCount <= cursor) {
            setCursor(0);
          }
        }
      }
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setServerCitizens([]);
      setServerTotalRegistered(0);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoadingPage(false);
      }
    }
  }, [search, cursor]);

  useEffect(() => {
    fetchPagedCitizens();
  }, [fetchPagedCitizens]);

  // Real-time WebSocket subscription: updates table immediately when a citizen registers without refresh or polling
  useEffect(() => {
    let active = true;

    const unsubCitizens = subscribe("citizens.changed", (msg) => {
      if (!active) return;
      if (msg?.citizen && cursor === 0) {
        const formatted = formatCitizenFromEvent(msg.citizen);
        const q = search.trim().toLowerCase();
        const matchesSearch =
          !q ||
          (formatted?.fullName || "").toLowerCase().includes(q) ||
          (formatted?.phone || "").toLowerCase().includes(q) ||
          (formatted?.nationalId || "").toLowerCase().includes(q) ||
          (formatted?.email || "").toLowerCase().includes(q);

        if (formatted && matchesSearch) {
          setServerCitizens((prev) => {
            const exists = prev.some((c) => c.id === formatted.id || (c.phone && c.phone === formatted.phone));
            const next = exists
              ? prev.map((c) => (c.id === formatted.id || c.phone === formatted.phone ? { ...c, ...formatted } : c))
              : [formatted, ...prev];
            return next.slice(0, PAGE_SIZE);
          });
        }
      }
      fetchPagedCitizens();
    });

    const unsubReconnect = subscribe("reconnected", () => {
      if (active) fetchPagedCitizens();
    });

    return () => {
      active = false;
      unsubCitizens();
      unsubReconnect();
    };
  }, [cursor, search, fetchPagedCitizens]);

  // Active page data from real server pagination
  const displayedCitizens = serverCitizens;
  const activeCursorMeta = serverCursorMeta;
  const totalRegisteredCount = serverTotalRegistered;

  const handleResetSearch = () => {
    setSearch("");
    setCursor(0);
  };

  const currentPageNumber = Math.floor((activeCursorMeta.current || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((activeCursorMeta.totalCount || 0) / PAGE_SIZE));
  const rangeStart = activeCursorMeta.totalCount === 0 ? 0 : (activeCursorMeta.current || 0) + 1;
  const rangeEnd = Math.min(activeCursorMeta.totalCount || 0, (activeCursorMeta.current || 0) + displayedCitizens.length);

  // Table columns definition: Full Legal Name, Phone Number, National ID, Registered Date, Status
  const citizenColumns = [
    {
      id: "fullName",
      accessorKey: "fullName",
      header: "Fullname",
      sortFn: "text",
      meta: { className: "font-semibold text-slate-900" },
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">
          {row.original.fullName}
        </span>
      ),
    },
    {
      id: "phone",
      accessorKey: "phone",
      header: "Phone Number",
      sortFn: "text",
      meta: { className: "text-slate-600 font-mono text-xs" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <EthiopianFlag className="w-4 h-3 shrink-0 shadow-2xs" />
          <span>{row.original.phone}</span>
        </span>
      ),
    },
    {
      id: "nationalId",
      accessorKey: "nationalId",
      header: "National ID",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-slate-600">
          {row.original.nationalId || "—"}
        </span>
      ),
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: "Registered Date",
      cell: ({ row }) => {
        const d = row.original.createdAt ? new Date(row.original.createdAt) : null;
        return (
          <span className="text-xs text-slate-500">
            {d && !isNaN(d) ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const active = row.original.isActive !== false;
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              active
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {active ? "Active" : "Inactive"}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex items-center w-full min-h-[48px]">
        <div className="w-full text-center">
          <h1 className="text-lg font-extrabold text-slate-800 tracking-tight">
            Citizen Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Directory of registered municipal citizens and contact details
          </p>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>WebSocket Live</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
            <Users className="w-3.5 h-3.5 text-[#0b2545]" />
            <span>{totalRegisteredCount} Registered</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Box */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(0);
            }}
            placeholder="Search by name, phone, national ID..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50/50"
          />
          {search && (
            <button
              onClick={handleResetSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Counter and Reset */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {search && (
            <button
              onClick={handleResetSearch}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200"
              title="Reset search"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <span className="text-xs text-slate-500 font-medium">
            Total: {activeCursorMeta.totalCount} citizen{activeCursorMeta.totalCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Main Content Section - Table with 5 items per page */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <DataTable
          data={displayedCitizens}
          columns={citizenColumns}
          getRowId={(c) => c.id || c.phone}
          initialSorting={[]}
          pageSize={null}
          itemLabel="citizens"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">
                  {totalRegisteredCount === 0
                    ? "No citizens registered yet"
                    : "No matching citizens found"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto text-center">
                  {totalRegisteredCount === 0
                    ? "Citizen records will appear here as citizens register in the system."
                    : "Try adjusting your search query to find citizens."}
                </p>
              </div>
            </div>
          }
        />

        {/* Cursor-Based Pagination Navigation Footer */}
        <div className="bg-slate-50/70 px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
          <p className="text-xs text-slate-500">
            Showing{" "}
            <strong className="text-slate-700">
              {activeCursorMeta.totalCount === 0 ? "0" : `${rangeStart}–${rangeEnd}`}
            </strong>{" "}
            of <strong className="text-slate-700">{activeCursorMeta.totalCount}</strong>{" "}
            {activeCursorMeta.totalCount === 1 ? "citizen" : "citizens"}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeCursorMeta.prevCursor !== null && activeCursorMeta.prevCursor !== undefined) {
                  setCursor(activeCursorMeta.prevCursor);
                } else {
                  setCursor((prev) => Math.max(0, prev - PAGE_SIZE));
                }
              }}
              disabled={!activeCursorMeta.hasPrev || loadingPage}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Previous page"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              Page {currentPageNumber} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => {
                if (activeCursorMeta.nextCursor !== null && activeCursorMeta.nextCursor !== undefined) {
                  setCursor(activeCursorMeta.nextCursor);
                } else {
                  setCursor((prev) => prev + PAGE_SIZE);
                }
              }}
              disabled={!activeCursorMeta.hasNext || loadingPage}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Next page"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
