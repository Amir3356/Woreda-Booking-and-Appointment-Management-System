import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { DataTable, EthiopianFlag } from "@/components/ui";
import { useStore } from "@/context";
import { staffApi } from "@/api";
import { subscribe } from "@/api/realtime";
import mockCitizensData from "@/data/mockCitizens.json";
import {
  Users,
  Search,
  Filter,
  X,
  MapPin,
  Building,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 5;

function formatCitizenFromEvent(raw) {
  if (!raw) return null;
  const parts = (raw.address || "").split(",").map((s) => s.trim()).filter(Boolean);
  const kebele = parts.find((p) => p.toLowerCase().startsWith("kebele")) || "Kebele 03";
  const woreda = parts.find((p) => p.toLowerCase().startsWith("woreda")) || "Woreda 03";
  const location =
    parts
      .filter(
        (p) =>
          !p.toLowerCase().startsWith("kebele") &&
          !p.toLowerCase().startsWith("woreda") &&
          !p.toLowerCase().startsWith("house"),
      )
      .join(", ") || "Addis Ababa";
  return {
    id: raw.id,
    fullName: raw.fullName,
    phone: raw.phone,
    locations: location,
    woreda,
    kebele,
    isActive: raw.isActive ?? true,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

export default function AdminCitizenManagementPage() {
  const { registeredCitizens = [] } = useStore();

  // Filters & search state
  const [search, setSearch] = useState("");
  const [selectedWoreda, setSelectedWoreda] = useState("ALL");
  const [selectedKebele, setSelectedKebele] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");

  // Cursor-based server-side pagination state (5 real or mock items per page)
  const [cursor, setCursor] = useState(0);
  const [serverCitizens, setServerCitizens] = useState([]);
  const [hasRealServerData, setHasRealServerData] = useState(false);
  const [serverTotalRegistered, setServerTotalRegistered] = useState(0);
  const [serverFilters, setServerFilters] = useState({ woredas: [], kebeles: [], locations: [] });
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
        woreda: selectedWoreda,
        kebele: selectedKebele,
        location: selectedLocation,
        cursor,
        pageSize: PAGE_SIZE,
      });
      if (seq !== fetchSeqRef.current) return;
      if (res && Array.isArray(res.data)) {
        const totalReg = res.meta?.totalRegistered ?? 0;
        setHasRealServerData(totalReg > 0);
        setServerTotalRegistered(totalReg);
        if (res.meta?.filters) {
          setServerFilters(res.meta.filters);
        }
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
      // Fall back gracefully to store + mock data if unauthenticated or offline
      setHasRealServerData(false);
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoadingPage(false);
      }
    }
  }, [search, selectedWoreda, selectedKebele, selectedLocation, cursor]);

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
          (formatted?.locations || "").toLowerCase().includes(q) ||
          (formatted?.woreda || "").toLowerCase().includes(q) ||
          (formatted?.kebele || "").toLowerCase().includes(q);
        const matchesFilters =
          (selectedWoreda === "ALL" || formatted?.woreda === selectedWoreda) &&
          (selectedKebele === "ALL" || formatted?.kebele === selectedKebele) &&
          (selectedLocation === "ALL" || formatted?.locations === selectedLocation);

        if (formatted && matchesSearch && matchesFilters) {
          setHasRealServerData(true);
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

    const handleStorageChange = (e) => {
      if (e.key === "woreda-booking-storage") {
        try {
          useStore.persist?.rehydrate?.();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      active = false;
      unsubCitizens();
      unsubReconnect();
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [cursor, search, selectedWoreda, selectedKebele, selectedLocation, fetchPagedCitizens]);

  // Fallback mock + store pool (used when the database has 0 real citizens or server is offline)
  const mockPool = useMemo(() => {
    const map = new Map();
    mockCitizensData.forEach((c) => {
      if (c.phone) map.set(c.phone, c);
    });
    (registeredCitizens || []).forEach((c) => {
      if (c.phone) map.set(c.phone, { ...map.get(c.phone), ...c });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt) - new Date(a.createdAt);
      if (a.createdAt) return -1;
      if (b.createdAt) return 1;
      return 0;
    });
  }, [registeredCitizens]);

  const mockWoredaOptions = useMemo(
    () => Array.from(new Set(mockPool.map((c) => c.woreda).filter(Boolean))).sort(),
    [mockPool],
  );

  const mockKebeleOptions = useMemo(() => {
    const list = selectedWoreda === "ALL" ? mockPool : mockPool.filter((c) => c.woreda === selectedWoreda);
    return Array.from(new Set(list.map((c) => c.kebele).filter(Boolean))).sort();
  }, [mockPool, selectedWoreda]);

  const mockLocationOptions = useMemo(
    () => Array.from(new Set(mockPool.map((c) => c.locations).filter(Boolean))).sort(),
    [mockPool],
  );

  const filteredMockCitizens = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mockPool.filter((c) => {
      const matchesSearch =
        !q ||
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.locations && c.locations.toLowerCase().includes(q)) ||
        (c.woreda && c.woreda.toLowerCase().includes(q)) ||
        (c.kebele && c.kebele.toLowerCase().includes(q));

      const matchesWoreda = selectedWoreda === "ALL" || c.woreda === selectedWoreda;
      const matchesKebele = selectedKebele === "ALL" || c.kebele === selectedKebele;
      const matchesLocation = selectedLocation === "ALL" || c.locations === selectedLocation;

      return matchesSearch && matchesWoreda && matchesKebele && matchesLocation;
    });
  }, [mockPool, search, selectedWoreda, selectedKebele, selectedLocation]);

  useEffect(() => {
    if (!hasRealServerData && cursor > 0 && cursor >= filteredMockCitizens.length) {
      setCursor(0);
    }
  }, [hasRealServerData, cursor, filteredMockCitizens.length]);

  const mockCursorState = useMemo(() => {
    const totalCount = filteredMockCitizens.length;
    const safeCursor = cursor >= totalCount && totalCount > 0 ? 0 : cursor;
    const hasPrev = safeCursor > 0;
    const hasNext = safeCursor + PAGE_SIZE < totalCount;
    return {
      rows: filteredMockCitizens.slice(safeCursor, safeCursor + PAGE_SIZE),
      meta: {
        current: safeCursor,
        pageSize: PAGE_SIZE,
        totalCount,
        hasPrev,
        hasNext,
        nextCursor: hasNext ? safeCursor + PAGE_SIZE : null,
        prevCursor: hasPrev ? Math.max(0, safeCursor - PAGE_SIZE) : null,
      },
    };
  }, [filteredMockCitizens, cursor]);

  // Unified active page data (Real server-paginated data OR Mock 5-per-page cursor data)
  const displayedCitizens = hasRealServerData ? serverCitizens : mockCursorState.rows;
  const activeCursorMeta = hasRealServerData ? serverCursorMeta : mockCursorState.meta;
  const totalRegisteredCount = hasRealServerData ? serverTotalRegistered : mockPool.length;
  const woredaOptions = hasRealServerData ? serverFilters.woredas || [] : mockWoredaOptions;
  const kebeleOptions = hasRealServerData ? serverFilters.kebeles || [] : mockKebeleOptions;
  const locationOptions = hasRealServerData ? serverFilters.locations || [] : mockLocationOptions;

  const hasActiveFilters = search || selectedWoreda !== "ALL" || selectedKebele !== "ALL" || selectedLocation !== "ALL";

  const handleResetFilters = () => {
    setSearch("");
    setSelectedWoreda("ALL");
    setSelectedKebele("ALL");
    setSelectedLocation("ALL");
    setCursor(0);
  };

  const currentPageNumber = Math.floor((activeCursorMeta.current || 0) / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil((activeCursorMeta.totalCount || 0) / PAGE_SIZE));
  const rangeStart = activeCursorMeta.totalCount === 0 ? 0 : (activeCursorMeta.current || 0) + 1;
  const rangeEnd = Math.min(activeCursorMeta.totalCount || 0, (activeCursorMeta.current || 0) + displayedCitizens.length);

  // Table columns definition matching required headers:
  // Fullname, Phone Number, Locations, Woreda, Kebele
  const citizenColumns = [
    {
      id: "fullName",
      accessorKey: "fullName",
      header: "Fullname",
      sortFn: "text",
      meta: { className: "font-semibold text-slate-900" },
      cell: ({ row }) => row.original.fullName,
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
      id: "locations",
      accessorKey: "locations",
      header: "Locations",
      sortFn: "text",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="truncate max-w-[220px]" title={row.original.locations}>
            {row.original.locations}
          </span>
        </div>
      ),
    },
    {
      id: "woreda",
      accessorKey: "woreda",
      header: "Woreda",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <Building className="w-3 h-3 text-slate-500" />
          {row.original.woreda}
        </span>
      ),
    },
    {
      id: "kebele",
      accessorKey: "kebele",
      header: "Kebele",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {row.original.kebele}
        </span>
      ),
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
            Directory of registered municipal citizens, residential locations, and contact details
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

      {/* Filter and Search Bar with Search Box + Dropfilter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Box Filter */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(0);
            }}
            placeholder="Search by name, phone, location..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50/50"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setCursor(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters (Dropfilter) */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Woreda Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedWoreda}
              onChange={(e) => {
                setSelectedWoreda(e.target.value);
                setSelectedKebele("ALL");
                setCursor(0);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#0b2545] focus:outline-none"
              title="Filter by Woreda"
            >
              <option value="ALL">All Woredas</option>
              {woredaOptions.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Kebele Dropdown Filter */}
          <select
            value={selectedKebele}
            onChange={(e) => {
              setSelectedKebele(e.target.value);
              setCursor(0);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#0b2545] focus:outline-none"
            title="Filter by Kebele"
          >
            <option value="ALL">All Kebeles</option>
            {kebeleOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          {/* Location Dropdown Filter */}
          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setCursor(0);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#0b2545] focus:outline-none"
            title="Filter by Location"
          >
            <option value="ALL">All Locations</option>
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          <span className="text-xs text-slate-500 font-medium ml-auto md:ml-2">
            Total: {activeCursorMeta.totalCount} citizen{activeCursorMeta.totalCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Main Content Section - Table with 5 real or mock items per page */}
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
                    : "Try adjusting your search query or dropdown filter to find citizens."}
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
