import { useStore } from "@/context";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function CitizenNotificationsPage() {
  const {
    currentUser,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useStore();

  const userNotifs = notifications.filter(
    (n) => n.userId === currentUser?.id || currentUser?.role === "ADMIN"
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notifications & Alerts</h2>
          <p className="text-xs text-slate-500">
            Real-time updates regarding your appointment reviews, check-ins, and schedule reminders.
          </p>
        </div>

        {userNotifs.some((n) => !n.isRead) && (
          <button
            onClick={markAllNotificationsAsRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs"
          >
            <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {userNotifs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-xs">You have no notifications at this time.</p>
          </div>
        ) : (
          userNotifs.map((n) => (
            <div
              key={n.id}
              onClick={() => markNotificationAsRead(n.id)}
              className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                n.isRead ? "bg-white hover:bg-slate-50/80" : "bg-blue-50/40 hover:bg-blue-50/70"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {n.type === "SUCCESS" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : n.type === "ALERT" || n.type === "WARNING" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                ) : (
                  <Info className="w-4 h-4 text-blue-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                  <span className="text-[10px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
              </div>

              {!n.isRead && (
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

