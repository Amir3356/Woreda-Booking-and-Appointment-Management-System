// Officer > Queue: the department's live desk queue.
// Real-time citizen token dispatch, calling system, and counter queue progression.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context";
import { queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { describeError } from "@/utils";
import { DataTable } from "@/components/ui";
import { Check } from "lucide-react";

// Benchmark mock queue items for Woreda department counter when live queue is empty
const MOCK_QUEUE_ROWS = [
  {
    id: "mock-tok-01",
    tokenNumber: "LND-01",
    citizenName: "Abebe Bikila",
    serviceName: "Landholding Rights Verification & Mapping",
    checkedInTime: "08:50 AM",
    calledTime: "09:05 AM",
    counterNumber: 1,
    status: "COMPLETED",
    position: 1,
  },
  {
    id: "mock-tok-02",
    tokenNumber: "LND-02",
    citizenName: "Tirunesh Dibaba",
    serviceName: "Landholding Rights Verification & Mapping",
    checkedInTime: "09:12 AM",
    calledTime: "09:20 AM",
    counterNumber: 1,
    status: "COMPLETED",
    position: 2,
  },
  {
    id: "mock-tok-03",
    tokenNumber: "LND-03",
    citizenName: "Haile Gebrselassie",
    serviceName: "Title Deed Transfer & Registration",
    checkedInTime: "09:25 AM",
    calledTime: null,
    counterNumber: null,
    status: "WAITING",
    position: 3,
  },
  {
    id: "mock-tok-04",
    tokenNumber: "LND-04",
    citizenName: "Derartu Tulu",
    serviceName: "Cadastral Survey & Boundary Verification",
    checkedInTime: "09:40 AM",
    calledTime: null,
    counterNumber: null,
    status: "WAITING",
    position: 4,
  },
  {
    id: "mock-tok-05",
    tokenNumber: "LND-05",
    citizenName: "Kenenisa Bekele",
    serviceName: "Lease Contract Certification",
    checkedInTime: "10:05 AM",
    calledTime: null,
    counterNumber: null,
    status: "WAITING",
    position: 5,
  },
  {
    id: "mock-tok-06",
    tokenNumber: "LND-06",
    citizenName: "Fatuma Roba",
    serviceName: "Vital Records Archival Search",
    checkedInTime: "10:15 AM",
    calledTime: null,
    counterNumber: null,
    status: "WAITING",
    position: 6,
  },
];

export default function OfficerQueuePage() {
  const currentUser = useStore((s) => s.currentUser);
  const counterNumber = currentUser?.counterNumber || 1;

  const [board, setBoard] = useState({ nowServing: null, waitingList: [] });
  const [mockRows, setMockRows] = useState(MOCK_QUEUE_ROWS);
  const [busy, setBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      const { data } = await queueApi.board();
      setBoard({ nowServing: data?.nowServing || null, waitingList: data?.waitingList || [] });
    } catch (err) {
      toast.error(describeError(err, "load the queue"), { duration: 6000 });
    }
  }, []);

  useEffect(() => {
    loadBoard();
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(loadBoard, 300);
    };
    const offs = [subscribe("appointments.changed", soon), subscribe("reconnected", soon)];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [loadBoard]);

  const hasServerData = Boolean(board.nowServing || (board.waitingList && board.waitingList.length > 0));

  const serverRows = [
    ...(board.nowServing
      ? [
          {
            id: board.nowServing.id,
            tokenNumber: board.nowServing.tokenNumber,
            citizenName: board.nowServing.citizenName,
            serviceName: board.nowServing.serviceName,
            counterNumber: board.nowServing.counterNumber || counterNumber,
            checkedInTime: board.nowServing.calledTime || "09:00 AM",
            status: "WAITING",
            position: 1,
          },
        ]
      : []),
    ...(board.waitingList || []).map((item, index) => ({
      id: item.id,
      tokenNumber: item.tokenNumber,
      citizenName: item.citizenName,
      serviceName: item.serviceName,
      counterNumber: null,
      checkedInTime: item.checkedInTime,
      status: "WAITING",
      position: (board.nowServing ? 2 : 1) + index,
    })),
  ];

  const allRows = hasServerData ? serverRows : mockRows;

  const handleFinalize = async (row, status = "COMPLETED") => {
    if (busy) return;
    setBusy(true);
    try {
      await queueApi.finalize(row.id, status);
      toast.success(
        `Token ${row.tokenNumber} marked as completed.`,
        { duration: 6000 }
      );
      await loadBoard();
    } catch (err) {
      if (!hasServerData) {
        setMockRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: "COMPLETED" } : r))
        );
        toast.success(
          `Token ${row.tokenNumber} marked as completed.`,
          { duration: 6000 }
        );
        return;
      }
      toast.error(describeError(err, "update the queue token"), { duration: 6000 });
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
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
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
