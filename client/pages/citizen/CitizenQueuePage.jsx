// Citizen > My Queue: the citizen's live place in today's department queue (position,
// citizens ahead, estimated wait). Data comes from GET /queue/me; it is read again whenever
// the server announces a queue change over the WebSocket (check-in, call next, completed / no-show),
// so it updates without polling.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  Users,
  CheckCircle2,
  Check,
  BellRing,
  Building2,
  X,
} from "lucide-react";
import { useStore } from "@/context";
import { queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { displayDate, displayTime } from "@/utils";
import { DataTable } from "@/components/ui";

function parseTimeToMinutes(val) {
  if (!val) return 0;
  if (typeof val === "string" && val.includes("T")) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.getHours() * 60 + d.getMinutes();
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i.exec(String(val).trim());
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const meridiem = (m[3] || "").toUpperCase();
  if (meridiem === "PM" && h < 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export default function CitizenQueuePage() {
  const currentUser = useStore((s) => s.currentUser);
  const appointments = useStore((s) => s.appointments);
  const loadAppointments = useStore((s) => s.loadAppointments);
  const updateAppointmentStatus = useStore((s) => s.updateAppointmentStatus);

  const [state, setState] = useState({ loading: true, data: null, error: false });
  const [cancellingId, setCancellingId] = useState(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const { data } = await queueApi.mine();
      if (id === request.current) setState({ loading: false, data, error: false });
    } catch {
      if (id === request.current) setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  const handleCancel = async (item) => {
    const aptId = item.appointmentId || item.id;
    if (!aptId) return;
    setCancellingId(aptId);
    try {
      const ok = await updateAppointmentStatus(aptId, "CANCELLED");
      if (ok) {
        toast.success("Appointment has been cancelled.");
        await load();
        await loadAppointments?.().catch(() => {});
      } else {
        toast.error("Could not cancel appointment. Please try again.");
      }
    } catch {
      toast.error("Could not cancel appointment. Please try again.");
    } finally {
      setCancellingId(null);
    }
  };

  // Live: the server pushes "appointments.changed" on check-in, call next and completion.
  useEffect(() => {
    load();
    loadAppointments?.().catch(() => {});

    let timer = null;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        load();
        loadAppointments?.().catch(() => {});
      }, 300);
    };

    const offs = [
      subscribe("appointments.changed", reload),
      subscribe("reconnected", reload),
    ];

    // Periodic sync fallback
    const interval = setInterval(reload, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      offs.forEach((off) => off());
    };
  }, [load, loadAppointments]);

  const queue = state.data?.queue || [];
  const notCheckedIn = state.data?.notCheckedIn || [];

  // Cross-reference with appointments from store for immediate local reactivity
  const storeAptMap = new Map((appointments || []).map((a) => [a.id, a]));

  const queueRows = queue.map((t, index) => {
    const aptInStore = storeAptMap.get(t.appointmentId);
    const effectiveStatus =
      aptInStore?.status === "COMPLETED" || t.status === "COMPLETED"
        ? "COMPLETED"
        : aptInStore?.status === "SERVING" || t.status === "SERVING"
        ? "SERVING"
        : aptInStore?.status || t.status;

    const isCompleted = effectiveStatus === "COMPLETED";
    const isServing = effectiveStatus === "SERVING";
    const isPending = effectiveStatus === "PENDING";

    return {
      ...t,
      status: effectiveStatus,
      position: isCompleted || isPending ? null : isServing ? 1 : t.position != null ? t.position : index + 1,
      isCheckedIn: true,
      counterNumber: t.counterNumber || aptInStore?.deskNumber || null,
      createdAt: aptInStore?.createdAt || t.createdAt || null,
      citizenName: aptInStore?.citizenName || currentUser?.fullName || "Citizen",
    };
  });

  const notCheckedInRows = notCheckedIn.map((a, index) => {
    const aptInStore = storeAptMap.get(a.appointmentId);
    const effectiveStatus =
      aptInStore?.status === "COMPLETED" || a.status === "COMPLETED"
        ? "COMPLETED"
        : aptInStore?.status || a.status;

    const isCompleted = effectiveStatus === "COMPLETED";
    const isPending = effectiveStatus === "PENDING";

    return {
      ...a,
      tokenNumber: a.tokenNumber || aptInStore?.tokenNumber || "—",
      status: effectiveStatus,
      position: isCompleted || isPending ? null : a.position != null ? a.position : (queue.length + index + 1),
      citizensAhead: isPending ? null : a.citizensAhead ?? 0,
      citizensBehind: isPending ? null : a.citizensBehind ?? 0,
      counterNumber: a.counterNumber || aptInStore?.deskNumber || null,
      isCheckedIn: false,
      createdAt: aptInStore?.createdAt || a.createdAt || null,
      citizenName: a.citizenName || aptInStore?.citizenName || currentUser?.fullName || "Citizen",
    };
  });

  // Include today's appointments from store if missing from server queue response
  const seenIds = new Set([
    ...queueRows.map((r) => r.appointmentId),
    ...notCheckedInRows.map((r) => r.appointmentId),
  ]);

  const todayStr = state.data?.date || new Date().toISOString().split("T")[0];
  const extraStoreRows = (appointments || [])
    .filter((a) => {
      if (seenIds.has(a.id)) return false;
      const aptDate = (a.date || "").split("T")[0];
      return aptDate === todayStr && a.status !== "REJECTED";
    })
    .map((a, index) => {
      const isCompleted = a.status === "COMPLETED";
      const isCancelled = a.status === "CANCELLED";
      const isPending = a.status === "PENDING";
      return {
        appointmentId: a.id,
        referenceNumber: a.referenceNumber,
        serviceName: a.serviceName,
        departmentName: a.departmentName,
        timeSlot: a.timeSlot,
        tokenNumber: a.tokenNumber || "—",
        status: a.status,
        position: isCompleted || isCancelled || isPending ? null : queue.length + notCheckedIn.length + index + 1,
        citizensAhead: isCompleted || isCancelled || isPending ? null : 0,
        citizensBehind: isCompleted || isCancelled || isPending ? null : 0,
        counterNumber: a.deskNumber || null,
        isCheckedIn: Boolean(a.checkedInAt),
        createdAt: a.createdAt || null,
        citizenName: a.citizenName || currentUser?.fullName || "Citizen",
      };
    });

  const combinedRows = [...queueRows, ...notCheckedInRows, ...extraStoreRows];

  // If server returns live departmentQueue for today's active department, display it
  // so the citizen sees the complete queue order (e.g. Citizen B at 4:00 PM, Citizen A at 4:45 PM).
  const hasDeptQueue = Array.isArray(state.data?.departmentQueue) && state.data.departmentQueue.length > 0;
  const rawRows = (hasDeptQueue ? state.data.departmentQueue : combinedRows).map((row) => {
    const aptInStore = storeAptMap.get(row.appointmentId);
    if (!aptInStore) return row;
    const effectiveStatus =
      aptInStore.status === "COMPLETED" || row.status === "COMPLETED"
        ? "COMPLETED"
        : aptInStore.status === "SERVING" || row.status === "SERVING"
        ? "SERVING"
        : aptInStore.status || row.status;
    const isPending = effectiveStatus === "PENDING";
    const isCompleted = effectiveStatus === "COMPLETED";
    const isCancelled = effectiveStatus === "CANCELLED";
    return {
      ...row,
      status: effectiveStatus,
      position: isPending || isCompleted || isCancelled ? null : row.position,
      citizensAhead: isPending || isCompleted || isCancelled ? null : row.citizensAhead,
      citizensBehind: isPending || isCompleted || isCancelled ? null : row.citizensBehind,
    };
  });

  // Sort: SERVING first, then active by Queue Position / scheduled appointment time, pending awaiting approval, and COMPLETED / CANCELLED cleanly displayed at the bottom
  const allRows = [...rawRows].sort((a, b) => {
    const aFinal = a.status === "COMPLETED" || a.status === "CANCELLED";
    const bFinal = b.status === "COMPLETED" || b.status === "CANCELLED";
    if (aFinal !== bFinal) return aFinal ? 1 : -1;

    const aPending = a.status === "PENDING";
    const bPending = b.status === "PENDING";
    if (aPending !== bPending) return aPending ? 1 : -1;

    const aServing = a.status === "SERVING";
    const bServing = b.status === "SERVING";
    if (aServing !== bServing) return aServing ? -1 : 1;

    if (a.position != null && b.position != null && a.position !== b.position) {
      return a.position - b.position;
    }

    const apptA = parseTimeToMinutes(a.timeSlot);
    const apptB = parseTimeToMinutes(b.timeSlot);
    if (apptA !== apptB) return apptA - apptB;

    return 0;
  });

  const completedRows = allRows.filter((r) => r.status === "COMPLETED");
  const servingRows = allRows.filter((r) => r.status === "SERVING");

  const [selectedService, setSelectedService] = useState("ALL");

  const serviceOptions = useMemo(() => {
    const s = new Set();
    allRows.forEach((r) => {
      if (r.serviceName) s.add(r.serviceName);
    });
    return Array.from(s);
  }, [allRows]);

  const displayedRows = useMemo(() => {
    if (selectedService === "ALL") return allRows;
    return allRows.filter((r) => r.serviceName === selectedService);
  }, [allRows, selectedService]);

  // Group active rows by service to accurately calculate peopleBehind
  const activeRowsByService = useMemo(() => {
    const map = new Map();
    allRows.forEach((r) => {
      if (r.status === "COMPLETED" || r.status === "CANCELLED" || r.status === "REJECTED" || r.status === "PENDING") return;
      const key = r.serviceName || r.serviceId || "default";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [allRows]);

  // Columns for Citizen My Queue DataTable
  const queueColumns = [
    {
      id: "citizen",
      accessorFn: (row) => row.citizenName || currentUser?.fullName || "",
      header: "Citizen",
      sortFn: "text",
      cell: ({ row }) => {
        const rawName = row.original.citizenName || currentUser?.fullName || "Citizen";
        const cleanName = rawName.replace(/\s*\(You\)$/, "");
        const isYou = row.original.isYou || (!row.original.citizenName || cleanName === currentUser?.fullName);
        return (
          <div className="flex items-center gap-1.5">
            <span className={`font-semibold text-xs ${isYou ? "text-[#0b2545] font-bold" : "text-slate-800"}`}>
              {cleanName}
            </span>
            {isYou && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                You
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "services",
      accessorFn: (row) => row.serviceName || "",
      header: "Services",
      sortFn: "text",
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-slate-900 block">
            {row.original.serviceName || "Municipal Service"}
          </span>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{row.original.departmentName || "Public Service Desk"}</span>
            {row.original.referenceNumber && (
              <span className="text-slate-400">· Ref: {row.original.referenceNumber}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "appointmentTime",
      accessorFn: (row) => row.timeSlot || "",
      header: "Appointment Time",
      sortFn: "text",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="text-[11px] text-blue-700 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600 inline shrink-0" />
            <span>{item.timeSlot ? displayTime(item.timeSlot) : "—"}</span>
          </div>
        );
      },
    },
    {
      id: "queuePosition",
      accessorFn: (row) =>
        row.status === "PENDING" || row.status === "CANCELLED"
          ? 998
          : row.position != null
          ? Number(row.position)
          : row.status === "SERVING"
          ? 1
          : 999,
      header: "Queue Position",
      sortFn: "basic",
      cell: ({ row }) => {
        const isCompleted = row.original.status === "COMPLETED";
        const isCancelled = row.original.status === "CANCELLED";
        const isServing = row.original.status === "SERVING";
        const isPending = row.original.status === "PENDING";
        const pos = row.original.position;

        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Completed</span>
            </span>
          );
        }

        if (isCancelled) {
          return (
            <span className="inline-flex items-center gap-1.5 text-rose-700 font-bold text-xs bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 shadow-2xs">
              <X className="w-3.5 h-3.5 text-rose-600" />
              <span>Cancelled</span>
            </span>
          );
        }

        if (isServing) {
          return (
            <span className="inline-flex items-center gap-1.5 text-blue-700 font-bold text-xs bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping inline-block" />
              <span>Now Serving</span>
            </span>
          );
        }

        if (isPending) {
          return (
            <span
              className="inline-flex items-center gap-1.5 text-amber-800 font-bold text-[11px] bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 shadow-2xs"
              title="Awaiting Department Head approval in Appointments desk"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Awaiting Approval</span>
            </span>
          );
        }

        return (
          <span className="font-bold text-slate-900 text-xs bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
            {pos !== null && pos !== undefined ? `#${pos}` : "—"}
          </span>
        );
      },
    },
    {
      id: "peopleAhead",
      accessorFn: (row) =>
        row.status === "PENDING" || row.status === "CANCELLED"
          ? 999
          : row.citizensAhead != null
          ? row.citizensAhead
          : row.position != null
          ? Math.max(0, Number(row.position) - 1)
          : 0,
      header: () => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-xs whitespace-nowrap">People Ahead</span>
          <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap">
            (Number of citizens before you)
          </span>
        </div>
      ),
      sortFn: "basic",
      cell: ({ row }) => {
        const isCompleted = row.original.status === "COMPLETED";
        const isCancelled = row.original.status === "CANCELLED";
        const isPending = row.original.status === "PENDING";
        if (isCompleted || isCancelled || isPending) return <span className="text-slate-400 text-xs">—</span>;
        const ahead =
          row.original.citizensAhead != null
            ? row.original.citizensAhead
            : row.original.position != null
            ? Math.max(0, Number(row.original.position) - 1)
            : 0;
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-xs text-slate-700">
            <span
              className={`px-2 py-0.5 rounded-md font-bold ${
                ahead === 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}
            >
              {ahead} {ahead === 1 ? "citizen" : "citizens"}
            </span>
          </span>
        );
      },
    },
    {
      id: "peopleBehind",
      accessorFn: (row) => {
        if (row.status === "PENDING" || row.status === "CANCELLED") return 999;
        const key = row.serviceName || row.serviceId || "default";
        const groupList = activeRowsByService.get(key) || [];
        const total = row.totalInQueue != null ? row.totalInQueue : groupList.length;
        const pos = row.position != null ? Number(row.position) : 1;
        return row.citizensBehind != null
          ? row.citizensBehind
          : Math.max(0, total - pos);
      },
      header: () => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-xs whitespace-nowrap">People Behind</span>
          <span className="text-[10px] text-slate-400 font-normal whitespace-nowrap">
            (Citizens scheduled after you)
          </span>
        </div>
      ),
      sortFn: "basic",
      cell: ({ row }) => {
        const isCompleted = row.original.status === "COMPLETED";
        const isCancelled = row.original.status === "CANCELLED";
        const isPending = row.original.status === "PENDING";
        if (isCompleted || isCancelled || isPending) return <span className="text-slate-400 text-xs">—</span>;
        const key = row.original.serviceName || row.original.serviceId || "default";
        const groupList = activeRowsByService.get(key) || [];
        const total = row.original.totalInQueue != null ? row.original.totalInQueue : groupList.length;
        const pos = row.original.position != null ? Number(row.original.position) : 1;
        const behind =
          row.original.citizensBehind != null
            ? row.original.citizensBehind
            : Math.max(0, total - pos);
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-xs text-slate-700">
            <span
              className={`px-2 py-0.5 rounded-md font-bold ${
                behind === 0
                  ? "bg-slate-50 text-slate-500 border border-slate-200"
                  : "bg-blue-50 text-blue-700 border border-blue-200"
              }`}
            >
              {behind} {behind === 1 ? "citizen" : "citizens"}
            </span>
          </span>
        );
      },
    },
    {
      id: "requestedAt",
      accessorFn: (row) => row.createdAt || "",
      header: () => (
        <span title="Requested at">
          Requested at
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Requested at
          </span>
        </span>
      ),
      sortFn: "datetime",
      cell: ({ row }) => {
        const createdAt = row.original.createdAt;
        if (!createdAt) return <span className="text-xs text-slate-400">—</span>;
        const d = new Date(createdAt);
        if (isNaN(d.getTime())) return <span className="text-xs text-slate-700">{createdAt}</span>;
        const dateStr = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeStr = d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
        return (
          <div className="whitespace-nowrap">
            <div className="font-semibold text-slate-800 text-xs">{dateStr}</div>
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{timeStr}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      accessorFn: (row) => row.status || "",
      header: "Status",
      sortFn: "text",
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === "COMPLETED") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          );
        }
        if (status === "CANCELLED") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Cancelled
            </span>
          );
        }
        if (status === "SERVING" || status === "IN_PROGRESS") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Serving
            </span>
          );
        }
        if (status === "WAITING" || status === "CHECKED_IN") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Waiting
            </span>
          );
        }
        if (status === "PENDING") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Pending
            </span>
          );
        }
        if (status === "APPROVED") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Approved
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Scheduled
          </span>
        );
      },
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const item = row.original;
        const isCompleted = item.status === "COMPLETED";
        const isCancelled = item.status === "CANCELLED";
        const isServing = item.status === "SERVING" || item.status === "IN_PROGRESS";
        const rawName = item.citizenName || currentUser?.fullName || "Citizen";
        const cleanName = rawName.replace(/\s*\(You\)$/, "");
        const isYou = item.isYou || (!item.citizenName || cleanName === currentUser?.fullName);
        const aptId = item.appointmentId || item.id;
        const isCancelling = cancellingId === aptId;

        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 shadow-2xs">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Completed</span>
            </span>
          );
        }

        if (isCancelled) {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-semibold px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 shadow-2xs">
              <X className="w-3.5 h-3.5 text-rose-500" />
              <span>Cancelled</span>
            </span>
          );
        }

        if (isServing) {
          return (
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-700 font-semibold px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>At Counter</span>
            </span>
          );
        }

        if (isYou && (item.status === "PENDING" || item.status === "APPROVED" || item.status === "WAITING" || item.status === "CHECKED_IN")) {
          return (
            <button
              type="button"
              onClick={() => handleCancel(item)}
              disabled={isCancelling}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
              title="Cancel your appointment"
            >
              <X className="w-3.5 h-3.5 text-rose-600" />
              <span>{isCancelling ? "Cancelling..." : "Cancel"}</span>
            </button>
          );
        }

        return <span className="text-xs text-slate-400">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="sm-header justify-center text-center" style={{ display: "flex", justifyContent: "center", textAlign: "center", width: "100%" }}>
        <div className="w-full text-center" style={{ textAlign: "center", width: "100%" }}>
          <h1 className="sm-title" style={{ textAlign: "center" }}>My Queue</h1>
          <p className="sm-subtitle mx-auto" style={{ textAlign: "center", margin: "0.25rem auto 0 auto" }}>
            Your place in today&apos;s queue{state.data?.date ? ` (${displayDate(state.data.date)})` : ""}. Shows your live queue status, desk assignment, and progression.
          </p>
        </div>
      </header>

      {/* Now Serving Live Alert Banner */}
      {servingRows.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-blue-600 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-950">
                It&apos;s your turn!
              </h3>
              <p className="text-xs text-blue-700 mt-0.5">
                Please proceed to{" "}
                <strong>Counter Desk #{servingRows[0].counterNumber || 1}</strong> now
                {servingRows[0].calledTime ? ` (called at ${servingRows[0].calledTime})` : ""}.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-xs shrink-0">
            Now Serving
          </span>
        </div>
      )}

      {/* Service Filter (when booked in multiple services) */}
      {serviceOptions.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-600">Filter Service Desk:</span>
          <button
            type="button"
            onClick={() => setSelectedService("ALL")}
            className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              selectedService === "ALL"
                ? "bg-[#0b2545] text-white border-[#0b2545]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            All Services ({allRows.length})
          </button>
          {serviceOptions.map((srv) => {
            const count = allRows.filter((r) => r.serviceName === srv).length;
            return (
              <button
                key={srv}
                type="button"
                onClick={() => setSelectedService(srv)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  selectedService === srv
                    ? "bg-[#0b2545] text-white border-[#0b2545]"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {srv} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Queue DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={displayedRows}
          columns={queueColumns}
          getRowId={(row) => String(row.appointmentId || row.referenceNumber || row.id)}
          itemLabel="queue entries"
          minWidth="960px"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">You are not in a queue today</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When you have an appointment today, your queue position and live status will appear here.
                </p>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
