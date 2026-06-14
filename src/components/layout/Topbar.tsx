import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'
import { useAuthStore } from '../../store/useAuthStore'

const MODULE_TITLES: Record<string, string> = {
  dashboard: 'ড্যাশবোর্ড',
  project_setup: 'প্রজেক্ট সেটআপ',
  modeling: 'মডেলিং',
  loads: 'লোড ডেফিনিশন',
  analysis: 'স্ট্রাকচারাল অ্যানালাইসিস',
  design: 'মেম্বার ডিজাইন',
  detailing: 'ডিটেইলিং',
  drawing: 'ড্রয়িং জেনারেশন',
  bbs: 'বার বেন্ডিং শিডিউল',
  compliance: 'BNBC কমপ্লায়েন্স',
  report: 'রিপোর্ট এক্সপোর্ট',
}

export default function Topbar() {
  const { project, isDirty, saveProject, isSaving } = useProjectStore()
  const { activeModule, sidebarOpen, toggleSidebar } = useUIStore()
  const { user } = useAuthStore()

  return (
    <header className="h-14 border-b border-[#1e2d4a] bg-[#080d1a] flex items-center px-4 gap-4 shrink-0 sticky top-0 z-30">
      {/* Sidebar toggle (mobile) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="text-slate-500 hover:text-slate-300 transition-colors text-lg"
        >
          ☰
        </button>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-slate-600 truncate max-w-[120px]">
          {project?.meta.name ?? 'প্রজেক্ট'}
        </span>
        <span className="text-slate-700">/</span>
        <span className="text-slate-300 font-semibold">
          {MODULE_TITLES[activeModule] ?? activeModule}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dirty indicator */}
      {isDirty && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
          <span className="text-orange-400 text-xs font-mono hidden sm:block">সেভ হয়নি</span>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={saveProject}
        disabled={!isDirty || isSaving}
        className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
          isDirty
            ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
            : 'border border-[#1e2d4a] text-slate-600 cursor-default'
        } disabled:opacity-50`}
      >
        {isSaving ? 'সেভ...' : '💾 সেভ'}
      </button>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
        {user?.displayName?.[0]?.toUpperCase() ?? 'E'}
      </div>
    </header>
  )
}
