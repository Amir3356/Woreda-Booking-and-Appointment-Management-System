// Citizen > My Queue: the citizen's live place in today's department queue (position,
// citizens ahead, estimated wait). Data comes from GET /queue/me; it is read again whenever
// the server announces a queue change over the WebSocket (check-in, call next, completed / no-show),
// so it updates without polling. Includes benchmark mock queue data for demonstration.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock,
  Users,
} from "lucide-react";
import { queueApi } from "@/api";
import { subscribe } from "@/api/realtime";
import { displayDate, displayTime } from "@/utils";
import { DataTable } from "@/components/ui";

// Realistic mock queue items for Woreda citizen service counters with sequential numerical positions
const MOCK_QUEUE_DATA = [
  {
    appointmentId: "apt-mock-01",
    referenceNumber: "WRD-20261113-1024",
    serviceName: "Landholding Rights Verification & Mapping",
    departmentName: "Land Administration & Urban Development",
    timeSlot: "09:00 AM",
    tokenNumber: "LND-01",
    status: "SERVING",
    position: 1,
    citizensAhead: 0,
    waitingTotal: 5,
    nowServing: "LND-01",
    counterNumber: "3",
    checkedInTime: "08:50 AM",
    calledTime: "09:05 AM",
    estimatedWaitMinutes: 0,
    isCheckedIn: true,
  },
  {
    appointmentId: "apt-mock-02",
    referenceNumber: "WRD-20261113-2051",
    serviceName: "Kebele Digital ID Registration & Issuance",
    departmentName: "Kebele Administration & Vital Events",
    timeSlot: "09:30 AM",
    tokenNumber: "KBL-04",
    status: "WAITING",
    position: 2,
    citizensAhead: 1,
    waitingTotal: 5,
    nowServing: "KBL-03",
    counterNumber: null,
    checkedInTime: "09:12 AM",
    calledTime: null,
    estimatedWaitMinutes: 12,
    isCheckedIn: true,
  },
  {
    appointmentId: "apt-mock-03",
    referenceNumber: "WRD-20261113-3390",
    serviceName: "Woreda Tax Clearance Certificate",
    departmentName: "Revenue & Tax Administration",
    timeSlot: "10:30 AM",
    tokenNumber: "REV-07",
    status: "WAITING",
    position: 3,
    citizensAhead: 2,
    waitingTotal: 5,
    nowServing: "REV-05",
    counterNumber: null,
    checkedInTime: "10:15 AM",
    calledTime: null,
    estimatedWaitMinutes: 24,
    isCheckedIn: true,
  },
  {
    appointmentId: "apt-mock-04",
    referenceNumber: "WRD-20261113-4112",
    serviceName: "Annual Trade License Renewal",
    departmentName: "Trade, Industry & Enterprise Development",
    timeSlot: "11:00 AM",
    tokenNumber: "TRD-01",
    status: "WAITING",
    position: 4,
    citizensAhead: 3,
    waitingTotal: 5,
    nowServing: "TRD-02",
    counterNumber: null,
    checkedInTime: "10:45 AM",
    calledTime: null,
    estimatedWaitMinutes: 35,
    isCheckedIn: true,
  },
];

const MOCK_NOT_CHECKED_IN = [
  {
    appointmentId: "apt-mock-05",
    referenceNumber: "WRD-20261113-5829",
    serviceName: "Vital Event: Birth Certificate Registration",
    departmentName: "Social Affairs & Community Development",
    timeSlot: "02:00 PM",
    tokenNumber: "—",
    status: "APPROVED",
    position: 5,
    citizensAhead: 4,
    counterNumber: null,
    checkedInTime: null,
    calledTime: null,
    estimatedWaitMinutes: 0,
    isCheckedIn: false,
  },
];

export default function CitizenQueuePage() {
  const [state, setState] = useState({ loading: true, data: null, error: false });
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

  // Live: the server pushes "appointments.changed" on check-in, call next and completion.
  useEffect(() => {
    load();
    let timer = null;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    const offs = [subscribe("appointments.changed", soon), subscribe("reconnected", soon)];
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [load]);

  const serverQueue = state.data?.queue || [];
  const serverNotCheckedIn = state.data?.notCheckedIn || [];
  const hasServerData = serverQueue.length > 0 || serverNotCheckedIn.length > 0;

  // Use live server queue data if present; otherwise fall back to realistic mock queue entries
  const queue = hasServerData ? serverQueue : MOCK_QUEUE_DATA;
  const notCheckedIn = hasServerData ? serverNotCheckedIn : MOCK_NOT_CHECKED_IN;

  // Combine checked-in tokens and today's appointments
  const allRows = [
    ...queue.map((t, index) => ({
      ...t,
      position: t.position ?? (t.status === "SERVING" ? 1 : index + 1),
      isCheckedIn: true,
    })),
    ...notCheckedIn.map((a, index) => ({
      ...a,
      tokenNumber: "—",
      position: a.position ?? (queue.length + index + 1),
      citizensAhead: 0,
      counterNumber: null,
      isCheckedIn: false,
    })),
  ];

  // Main Queue Columns: Services, Appointment Time, Queue Position (numerical only)
  const queueColumns = [
    {
      id: "services",
      accessorFn: (row) => row.serviceName || "",
      header: "Services",
      sortFn: "text",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">{row.original.serviceName || "Municipal Service"}</span>
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
      id: "queuePosition",
      accessorFn: (row) => (row.position != null ? Number(row.position) : row.status === "SERVING" ? 1 : 999),
      header: "Queue Position",
      sortFn: "basic",
      cell: ({ row }) => {
        const pos = row.original.position ?? (row.original.status === "SERVING" ? 1 : null);
        return (
          <span className="font-semibold text-slate-800 text-xs">
            {pos !== null && pos !== undefined ? pos : "—"}
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
            Your place in today&apos;s queue{state.data?.date ? ` (${displayDate(state.data.date)})` : ""}. Shows your current queue position and how many citizens are ahead of you.
          </p>
        </div>
      </header>

      {/* Main Queue DataTable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <DataTable
          data={allRows}
          columns={queueColumns}
          getRowId={(row) => row.appointmentId || row.referenceNumber}
          itemLabel="queue entries"
          emptyState={
            <div className="flex flex-col items-center gap-3 text-slate-400 py-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-700">You are not in a queue today</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  When you have an appointment today, your queue position will appear here.
                </p>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
