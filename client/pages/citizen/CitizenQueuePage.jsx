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
  Search,
  Filter,
  FileText,
} from "lucide-react";
import { useStore } from "@/context";
import { appointmentApi, queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { displayDate, displayTime, localIsoDate } from "@/utils";
import { CountdownChip, DataTable } from "@/components/ui";
import { appointmentStartMs } from "@/utils/countdown";

// Appointments not yet at the counter get a live countdown, from booking (pending approval) on.
const COUNTDOWN_STATUSES = new Set(["PENDING", "APPROVED", "CHECKED_IN", "WAITING"]);
const countdownStage = (status) => (status === "PENDING" ? "pending" : status === "APPROVED" ? "approved" : "checkedIn");

// "All Statuses" dropdown: label -> the row statuses it covers.
const STATUS_FILTERS = [
  { value: "PENDING", label: "Pending", statuses: ["PENDING"] },
  { value: "APPROVED", label: "Approved", statuses: ["APPROVED"] },
  { value: "WAITING", label: "Waiting", statuses: ["WAITING", "CHECKED_IN"] },
  { value: "SERVING", label: "Now Serving", statuses: ["SERVING", "IN_PROGRESS"] },
  { value: "COMPLETED", label: "Served", statuses: ["COMPLETED", "SERVED"] },
  { value: "NO_SHOW", label: "No-show", statuses: ["NO_SHOW"] },
  { value: "CANCELLED", label: "Cancelled", statuses: ["CANCELLED"] },
];
// Words a row's status can be found by in the search box.
const STATUS_WORDS = Object.fromEntries(STATUS_FILTERS.flatMap((f) => f.statuses.map((st) => [st, f.label])));

// Served at the desk or cancelled: no longer in the queue, so People Ahead / Behind show "—".
const NO_COUNTS = new Set(["COMPLETED", "SERVED", "CANCELLED"]);

// Statuses after which the appointment has no place in the queue any more.
const FINISHED = new Set(["COMPLETED", "SERVED", "NO_SHOW", "CANCELLED", "REJECTED"]);

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

  const [state, setState] = useState({ loading: true, data: null, error: false });
  const [cancellingId, setCancellingId] = useState(null);
  const request = useRef(0);
  const citizenAppointmentsRef = useRef([]);
  const notifiedCompletedRef = useRef(new Set());
  const initialMountRef = useRef(true);
  const prevStatusesRef = useRef(new Map());

  const notifyServiceCompleted = useCallback((serviceName) => {
    toast.success("Service Completed!", {
      description: serviceName
        ? `The Department Head has completed your service for ${serviceName}. Your status is now Served.`
        : "The Department Head has completed your service. Your status is now Served in My Queue.",
      duration: 7000,
    });
  }, []);

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const { data } = await queueApi.mine();
      if (id === request.current) setState({ loading: false, data, error: false });
    } catch {
      if (id === request.current) setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

  // A citizen may cancel a pending appointment, or an approved one up to the cancellation cutoff (the server checks it).
  const handleCancel = async (item) => {
    const aptId = item.appointmentId || item.id;
    if (!aptId) return;
    setCancellingId(aptId);
    try {
      await appointmentApi.cancel(aptId);
      toast.success("Appointment has been cancelled.");
    } catch (err) {
      toast.error(
        err?.status === 409
          ? (() => {
              const text = String(err.message || "").replace(/^conflict:\s*/i, "").trim();
              return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}.` : "This appointment can no longer be cancelled.";
            })()
          : err?.message || "Could not cancel appointment. Please try again.",
        { duration: 6000 }
      );
    } finally {
      setCancellingId(null);
      await load();
      await loadAppointments?.().catch(() => {});
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

    const handleAppointmentNotice = (payload) => {
      reload();

      if (payload?.event === "appointment.completed" || payload?.status === "COMPLETED") {
        const targetAptId = payload?.entityId || payload?.appointmentId;
        const cId = currentUser?.id;
        const cPhone = (currentUser?.phone || "").replace(/\D/g, "");
        const eventPhone = (payload?.citizenPhone || "").replace(/\D/g, "");

        const isMine =
          (cId && payload?.citizenId && payload.citizenId === cId) ||
          (cPhone && eventPhone && (cPhone === eventPhone || cPhone.endsWith(eventPhone) || eventPhone.endsWith(cPhone))) ||
          (targetAptId && citizenAppointmentsRef.current.some((a) => a.id === targetAptId || a.referenceNumber === payload?.referenceNumber));

        if (isMine && targetAptId && !notifiedCompletedRef.current.has(targetAptId)) {
          notifiedCompletedRef.current.add(targetAptId);
          if (payload?.referenceNumber) notifiedCompletedRef.current.add(payload.referenceNumber);
          notifyServiceCompleted(payload?.serviceName);
        }
      }
    };

    const offs = [
      subscribe("appointments.changed", handleAppointmentNotice),
      subscribe("reconnected", reload),
    ];

    // Periodic sync fallback
    const interval = setInterval(reload, 5000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      offs.forEach((off) => off());
    };
  }, [load, loadAppointments, currentUser?.id, currentUser?.phone, notifyServiceCompleted]);

  const queue = state.data?.queue || [];
  const notCheckedIn = state.data?.notCheckedIn || [];

  // Strictly filter appointments for the signed-in citizen
  const citizenAppointments = (appointments || []).filter((apt) => {
    if (!currentUser) return false;
    if (currentUser.id && apt.citizenId && apt.citizenId !== currentUser.id) return false;
    const aptPhone = (apt.citizenPhone || apt.phone || "").replace(/\D/g, "");
    const userPhone = (currentUser.phone || "").replace(/\D/g, "");
    if (aptPhone && userPhone && aptPhone !== userPhone && !aptPhone.endsWith(userPhone) && !userPhone.endsWith(aptPhone)) return false;
    return true;
  });

  citizenAppointmentsRef.current = citizenAppointments;

  // Track status transitions: when an active appointment transitions to COMPLETED / SERVED, trigger a 7-second Sonner toast
  useEffect(() => {
    if (initialMountRef.current) {
      if (citizenAppointments.length > 0) {
        citizenAppointments.forEach((apt) => {
          if (apt.status === "COMPLETED" || apt.status === "SERVED" || apt.completedAt) {
            notifiedCompletedRef.current.add(apt.id);
            if (apt.referenceNumber) notifiedCompletedRef.current.add(apt.referenceNumber);
          }
          prevStatusesRef.current.set(apt.id, apt.status);
        });
        initialMountRef.current = false;
      }
      return;
    }

    citizenAppointments.forEach((apt) => {
      const prev = prevStatusesRef.current.get(apt.id);
      const isNowCompleted = apt.status === "COMPLETED" || apt.status === "SERVED" || Boolean(apt.completedAt);
      const wasActive = prev && prev !== "COMPLETED" && prev !== "SERVED";

      if (isNowCompleted && wasActive && !notifiedCompletedRef.current.has(apt.id)) {
        notifiedCompletedRef.current.add(apt.id);
        if (apt.referenceNumber) notifiedCompletedRef.current.add(apt.referenceNumber);
        notifyServiceCompleted(apt.serviceName);
      }

      prevStatusesRef.current.set(apt.id, apt.status);
    });
  }, [citizenAppointments, notifyServiceCompleted]);

  // Cross-reference with appointments from store for immediate local reactivity
  const storeAptMap = new Map();
  citizenAppointments.forEach((a) => {
    if (a.id) storeAptMap.set(a.id, a);
    if (a.referenceNumber) storeAptMap.set(a.referenceNumber, a);
  });

  const queueRows = queue.map((t, index) => {
    const aptInStore = storeAptMap.get(t.appointmentId) || storeAptMap.get(t.id) || storeAptMap.get(t.referenceNumber);
    const effectiveStatus =
      aptInStore?.status === "COMPLETED" || t.status === "COMPLETED" || Boolean(aptInStore?.completedAt)
        ? "COMPLETED"
        : aptInStore?.status === "SERVING" || t.status === "SERVING"
        ? "SERVING"
        : aptInStore?.status || t.status;

    const isCompleted = effectiveStatus === "COMPLETED" || effectiveStatus === "SERVED";
    const isServing = effectiveStatus === "SERVING";
    const isPending = effectiveStatus === "PENDING";

    return {
      ...t,
      status: effectiveStatus,
      completedAt: aptInStore?.completedAt || null,
      position: isCompleted || isPending ? null : isServing ? 1 : t.position != null ? t.position : index + 1,
      isCheckedIn: true,
      counterNumber: t.counterNumber || aptInStore?.deskNumber || null,
      createdAt: aptInStore?.createdAt || t.createdAt || null,
      citizenName: aptInStore?.citizenName || currentUser?.fullName || "Citizen",
    };
  });

  const notCheckedInRows = notCheckedIn.map((a, index) => {
    const aptInStore = storeAptMap.get(a.appointmentId) || storeAptMap.get(a.id) || storeAptMap.get(a.referenceNumber);
    const effectiveStatus =
      aptInStore?.status === "COMPLETED" || a.status === "COMPLETED" || Boolean(aptInStore?.completedAt)
        ? "COMPLETED"
        : aptInStore?.status || a.status;

    const isCompleted = effectiveStatus === "COMPLETED" || effectiveStatus === "SERVED";
    const isPending = effectiveStatus === "PENDING";

    return {
      ...a,
      tokenNumber: a.tokenNumber || aptInStore?.tokenNumber || "—",
      status: effectiveStatus,
      completedAt: aptInStore?.completedAt || null,
      position: isCompleted || isPending ? null : a.position != null ? a.position : (queue.length + index + 1),
      citizensAhead: a.citizensAhead ?? 0,
      citizensBehind: a.citizensBehind ?? 0,
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

  const todayStr = state.data?.date || localIsoDate();
  const extraStoreRows = citizenAppointments
    .filter((a) => {
      if (seenIds.has(a.id)) return false;
      const aptDate = (a.date || "").split("T")[0];
      return aptDate >= todayStr && a.status !== "REJECTED"; // today and later days
    })
    .map((a, index) => {
      const isCompleted = a.status === "COMPLETED" || a.status === "SERVED" || Boolean(a.completedAt);
      const isCancelled = a.status === "CANCELLED";
      const isPending = a.status === "PENDING";
      return {
        appointmentId: a.id,
        referenceNumber: a.referenceNumber,
        serviceName: a.serviceName,
        departmentName: a.departmentName,
        appointmentDate: (a.date || "").split("T")[0],
        timeSlot: a.timeSlot,
        tokenNumber: a.tokenNumber || "—",
        status: isCompleted ? "COMPLETED" : a.status,
        completedAt: a.completedAt || null,
        position: isCompleted || isCancelled || isPending ? null : queue.length + notCheckedIn.length + index + 1,
        citizensAhead: 0,
        citizensBehind: 0,
        counterNumber: a.deskNumber || null,
        isCheckedIn: Boolean(a.checkedInAt),
        createdAt: a.createdAt || null,
        citizenName: a.citizenName || currentUser?.fullName || "Citizen",
      };
    });

  const combinedRows = [...queueRows, ...notCheckedInRows, ...extraStoreRows];

  // Citizen My Queue page strictly displays only the signed-in citizen's own appointments & tokens.
  const rawRows = combinedRows
    .filter((row) => {
      if (currentUser?.id && row.citizenId && row.citizenId !== currentUser.id) return false;
      if (currentUser?.phone && row.citizenPhone && row.citizenPhone !== currentUser.phone) return false;
      return true;
    })
    .map((row) => {
      const aptInStore = storeAptMap.get(row.appointmentId) || storeAptMap.get(row.id) || storeAptMap.get(row.referenceNumber);
      const isAptCompleted = aptInStore?.status === "COMPLETED" || aptInStore?.status === "SERVED" || Boolean(aptInStore?.completedAt);
      const isRowCompleted = row.status === "COMPLETED" || row.status === "SERVED" || Boolean(row.completedAt);
      const effectiveStatus = (isAptCompleted || isRowCompleted)
        ? "COMPLETED"
        : aptInStore?.status === "SERVING" || row.status === "SERVING"
        ? "SERVING"
        : aptInStore?.status || row.status;
      // A pending or finished appointment has no queue position; people ahead / behind always show a
      // number (the server counts them; a finished appointment has 0 and 0).
      const noPlace = effectiveStatus === "PENDING" || FINISHED.has(effectiveStatus);
      const finished = FINISHED.has(effectiveStatus);
      return {
        ...row,
        status: effectiveStatus,
        completedAt: aptInStore?.completedAt || row.completedAt || null,
        position: noPlace ? null : row.position,
        citizensAhead: finished ? 0 : row.citizensAhead ?? 0,
        citizensBehind: finished ? 0 : row.citizensBehind ?? 0,
      };
    });

  // Sort: SERVING first, then active, then pending awaiting approval, finished at the bottom; within
  // each group by appointment date, then queue position (same date), then time.
  const allRows = [...rawRows].sort((a, b) => {
    const aFinal = FINISHED.has(a.status);
    const bFinal = FINISHED.has(b.status);
    if (aFinal !== bFinal) return aFinal ? 1 : -1;

    const aPending = a.status === "PENDING";
    const bPending = b.status === "PENDING";
    if (aPending !== bPending) return aPending ? 1 : -1;

    const aServing = a.status === "SERVING";
    const bServing = b.status === "SERVING";
    if (aServing !== bServing) return aServing ? -1 : 1;

    const dateA = a.appointmentDate || todayStr;
    const dateB = b.appointmentDate || todayStr;
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;

    if (a.position != null && b.position != null && a.position !== b.position) {
      return a.position - b.position;
    }

    const apptA = parseTimeToMinutes(a.timeSlot);
    const apptB = parseTimeToMinutes(b.timeSlot);
    if (apptA !== apptB) return apptA - apptB;

    return 0;
  });

  const startOf = (row) => appointmentStartMs(row.appointmentDate || state.data?.date, row.timeSlot);
  // The citizen's next approved appointment (earliest start), unless they are at the counter already.
  const completedRows = allRows.filter((r) => r.status === "COMPLETED");
  const servingRows = allRows.filter((r) => r.status === "SERVING");

  const [selectedService, setSelectedService] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const serviceOptions = useMemo(() => {
    const s = new Set();
    allRows.forEach((r) => {
      if (r.serviceName) s.add(r.serviceName);
    });
    return Array.from(s);
  }, [allRows]);

  // Search box and dropdown filters (the citizen's own entries for today, filtered in the page).
  const displayedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const statuses = STATUS_FILTERS.find((f) => f.value === statusFilter)?.statuses;
    return allRows.filter((r) => {
      if (selectedService !== "ALL" && r.serviceName !== selectedService) return false;
      if (statuses && !statuses.includes(r.status)) return false;
      if (!q) return true;
      return [
        r.serviceName,
        r.departmentName,
        r.referenceNumber,
        r.timeSlot,
        r.timeSlot ? displayTime(r.timeSlot) : "",
        STATUS_WORDS[r.status] || r.status,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [allRows, selectedService, statusFilter, search]);
  const filtering = search.trim() !== "" || selectedService !== "ALL" || statusFilter !== "ALL";
  const clearFilters = () => {
    setSearch("");
    setSelectedService("ALL");
    setStatusFilter("ALL");
  };

  // Group active rows by service to accurately calculate peopleBehind
  const activeRowsByService = useMemo(() => {
    const map = new Map();
    allRows.forEach((r) => {
      if (FINISHED.has(r.status) || r.status === "PENDING") return;
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
      accessorFn: (row) => currentUser?.fullName || row.citizenName || "",
      header: "Citizen",
      sortFn: "text",
      cell: ({ row }) => {
        const rawName = row.original.citizenName || currentUser?.fullName || "Citizen";
        const cleanName = rawName.replace(/\s*\(You\)$/, "");
        const displayName = currentUser?.fullName || cleanName;
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs text-[#0b2545] font-bold">
              {displayName}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
              You
            </span>
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
          <div className="text-[11px] text-slate-500 flex items-start gap-1 mt-0.5 queue-dept">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
            <span>{row.original.departmentName || "Public Service Desk"}</span>
          </div>
          {row.original.referenceNumber && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
              Ref: {row.original.referenceNumber}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "appointmentDate",
      accessorFn: (row) => row.appointmentDate || state.data?.date || "",
      header: "Appointment Date",
      sortFn: "text",
      cell: ({ row }) => {
        const date = row.original.appointmentDate || state.data?.date;
        return (
          <div className="font-bold text-slate-900 text-xs whitespace-nowrap">
            {date ? displayDate(date) : "—"}
          </div>
        );
      },
    },
    {
      id: "appointmentTime",
      accessorFn: (row) => row.timeSlot || "",
      header: "Appointment Time",
      sortFn: "text",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div>
            <div className="text-[11px] text-blue-700 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600 inline shrink-0" />
              <span>{item.timeSlot ? displayTime(item.timeSlot) : "—"}</span>
            </div>
            {COUNTDOWN_STATUSES.has(item.status) && (
              <CountdownChip startMs={startOf(item)} stage={countdownStage(item.status)} />
            )}
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
              <span>Served</span>
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

        if (row.original.status === "NO_SHOW") {
          return (
            <span className="inline-flex items-center gap-1.5 text-amber-800 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 shadow-2xs">
              <X className="w-3.5 h-3.5 text-amber-600" />
              <span>Missed</span>
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
        row.citizensAhead != null
          ? row.citizensAhead
          : row.position != null
          ? Math.max(0, Number(row.position) - 1)
          : 0,
      header: () => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-xs">People Ahead</span>
          <span className="queue-th-note text-[10px] text-slate-400 font-normal">
            (Number of citizens before you)
          </span>
        </div>
      ),
      sortFn: "basic",
      cell: ({ row }) => {
        // Served or cancelled: the citizen has left the queue, so there is no one ahead or behind.
        if (NO_COUNTS.has(row.original.status)) return <span className="text-slate-400 text-xs">—</span>;
        const ahead =
          row.original.citizensAhead != null
            ? row.original.citizensAhead
            : row.original.position != null
            ? Math.max(0, Number(row.original.position) - 1)
            : 0;
        return (
          <span className="inline-flex items-center gap-1 font-semibold text-xs text-slate-700">
            <span
              className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${
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
          <span className="font-bold text-slate-800 text-xs">People Behind</span>
          <span className="queue-th-note text-[10px] text-slate-400 font-normal">
            (Citizens scheduled after you)
          </span>
        </div>
      ),
      sortFn: "basic",
      cell: ({ row }) => {
        // Served or cancelled: the citizen has left the queue, so there is no one ahead or behind.
        if (NO_COUNTS.has(row.original.status)) return <span className="text-slate-400 text-xs">—</span>;
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
              className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap ${
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
        if (status === "COMPLETED" || status === "SERVED") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Served
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
        if (status === "NO_SHOW") {
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-800 border-amber-200 shadow-2xs"
              title="You were called at the desk but did not attend. Please book a new appointment."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              No-show
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
        const isCompleted = item.status === "COMPLETED" || item.status === "SERVED" || Boolean(item.completedAt);
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
              <span>Served</span>
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

        // Pending, or approved but not yet checked in (the server enforces the cancellation cutoff).
        if (isYou && (item.status === "PENDING" || item.status === "APPROVED")) {
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
            Your appointments from today{state.data?.date ? ` (${displayDate(state.data.date)})` : ""} onward: live queue status, desk assignment, and progression.
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

      {/* Search Box & Dropdown Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service, department, reference, time, status..."
            aria-label="Search my queue"
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              aria-label="Filter by service"
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium text-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              <option value="ALL">All Services</option>
              {serviceOptions.map((srv) => (
                <option key={srv} value={srv}>
                  {srv}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Queue DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden queue-table">
        <DataTable
          data={displayedRows}
          columns={queueColumns}
          getRowId={(row) => String(row.appointmentId || row.referenceNumber || row.id)}
          itemLabel="queue entries"
          minWidth="960px"
          emptyState={
            filtering && allRows.length > 0 ? (
              <div className="flex flex-col items-center gap-3 text-slate-400 py-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">No queue entries match your search or filters</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0b2545] bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            ) : (
            <div className="flex flex-col items-center gap-3 text-slate-400 py-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">You have no upcoming appointments</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When you book an appointment, its queue position and live status will appear here.
                </p>
              </div>
            </div>
            )
          }
        />
      </div>
    </div>
  );
}
