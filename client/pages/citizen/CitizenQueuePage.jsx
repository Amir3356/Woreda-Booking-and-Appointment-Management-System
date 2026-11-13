// Citizen > My Queue: the citizen's live place in today's department queue (position,
// citizens ahead, estimated wait). Data comes from GET /queue/me; it is read again whenever
// the server announces a queue change over the WebSocket (check-in, call next, completed / no-show),
// so it updates without polling.
import { useCallback, useEffect, useRef, useState } from "react";
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

export default function CitizenQueuePage() {
  const appointments = useStore((s) => s.appointments);
  const loadAppointments = useStore((s) => s.loadAppointments);

  const [state, setState] = useState({ loading: true, data: null, error: false });
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [newlyCompleted, setNewlyCompleted] = useState([]);
  const request = useRef(0);
  const isInitialSyncDone = useRef(false);
  const previousStatuses = useRef(new Map());

  const load = useCallback(async () => {
    const id = ++request.current;
    try {
      const { data } = await queueApi.mine();
      if (id === request.current) setState({ loading: false, data, error: false });
    } catch {
      if (id === request.current) setState((s) => ({ ...s, loading: false, error: true }));
    }
  }, []);

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
        : t.status;

    const isCompleted = effectiveStatus === "COMPLETED";
    const isServing = effectiveStatus === "SERVING";

    return {
      ...t,
      status: effectiveStatus,
      position: isCompleted ? null : isServing ? 1 : t.position ?? index + 1,
      isCheckedIn: true,
      counterNumber: t.counterNumber || aptInStore?.deskNumber || null,
      createdAt: aptInStore?.createdAt || t.createdAt || null,
    };
  });

  const notCheckedInRows = notCheckedIn.map((a, index) => {
    const aptInStore = storeAptMap.get(a.appointmentId);
    const effectiveStatus =
      aptInStore?.status === "COMPLETED" || a.status === "COMPLETED"
        ? "COMPLETED"
        : a.status;

    const isCompleted = effectiveStatus === "COMPLETED";

    return {
      ...a,
      tokenNumber: a.tokenNumber || aptInStore?.tokenNumber || "—",
      status: effectiveStatus,
      position: isCompleted ? null : a.position ?? (queue.length + index + 1),
      citizensAhead: 0,
      counterNumber: a.counterNumber || aptInStore?.deskNumber || null,
      isCheckedIn: false,
      createdAt: aptInStore?.createdAt || a.createdAt || null,
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
      return aptDate === todayStr && a.status !== "CANCELLED" && a.status !== "REJECTED";
    })
    .map((a, index) => {
      const isCompleted = a.status === "COMPLETED";
      return {
        appointmentId: a.id,
        referenceNumber: a.referenceNumber,
        serviceName: a.serviceName,
        departmentName: a.departmentName,
        timeSlot: a.timeSlot,
        tokenNumber: a.tokenNumber || "—",
        status: a.status,
        position: isCompleted ? null : queue.length + notCheckedIn.length + index + 1,
        citizensAhead: 0,
        counterNumber: a.deskNumber || null,
        isCheckedIn: Boolean(a.checkedInAt),
        createdAt: a.createdAt || null,
      };
    });

  const combinedRows = [...queueRows, ...notCheckedInRows, ...extraStoreRows];

  // Sort: SERVING first, then WAITING, then SCHEDULED, and COMPLETED cleanly displayed
  const allRows = combinedRows.sort((a, b) => {
    const order = { SERVING: 1, WAITING: 2, APPROVED: 3, PENDING: 4, COMPLETED: 5 };
    const orderA = order[a.status] || 4;
    const orderB = order[b.status] || 4;
    if (orderA !== orderB) return orderA - orderB;
    return (a.position || 999) - (b.position || 999);
  });

  // Track live completion toast notifications:
  // ONLY fires when an appointment transitions to COMPLETED live during this session
  // (e.g. when the department taps "Complete Service").
  // Baseline on initial load NEVER fires toast.
  useEffect(() => {
    if (!allRows || allRows.length === 0) return;

    // Record baseline statuses on initial data load without showing any toast
    if (!isInitialSyncDone.current) {
      allRows.forEach((row) => {
        const id = String(row.appointmentId || row.referenceNumber || row.id || "");
        if (id) {
          previousStatuses.current.set(id, row.status);
        }
      });
      isInitialSyncDone.current = true;
      return;
    }

    // Subsequent updates: check for a live status transition to COMPLETED
    const liveFinished = [];
    allRows.forEach((row) => {
      const id = String(row.appointmentId || row.referenceNumber || row.id || "");
      if (!id) return;

      const prevStatus = previousStatuses.current.get(id);

      // Transition happened live from an active state to COMPLETED
      if (prevStatus && prevStatus !== "COMPLETED" && row.status === "COMPLETED") {
        liveFinished.push(row);
        setBannerDismissed(false);
        const deptName = row.departmentName || "Civil Registration Department";
        toast.success("Service Completed Successfully", {
          description: `Your service for "${row.serviceName || "appointment"}" has been marked as completed by ${deptName}.`,
          duration: Infinity,
          closeButton: true,
        });
      }

      previousStatuses.current.set(id, row.status);
    });

    if (liveFinished.length > 0) {
      setNewlyCompleted((prev) => [...prev, ...liveFinished]);
    }
  }, [allRows]);

  const completedRows = allRows.filter((r) => r.status === "COMPLETED");
  const servingRows = allRows.filter((r) => r.status === "SERVING");

  // Columns for Citizen My Queue DataTable
  const queueColumns = [
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
          <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600 inline shrink-0" />
            <span>{item.timeSlot ? displayTime(item.timeSlot) : "—"}</span>
          </div>
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
      id: "queuePosition",
      accessorFn: (row) => (row.position != null ? Number(row.position) : row.status === "SERVING" ? 1 : 999),
      header: "Queue Position",
      sortFn: "basic",
      cell: ({ row }) => {
        const isCompleted = row.original.status === "COMPLETED";
        const isServing = row.original.status === "SERVING";
        const pos = row.original.position;

        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Served</span>
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

        return (
          <span className="font-semibold text-slate-800 text-xs">
            {pos !== null && pos !== undefined ? `#${pos}` : "—"}
          </span>
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
        if (status === "SERVING") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Serving
            </span>
          );
        }
        if (status === "WAITING") {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Waiting
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

      {/* Completed Service Notification Banner (shown only when a service was completed live in this session) */}
      {!bannerDismissed && newlyCompleted.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">
                Service Completed Successfully
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                Your service for{" "}
                <strong>
                  {newlyCompleted.map((r) => r.serviceName).filter(Boolean).join(", ")}
                </strong>{" "}
                has been marked as completed by{" "}
                <strong>
                  {newlyCompleted[0]?.departmentName || "Civil Registration Department"}
                </strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="text-emerald-700 hover:text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
            aria-label="Close notification"
            title="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* Main Queue DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={allRows}
          columns={queueColumns}
          getRowId={(row) => String(row.appointmentId || row.referenceNumber || row.id)}
          itemLabel="queue entries"
          minWidth="680px"
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
