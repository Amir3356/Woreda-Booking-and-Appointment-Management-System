import { useState } from "react";
import { useStore } from "@/context";
import {
  Layers,
  Megaphone,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Volume2,
  Sparkles,
} from "lucide-react";

export default function OfficerQueuePage() {
  const {
    currentUser,
    queue,
    updateQueueStatus,
    callNextCitizen,
  } = useStore();

  const officerDeptId = currentUser?.departmentId || "dept-1";
  const deptQueue = queue.filter((q) => q.departmentId === officerDeptId);

  const currentlyServing = deptQueue.find((q) => q.status === "SERVING");
  const waitingList = deptQueue.filter((q) => q.status === "WAITING");

  const [announcementMsg, setAnnouncementMsg] = useState("");

  const handleCallNext = () => {
    const called = callNextCitizen(officerDeptId, currentUser?.counterNumber || 1);
    if (called) {
      setAnnouncementMsg(`Chime: Token ${called.tokenNumber} please proceed to Counter Desk #1`);
      setTimeout(() => setAnnouncementMsg(""), 5000);
    }
  };

  const handleReAnnounce = () => {
    if (currentlyServing) {
      setAnnouncementMsg(`Chime (Repeat): Token ${currentlyServing.tokenNumber} please proceed to Counter Desk #1`);
      setTimeout(() => setAnnouncementMsg(""), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Live Department Queue Board</h2>
          <p className="text-xs text-slate-500">
            Real-time citizen token dispatch, calling system, and counter queue progression.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCallNext}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0b2545] hover:bg-[#133b5c] text-white text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Megaphone className="w-4 h-4 text-amber-300" />
            <span>Call Next Citizen</span>
          </button>
        </div>
      </div>

      {/* Audio / Announcement Chime Banner */}
      {announcementMsg && (
        <div className="p-4 rounded-2xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-slate-900 animate-bounce" />
            <span className="text-sm">{announcementMsg}</span>
          </div>
          <button onClick={() => setAnnouncementMsg("")} className="text-xs font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Top Split: Serving Card (Lobby Display Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NOW SERVING - Large Display */}
        <div className="lg:col-span-2 bg-gradient-to-br from-[#0b2545] to-[#133b5c] rounded-3xl p-8 text-white shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              NOW SERVING AT COUNTER #1
            </span>
            <span className="text-xs font-medium text-slate-300">
              Department: {currentUser?.departmentName}
            </span>
          </div>

          <div className="my-8 text-center sm:text-left">
            {currentlyServing ? (
              <div>
                <span className="text-xs text-slate-300 uppercase tracking-widest block font-medium">
                  Queue Token Number
                </span>
                <p className="font-mono text-5xl sm:text-7xl font-black text-amber-300 tracking-wider my-2">
                  {currentlyServing.tokenNumber}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white mt-2">
                  {currentlyServing.citizenName}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-300 font-medium">
                  {currentlyServing.serviceName}
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-300">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-xl font-bold">Counter Desk is Open</p>
                <p className="text-xs text-slate-400 mt-1">
                  Ready to serve. Click "Call Next Citizen" to advance the queue.
                </p>
              </div>
            )}
          </div>

          {currentlyServing && (
            <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Clock className="w-4 h-4 text-amber-300" />
                <span>Called at: {currentlyServing.calledTime || "In Session"}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReAnnounce}
                  className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm"
                >
                  Repeat Call
                </button>
                <button
                  onClick={() => updateQueueStatus(currentlyServing.id, "NO_SHOW")}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30"
                >
                  No-Show
                </button>
                <button
                  onClick={() => updateQueueStatus(currentlyServing.id, "COMPLETED")}
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow"
                >
                  Mark Completed
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Queue Summary Quick Box */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Queue Statistics</h3>
            <p className="text-xs text-slate-500">Live lobby capacity & waiting summary</p>

            <div className="space-y-4 my-6">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100">
                <span className="text-[10px] uppercase font-bold text-blue-700">Waiting in Lobby</span>
                <p className="text-3xl font-black text-blue-900 mt-0.5">{waitingList.length}</p>
                <p className="text-[11px] text-blue-600">Citizens waiting with tokens</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] uppercase font-bold text-slate-500">Avg. Turnaround Time</span>
                <p className="text-2xl font-black text-slate-800 mt-0.5">14 Minutes</p>
                <p className="text-[11px] text-emerald-600 font-medium">Optimal flow</p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center border-t border-slate-100 pt-3">
            Tokens are generated on citizen check-in.
          </div>
        </div>
      </div>

      {/* Waiting Citizens Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Next in Line (Waiting Citizens)</h3>
          <span className="text-xs font-semibold text-slate-500">
            {waitingList.length} in waiting room
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {waitingList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No citizens waiting in queue.
            </div>
          ) : (
            waitingList.map((item, index) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    #{index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-blue-700 text-sm">
                        {item.tokenNumber}
                      </span>
                      <span className="font-bold text-slate-900 text-xs">{item.citizenName}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.serviceName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Checked In:</span>
                    <span className="font-medium text-slate-700">{item.checkedInTime}</span>
                  </div>

                  <button
                    onClick={() => {
                      updateQueueStatus(item.id, "SERVING");
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#0b2545] hover:bg-[#133b5c] text-white font-bold text-xs shadow-xs"
                  >
                    Direct Call
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

