// Officer > Queue: the department's live desk queue.
// Real-time citizen token dispatch, calling system, and counter queue progression.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { describeError, displayTime } from "@/utils";
import { DataTable } from "@/components/ui";
import { Check } from "lucide-react";

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
    queueRows.push({
      id: item.id,
      appointmentId: matchingApt?.id || item.appointmentId || item.id,
      tokenNumber: item.tokenNumber,
      citizenName: item.citizenName || matchingApt?.citizenName || "—",
      serviceName: item.serviceName || matchingApt?.serviceName || "—",
      counterNumber: item.counterNumber || counterNumber,
      checkedInTime: item.calledTime || "09:00 AM",
      status: matchingApt?.status === "COMPLETED" ? "COMPLETED" : "WAITING",
      createdAt: matchingApt?.createdAt || null,
    });
  });

  boardWaiting.forEach((item) => {
    const matchingApt = deptAppointments.find(
      (a) => a.id === item.appointmentId || a.id === item.id || a.citizenName === item.citizenName
    );
    if (matchingApt) seenAppointmentIds.add(matchingApt.id);
    queueRows.push({
      id: item.id,
      appointmentId: matchingApt?.id || item.appointmentId || item.id,
      tokenNumber: item.tokenNumber,
      citizenName: item.citizenName || matchingApt?.citizenName || "—",
      serviceName: item.serviceName || matchingApt?.serviceName || "—",
      counterNumber: null,
      checkedInTime: item.checkedInTime,
      status: matchingApt?.status === "COMPLETED" ? "COMPLETED" : "WAITING",
      createdAt: matchingApt?.createdAt || null,
    });
  });

  // 2. Include all department appointments from Appointment sidebar
  deptAppointments.forEach((apt) => {
    if (seenAppointmentIds.has(apt.id)) return;
    const isCompleted = apt.status === "COMPLETED";
    const checkedTime = apt.checkedInAt
      ? displayTime(apt.checkedInAt)
      : apt.timeSlot
        ? displayTime(apt.timeSlot)
        : "—";

    queueRows.push({
      id: apt.id,
      appointmentId: apt.id,
      tokenNumber: apt.tokenNumber || (apt.referenceNumber ? `WRD-${apt.referenceNumber.slice(-4)}` : "—"),
      citizenName: apt.citizenName || "—",
      serviceName: apt.serviceName || apt.service || "—",
      counterNumber: counterNumber,
      checkedInTime: checkedTime,
      status: isCompleted ? "COMPLETED" : "WAITING",
      createdAt: apt.createdAt,
    });
  });

  // Sort: Waiting/In-progress first, Completed at the bottom; within groups, newest first
  const sortedRows = [...queueRows].sort((a, b) => {
    const aComp = a.status === "COMPLETED";
    const bComp = b.status === "COMPLETED";
    if (aComp !== bComp) return aComp ? 1 : -1;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeB !== timeA) return timeB - timeA;
    return String(b.id || "").localeCompare(String(a.id || ""), undefined, { numeric: true });
  });

  const allRows = sortedRows.map((row, idx) => ({
    ...row,
    position: idx + 1,
  }));

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
      accessorFn: (row) => Number(row.position) || 0,
      header: "Queue Position",
      sortFn: "basic",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 text-xs">
          {row.original.position != null ? row.original.position : "—"}
        </span>
      ),
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
      id: "checkedInTime",
      accessorFn: (row) => row.checkedInTime || "",
      header: "Checked In Time",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="text-slate-600 text-xs">
          {row.original.checkedInTime || "—"}
        </span>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => (row.status === "COMPLETED" ? "Completed" : "Waiting"),
      header: "Status",
      sortFn: "text",
      cell: ({ row }) => {
        const isCompleted = row.original.status === "COMPLETED";
        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Completed
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
          Real-time citizen token dispatch, calling system, and counter queue progression.
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
          minWidth="880px"
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
