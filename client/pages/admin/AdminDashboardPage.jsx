import { MapPin, Globe, Sparkles, Clock, Compass } from "lucide-react";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs">
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Geography Analysis</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Regional service distribution, Kebele mapping, and geographical attendance analytics.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Section - Coming Soon State */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-10 sm:p-16 text-center flex flex-col items-center justify-center min-h-[460px]">
        {/* Animated Icon Badge */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-50 via-indigo-50 to-amber-50 border border-slate-200 flex items-center justify-center shadow-xs">
            <Globe className="w-10 h-10 text-blue-600 animate-pulse" />
          </div>
          <span className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-amber-400 text-white shadow-xs">
            <Clock className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Feature Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold mb-3 border border-blue-100">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Module in Development</span>
        </div>

        {/* Coming Soon Main Heading */}
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          Coming Soon
        </h2>

        {/* Explanation */}
        <p className="text-sm text-slate-500 max-w-lg mb-8 leading-relaxed">
          The Geography Analysis module is currently being finalized. Live Kebele spatial mapping, regional appointment density, and cross-woreda analytics will be available in an upcoming release.
        </p>

        {/* Informational Feature Preview Grid (Zero Mock or Real Data) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-left">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <Compass className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-800">Kebele Mapping</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Geographical distribution of public service desks and administrative boundaries.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Regional Demand</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Spatial density of citizen appointments and service requests across jurisdictions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <Globe className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-bold text-slate-800">Coverage Analytics</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              Accessibility metrics and resource allocation insights across local government offices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
