import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { DataTable } from "@/components/ui";
import { useEscapeKey } from "@/hooks";
import { subscribe } from "@/api/realtime";
import { serviceApi } from "@/api/serviceApi";
import { describeError } from "@/utils";
import {
  FileText,
  Plus,
  Search,
  Edit2,
  X,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminServicesPage() {
  const {
    services,
    addService,
    updateService,
    toggleServiceStatus,
    deleteService,
    loadServices,
  } = useStore();
  const [saving, setSaving] = useState(false);

  // Search box and service filter state
  const [search, setSearch] = useState("");
  const [selectedServiceFilter, setSelectedServiceFilter] = useState("ALL");

  // Server-side cursor-based pagination state (4 real data items per page)
  const PAGE_SIZE = 4;
  const [cursor, setCursor] = useState(0);
  const [pagedServices, setPagedServices] = useState([]);
  const [cursorMetaState, setCursorMetaState] = useState({
    current: 0,
    pageSize: PAGE_SIZE,
    totalCount: 0,
    hasPrev: false,
    hasNext: false,
    nextCursor: null,
    prevCursor: null,
  });
  const [loadingPage, setLoadingPage] = useState(false);

  // Fetch services using server-side cursor-based pagination
  const fetchPagedServices = useCallback(async () => {
    setLoadingPage(true);
    try {
      const res = await serviceApi.listPaged({
        search: search.trim() || undefined,
        serviceId: selectedServiceFilter,
        cursor,
        pageSize: PAGE_SIZE,
      });
      if (res && res.data) {
        setPagedServices(res.data);
        if (res.meta?.cursor) {
          setCursorMetaState(res.meta.cursor);
          if (cursor > 0 && res.meta.cursor.totalCount <= cursor) {
            setCursor(0);
          }
        }
      }
    } catch (err) {
      toast.error(describeError(err, "load services page"), { duration: 5000 });
    } finally {
      setLoadingPage(false);
    }
  }, [search, selectedServiceFilter, cursor]);

  useEffect(() => {
    fetchPagedServices();
  }, [fetchPagedServices]);

  // Fetch services on mount and whenever catalog updates via real-time WebSocket
  useEffect(() => {
    const refresh = () => {
      fetchPagedServices();
      loadServices().catch((err) => toast.error(describeError(err, "load services"), { duration: 5000 }));
    };
    refresh();
    const offChange = subscribe("catalog.changed", refresh);
    const offReconnect = subscribe("reconnected", refresh);
    return () => {
      offChange();
      offReconnect();
    };
  }, [fetchPagedServices, loadServices]);

  const showSuccess = (msg) => {
    toast.success(msg, { duration: 5000 });
  };

  const hasActiveFilters = Boolean(search.trim() || selectedServiceFilter !== "ALL");

  const handleResetFilters = () => {
    setSearch("");
    setSelectedServiceFilter("ALL");
    setCursor(0);
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const closeServiceModal = () => {
    setModalOpen(false);
    setEditingService(null);
  };
  useEscapeKey(modalOpen, closeServiceModal);

  const [form, setForm] = useState({
    name: "",
  });

  const handleOpenAdd = () => {
    setEditingService(null);
    setForm({
      name: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (srv) => {
    setEditingService(srv);
    setForm({
      name: srv.name,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;

    const payload = {
      name: form.name.trim(),
      departmentId: editingService?.departmentId || null,
      code: editingService?.code || `SRV-${Date.now().toString(36).toUpperCase()}`,
      durationMinutes: editingService?.durationMinutes || 30,
      dailyQuota: editingService?.dailyQuota || 40,
      feeETB: editingService?.feeETB || 0,
      processingDays: editingService?.processingDays || "Same day",
      requiredDocuments: editingService?.requiredDocuments || ["Valid Kebele ID"],
    };

    setSaving(true);
    try {
      if (editingService) {
        await updateService(editingService.id, payload);
        showSuccess(`Service "${payload.name}" updated successfully.`);
      } else {
        await addService(payload);
        showSuccess(`Service "${payload.name}" created successfully.`);
      }
      setModalOpen(false);
      setEditingService(null);
      await fetchPagedServices();
    } catch (err) {
      const msg = describeError(err, editingService ? "update the service" : "create the service");
      toast.error(msg, { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) return;
    try {
      await deleteService(service.id);
      if (selectedServiceFilter === service.id) {
        setSelectedServiceFilter("ALL");
        setCursor(0);
      }
      showSuccess(`Service "${service.name}" deleted.`);
      await fetchPagedServices();
    } catch (err) {
      toast.error(describeError(err, `delete "${service.name}"`), { duration: 5000 });
    }
  };

  const handleToggleStatus = async (service) => {
    try {
      await toggleServiceStatus(service.id);
      showSuccess(`Service "${service.name}" is now ${!service.isActive ? "ACTIVE" : "INACTIVE"}.`);
      await fetchPagedServices();
    } catch (err) {
      toast.error(describeError(err, `change the status of "${service.name}"`), { duration: 5000 });
    }
  };

  // Service table columns (TanStack Table via components/ui/DataTable).
  const serviceColumns = [
    {
      id: "name",
      accessorKey: "name",
      header: "Services",
      sortFn: "text",
      meta: { className: "font-bold text-slate-900 max-w-xs" },
      cell: ({ row }) => (
        <span className="font-bold text-slate-900">{row.original.name}</span>
      ),
    },
    {
      id: "status",
      accessorFn: (s) => (s.isActive ? "Active" : "Inactive"),
      header: "Status",
      cell: ({ row }) => {
        const service = row.original;
        return (
          <button
            onClick={() => handleToggleStatus(service)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
              service.isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {service.isActive ? "ACTIVE" : "INACTIVE"}
          </button>
        );
      },
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      meta: { className: "text-center", headerClassName: "text-center" },
      cell: ({ row }) => {
        const service = row.original;
        return (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => handleOpenEdit(service)}
              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-all cursor-pointer"
              title="Edit Service"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(service)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all cursor-pointer"
              title="Delete Service"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="relative flex items-center w-full min-h-[48px]" style={{ position: "relative", minHeight: "48px" }}>
        <div className="w-full text-center">
          <h2 className="text-xl font-bold text-slate-900">Service Management</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage Woreda services and operating statuses.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow transition-colors cursor-pointer shrink-0"
          style={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            whiteSpace: "nowrap",
          }}
        >
          <Plus className="w-4 h-4 text-amber-300" />
          <span>Add New Service</span>
        </button>
      </div>

      {/* Filter and Search Bar with Search Box + Dropfilter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search Box Filter */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(0);
            }}
            placeholder="Search service by name..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCursor(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters (Dropfilter) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Services Dropdown Filter */}
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedServiceFilter}
              onChange={(e) => {
                setSelectedServiceFilter(e.target.value);
                setCursor(0);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-[#0b2545] focus:outline-none shadow-2xs max-w-xs"
              title="Filter by service"
            >
              <option value="ALL">All Services</option>
              {(services || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-rose-200 shadow-2xs"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}

          {/* Services Counter Badge */}
          <div className="text-xs text-slate-500 font-medium ml-auto md:ml-2">
            Total: <strong className="text-slate-800">{cursorMetaState.totalCount}</strong>{" "}
            {cursorMetaState.totalCount === 1 ? "service" : "services"}
          </div>
        </div>
      </div>

      {/* Services Table with 4 real data items per page */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={pagedServices}
          columns={serviceColumns}
          getRowId={(s) => s.id}
          initialSorting={[{ id: "name", desc: false }]}
          pageSize={null}
          itemLabel="services"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">
                  {loadingPage
                    ? "Loading services…"
                    : cursorMetaState.totalCount === 0 && !hasActiveFilters
                      ? "No services added yet"
                      : "No matching services found"}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {loadingPage
                    ? "Fetching service catalog from server..."
                    : cursorMetaState.totalCount === 0 && !hasActiveFilters
                      ? "Services and department counter designations configured by Central Administration will appear here."
                      : "Try adjusting your search keywords or resetting the service filter."}
                </p>
              </div>
            </div>
          }
        />

        {/* Cursor-Based Pagination Navigation Footer (4 real data items per page) */}
        <div className="bg-slate-50/70 px-5 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{pagedServices.length > 0 ? cursor + 1 : 0}</strong> to{" "}
            <strong className="text-slate-800">{Math.min(cursor + PAGE_SIZE, cursorMetaState.totalCount || 0)}</strong> of{" "}
            <strong className="text-slate-800">{cursorMetaState.totalCount || 0}</strong> services
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (cursorMetaState.prevCursor !== null && cursorMetaState.prevCursor !== undefined) {
                  setCursor(cursorMetaState.prevCursor);
                } else {
                  setCursor((prev) => Math.max(0, prev - PAGE_SIZE));
                }
              }}
              disabled={!cursorMetaState.hasPrev || loadingPage}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Previous page"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
              Page {Math.floor(cursor / PAGE_SIZE) + 1} of{" "}
              {Math.max(1, Math.ceil((cursorMetaState.totalCount || 0) / PAGE_SIZE))}
            </span>

            <button
              type="button"
              onClick={() => {
                if (cursorMetaState.nextCursor !== null && cursorMetaState.nextCursor !== undefined) {
                  setCursor(cursorMetaState.nextCursor);
                } else {
                  setCursor((prev) => prev + PAGE_SIZE);
                }
              }}
              disabled={!cursorMetaState.hasNext || loadingPage}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
              aria-label="Next page"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && closeServiceModal()}>
          <div className="modal-panel modal-panel--form" role="dialog" aria-modal="true" aria-labelledby="service-modal-title">
            <div className="flex items-center justify-between mb-4">
              <h3 id="service-modal-title" className="font-bold text-base text-slate-900">
                {editingService ? "Edit Service" : "Create New Government Service"}
              </h3>
              <button type="button" onClick={closeServiceModal} className="modal-close" aria-label="Close">
                <X aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Service Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Birth Certificate Registration"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#0b2545] focus:outline-none bg-slate-50"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeServiceModal}
                  className="modal-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="modal-btn modal-btn--primary"
                >
                  {saving ? "Saving…" : editingService ? "Save Changes" : "Create Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
