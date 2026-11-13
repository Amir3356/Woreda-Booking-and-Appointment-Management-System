// Officer > Queue: the department's live desk queue.
// Real-time citizen token dispatch, calling system, and counter queue progression.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { describeError, displayTime, formatDate } from "@/utils";
import { DataTable } from "@/components/ui";
import { Check, Clock } from "lucide-react";

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

export default function OfficerQueuePage() {
  const currentUser = useStore((s) => s.currentUser);
  const appointments = useStore((s) => s.appointments);
  const loadAppointments = useStore((s) => s.loadAppointments);
  const updateAppointmentStatus = useStore((s) => s.updateAppointmentStatus);

  const counterNumber = currentUser?.counterNumber || 1;

  const [board, setBoard] = useState({ nowServing: null, waitingList: [] });
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const { data } = await queueApi.board();
      setBoard({ nowServing: data?.nowServing || null, waitingList: data?.waitingList || [] });
    } catch {
      // Keep existing board if server has temporary error
    }
  }, []);

  useEffect(() => {
    loadBoard();
    loadAppointments?.().catch(() => {});
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadBoard();
        loadAppointments?.().catch(() => {});
      }, 300);
    };
    const offs = [subscribe("appointments.changed", soon), subscribe("reconnected", soon)];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [loadBoard, loadAppointments]);

  // Department's appointments that are active or completed (excludes rejected and cancelled)
  const deptAppointments = (appointments || []).filter(
    (a) =>
      Boolean(currentUser?.departmentId) &&
      a.departmentId === currentUser.departmentId &&
      a.status !== "REJECTED" &&
      a.status !== "CANCELLED"
  );

  // Map server board items if present
  const boardServing = board.nowServing ? [board.nowServing] : [];
  const boardWaiting = board.waitingList || [];

  const seenAppointmentIds = new Set();
  const queueRows = [];

  // 1. Process board items first if any
  boardServing.forEach((item) => {
    const matchingApt = deptAppointments.find(
      (a) => a.id === item.appointmentId || a.id === item.id || a.citizenName === item.citizenName
    );
    if (matchingApt) seenAppointmentIds.add(matchingApt.id);
    const slot = matchingApt?.timeSlot || item.timeSlot || item.calledTime || "09:00 AM";
    const checkedTime = item.checkedInTime || (matchingApt?.checkedInAt ? displayTime(matchingApt.checkedInAt) : null);
    const apptMin = parseTimeToMinutes(slot);
    const checkInMin = checkedTime ? parseTimeToMinutes(checkedTime) : apptMin;
    const isLate = Boolean(checkedTime && checkInMin > apptMin);

    queueRows.push({
      id: item.id,
      appointmentId: matchingApt?.id || item.appointmentId || item.id,
      tokenNumber: item.tokenNumber,
      citizenName: item.citizenName || matchingApt?.citizenName || "—",
      serviceName: item.serviceName || matchingApt?.serviceName || "—",
      counterNumber: item.counterNumber || counterNumber,
      date: matchingApt?.date || item.appointmentDate || new Date().toISOString().split("T")[0],
      timeSlot: slot,
      checkedInTime: checkedTime || displayTime(slot),
      status: matchingApt?.status === "COMPLETED" ? "COMPLETED" : "SERVING",
      isLate,
      apptMin,
      checkInMin,
      effectivePriority: Math.max(apptMin, checkInMin),
      createdAt: matchingApt?.createdAt || null,
    });
  });

  boardWaiting.forEach((item) => {
    const matchingApt = deptAppointments.find(
      (a) => a.id === item.appointmentId || a.id === item.id || a.citizenName === item.citizenName
    );
    if (matchingApt) seenAppointmentIds.add(matchingApt.id);
    const slot = matchingApt?.timeSlot || item.timeSlot || "09:00 AM";
    const checkedTime = item.checkedInTime || (matchingApt?.checkedInAt ? displayTime(matchingApt.checkedInAt) : null);
    const apptMin = parseTimeToMinutes(slot);
    const checkInMin = checkedTime ? parseTimeToMinutes(checkedTime) : apptMin;
    const isLate = Boolean(checkedTime && checkInMin > apptMin);

    queueRows.push({
      id: item.id,
      appointmentId: matchingApt?.id || item.appointmentId || item.id,
      tokenNumber: item.tokenNumber,
      citizenName: item.citizenName || matchingApt?.citizenName || "—",
      serviceName: item.serviceName || matchingApt?.serviceName || "—",
      counterNumber: null,
      date: matchingApt?.date || item.appointmentDate || new Date().toISOString().split("T")[0],
      timeSlot: slot,
      checkedInTime: checkedTime || displayTime(slot),
      status: matchingApt?.status === "COMPLETED" ? "COMPLETED" : "WAITING",
      isLate,
      apptMin,
      checkInMin,
      effectivePriority: Math.max(apptMin, checkInMin),
      createdAt: matchingApt?.createdAt || null,
    });
  });

  // 2. Include all department appointments from Appointment sidebar
  deptAppointments.forEach((apt) => {
    if (seenAppointmentIds.has(apt.id)) return;
    const isCompleted = apt.status === "COMPLETED";
    const slot = apt.timeSlot || "09:00 AM";
    const checkedTime = apt.checkedInAt ? displayTime(apt.checkedInAt) : null;
    const apptMin = parseTimeToMinutes(slot);
    const checkInMin = checkedTime ? parseTimeToMinutes(checkedTime) : apptMin;
    const isLate = Boolean(checkedTime && checkInMin > apptMin);

    queueRows.push({
      id: apt.id,
      appointmentId: apt.id,
      tokenNumber: apt.tokenNumber || (apt.referenceNumber ? `WRD-${apt.referenceNumber.slice(-4)}` : "—"),
      citizenName: apt.citizenName || "—",
      serviceName: apt.serviceName || apt.service || "—",
      counterNumber: counterNumber,
      date: apt.date || new Date().toISOString().split("T")[0],
      timeSlot: slot,
      checkedInTime: checkedTime || displayTime(slot),
      status: isCompleted ? "COMPLETED" : (apt.status === "IN_PROGRESS" ? "SERVING" : "WAITING"),
      isLate,
      apptMin,
      checkInMin,
      effectivePriority: Math.max(apptMin, checkInMin),
      createdAt: apt.createdAt,
    });
  });

  // Sort according to Woreda Priority Rules:
  // 1. Serving citizens first, Waiting second, Completed at the bottom
  // 2. Appointment Date (earlier dates first)
  // 3. Appointment Time with Late-Arrival Policy:
  //    - Earlier scheduled appointment time is served first.
  //    - Late arrivals are adjusted to their check-in time (effective priority = max(appointmentTime, checkInTime)),
  //      so they do NOT jump ahead of on-time citizens already waiting.
  // 4. Check-in Time (FIFO): For equal appointment times, earlier check-in is served first.
  // 5. Token number / ID tie-breaker.
  // Note: Booking creation time (createdAt / "Requested At") does NOT determine service priority.
  const sortedRows = [...queueRows].sort((a, b) => {
    const aComp = a.status === "COMPLETED";
    const bComp = b.status === "COMPLETED";
    if (aComp !== bComp) return aComp ? 1 : -1;

    const aServing = a.status === "SERVING";
    const bServing = b.status === "SERVING";
    if (aServing !== bServing) return aServing ? -1 : 1;

    // Earlier appointment date first
    const dateA = a.date || "";
    const dateB = b.date || "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    // Effective Appointment Time (Late-Arrival Policy)
    if (a.effectivePriority !== b.effectivePriority) {
      return a.effectivePriority - b.effectivePriority;
    }

    // Check-in Time (FIFO tie-breaker)
    if (a.checkInMin !== b.checkInMin) {
      return a.checkInMin - b.checkInMin;
    }

    // Deterministic Token / ID tie-breaker
    return String(a.tokenNumber || a.id || "").localeCompare(
      String(b.tokenNumber || b.id || ""),
      undefined,
      { numeric: true }
    );
  });

  // Assign queue positions only to active citizens (SERVING and WAITING).
  // Completed citizens have finished service, so their position is marked as Served / done.
  let activeQueueCounter = 1;
  const allRows = sortedRows.map((row) => {
    const isCompleted = row.status === "COMPLETED";
    return {
      ...row,
      position: isCompleted ? null : activeQueueCounter++,
    };
  });

  const handleFinalize = async (row, status = "COMPLETED") => {
    if (busy) return;
    setBusy(true);
    try {
      const targetId = row.appointmentId || row.id;
      await queueApi.finalize(row.id, status).catch(() => {});
      if (targetId && targetId !== row.id) {
        await queueApi.finalize(targetId, status).catch(() => {});
      }
      if (targetId) {
        await updateAppointmentStatus(targetId, status);
      }
      toast.success(
        `Service for ${row.citizenName || "citizen"} marked as completed.`,
        { duration: 5000 }
      );
      await loadBoard().catch(() => {});
      await loadAppointments().catch(() => {});
    } catch (err) {
      toast.error(describeError(err, "update the service status"), { duration: 5000 });
    } finally {
      setBusy(false);
    }
  };

  // Table Columns
  const queueColumns = [
    {
      id: "queuePosition",
      accessorFn: (row) => (row.position != null ? Number(row.position) : row.status === "SERVING" ? 1 : 999),
      header: "Queue Position",
      sortFn: "basic",
      cell: ({ row }) => {
        if (row.original.status === "COMPLETED") {
          return (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Served</span>
            </span>
          );
        }
        return (
          <span className="font-semibold text-slate-800 text-xs">
            {row.original.position != null ? `#${row.original.position}` : "—"}
          </span>
        );
      },
    },
    {
      id: "citizenName",
      accessorFn: (row) => row.citizenName || "",
      header: "Citizen Name",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900 text-xs">
          {row.original.citizenName || "—"}
        </span>
      ),
    },
    {
      id: "services",
      accessorFn: (row) => row.serviceName || "",
      header: "Services",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="text-slate-700 text-xs">
          {row.original.serviceName || "—"}
        </span>
      ),
    },
    {
      id: "appointmentDate",
      accessorFn: (row) => row.date || "",
      header: "Appointment Date",
      sortFn: "text",
      meta: { className: "text-slate-900 font-semibold whitespace-nowrap text-xs" },
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 text-xs whitespace-nowrap">
          {row.original.date ? formatDate(row.original.date) : "—"}
        </span>
      ),
    },
    {
      id: "appointmentTime",
      accessorFn: (row) => row.timeSlot || "",
      header: "Appointment Time",
      sortFn: "text",
      meta: { className: "text-blue-700 font-bold whitespace-nowrap text-xs" },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-blue-700 text-xs whitespace-nowrap">
              {item.timeSlot ? displayTime(item.timeSlot) : "—"}
            </span>
            {item.isLate && (
              <span
                className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded w-fit"
                title={`Arrived late at ${item.checkedInTime}. Serving priority held behind on-time arrivals according to late-arrival policy.`}
              >
                Late Arrival
              </span>
            )}
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
      meta: { className: "whitespace-nowrap text-xs" },
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
      accessorFn: (row) =>
        row.status === "COMPLETED"
          ? "Completed"
          : row.status === "SERVING"
            ? "Serving"
            : "Waiting",
      header: "Status",
      sortFn: "text",
      cell: ({ row }) => {
        const isCompleted = row.original.status === "COMPLETED";
        const isServing = row.original.status === "SERVING";
        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          );
        }
        if (isServing) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              Serving
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Waiting
          </span>
        );
      },
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => {
        const item = row.original;
        if (item.status === "COMPLETED") {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              <span>Completed</span>
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={() => handleFinalize(item, "COMPLETED")}
            disabled={busy}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Complete citizen service"
          >
            <Check className="w-3 h-3" />
            <span>Complete Service</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Centered Page Header */}
      <div className="w-full text-center">
        <h2 className="text-xl font-bold text-slate-900" style={{ textAlign: "center" }}>
          Queue Management
        </h2>
        <p className="text-xs text-slate-500 mt-1" style={{ textAlign: "center" }}>
          {currentUser?.departmentName ? `${currentUser.departmentName} — ` : ""}
          Service Priority: Appointment Time → Check-in Time (FIFO). Late arrivals are held behind on-time citizens.
        </p>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          columns={queueColumns}
          data={allRows}
          getRowId={(row) => String(row.id)}
          itemLabel="citizens in queue"
          pageSize={10}
          minWidth="1020px"
          emptyState={
            <div className="text-slate-400 py-8 text-center text-xs">
              No citizens currently in queue for this department.
            </div>
          }
        />
      </div>
    </div>
  );
}
