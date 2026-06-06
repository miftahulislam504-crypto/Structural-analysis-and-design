import { useNavigate } from 'react-router-dom'
import { useUIStore } from '../../store/useUIStore'
import { useProjectStore } from '../../store/useProjectStore'
import { ActiveModule } from '../../lib/types'

const NAV_ITEMS: {
  module: ActiveModule
  label: string
  icon: string
  phase: number
  available: boolean
}[] = [
  { module: 'dashboard',     label: 'ড্যাশবোর্ড',     icon: '⊞', phase: 1,  available: true },
  { module: 'project_setup', label: 'প্রজেক্ট সেটআপ', icon: '⚙', phase: 1,  available: true },
  { module: 'modeling',      label: 'মডেলিং',         icon: '🏗', phase: 2,  available: true },
  { module: 'loads',         label: 'লোড',            icon: '↓',  phase: 2,  available: false },
  { module: 'analysis',      label: 'অ্যানালাইটিক্যাল',icon: '🧮', phase: 3,  available: true },
  { module: 'design',        label: 'ডিজাইন',         icon: '📐', phase: 6,  available: false },
  { module: 'detailing',     label: 'ডিটেইলিং',       icon: '✏',  phase: 8,  available: false },
  { module: 'drawing',       label: 'ড্রয়িং',         icon: '📄', phase: 9,  available: false },
  { module: 'bbs',           label: 'BBS',            icon: '🔩', phase: 10, available: false },
  { module: 'compliance',    label: 'BNBC চেক',       icon: '✅', phase: 11, available: false },
  { module: 'report',        label: 'রিপোর্ট',         icon: '📋', phase: 12, available: false },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { activeModule, setActiveModule, sidebarOpen, toggleSidebar } = useUIStore()
  const { project, isDirty, saveProject, isSaving } = useProjectStore()

  if (!sidebarOpen) {
    return (
      <div className="w-12 border-r border-[#1e2d4a] bg-[#080d1a] flex flex-col items-center py-4 gap-3">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors text-lg"
        >
          ▶
        </button>
        {NAV_ITEMS.filter(n => n.available).map(n => (
          <button
            key={n.module}
            onClick={() => setActiveModule(n.module)}
            className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all ${
              activeModule === n.module ? 'bg-red-500/20 text-red-400' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={n.label}
          >
            {n.icon}
          </button>
        ))}
      </div>
    )
  }

  return (
    <aside className="w-56 border-r border-[#1e2d4a] bg-[#080d1a] flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[#1e2d4a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-black text-sm">
            C
          </div>
          <span className="text-slate-300 font-mono font-bold text-sm">CivilOS</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="text-slate-600 hover:text-slate-400 transition-colors text-xs"
        >
          ◀
        </button>
      </div>

      {/* Project name */}
      {project && (
        <div className="px-4 py-3 border-b border-[#1e2d4a]">
          <p className="text-xs text-slate-600 font-mono">সক্রিয় প্রজেক্ট</p>
          <p className="text-slate-300 font-mono text-xs font-semibold mt-0.5 truncate">
            {project.meta.name}
          </p>
          <p className="text-xs font-mono mt-0.5" style={{ color: '#64748b' }}>
            {project.meta.projectNo}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Available */}
        <div className="px-3 mb-1">
          <p className="text-xs text-slate-700 font-mono px-1 mb-2 tracking-widest">PHASE 1–3</p>
          {NAV_ITEMS.filter(n => n.available).map(n => (
            <NavButton key={n.module} item={n} active={activeModule === n.module} onClick={() => setActiveModule(n.module)} />
          ))}
        </div>

        {/* Upcoming */}
        <div className="px-3 mt-4">
          <p className="text-xs text-slate-700 font-mono px-1 mb-2 tracking-widest">UPCOMING</p>
          {NAV_ITEMS.filter(n => !n.available).map(n => (
            <div
              key={n.module}
              className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-30 cursor-not-allowed"
            >
              <span className="text-sm w-5 text-center text-slate-500">{n.icon}</span>
              <span className="text-xs font-mono text-slate-500">{n.label}</span>
              <span className="ml-auto text-xs text-slate-700 font-mono">P{n.phase}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="px-4 py-4 border-t border-[#1e2d4a] space-y-2">
        {isDirty && (
          <button
            onClick={saveProject}
            disabled={isSaving}
            className="w-full py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-xs font-semibold hover:bg-red-500/30 transition-all disabled:opacity-50"
          >
            {isSaving ? 'সেভ হচ্ছে...' : '💾 সেভ করুন'}
          </button>
        )}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-2 rounded-lg border border-[#1e2d4a] text-slate-500 font-mono text-xs hover:text-slate-300 hover:border-slate-600 transition-all"
        >
          ← ড্যাশবোর্ড
        </button>
      </div>
    </aside>
  )
}

function NavButton({
  item, active, onClick,
}: {
  item: typeof NAV_ITEMS[0]; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 transition-all text-left ${
        active
          ? 'bg-red-500/15 border border-red-500/20 text-red-400'
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      }`}
    >
      <span className="text-sm w-5 text-center">{item.icon}</span>
      <span className="text-xs font-mono font-medium">{item.label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-400" />}
    </button>
  )
}
