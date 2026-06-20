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
  { module: 'dashboard',     label: 'Dashboard',       icon: '⊞', phase: 1,  available: true },
  { module: 'project_setup', label: 'Project Setup',   icon: '⚙', phase: 1,  available: true },
  { module: 'modeling',      label: 'Modeling',        icon: '🏗', phase: 2,  available: true },
  { module: 'loads',         label: 'Lateral Load',    icon: '↓',  phase: 5,  available: true },
  { module: 'analysis',      label: 'DSM Analysis',    icon: '🧮', phase: 4,  available: true },
  { module: 'design',        label: 'RCC Design',      icon: '📐', phase: 6,  available: true },
  { module: 'detailing',     label: 'Detailing',       icon: '✏', phase: 8,  available: true },
  { module: 'drawing',       label: 'Drawings',        icon: '📄', phase: 9,  available: true },
  { module: 'bbs',           label: 'BBS',             icon: '🔩', phase: 10, available: true },
  { module: 'compliance',    label: 'BNBC Check',      icon: '✅', phase: 11, available: true },
  { module: 'report',        label: 'Report',          icon: '📋', phase: 12, available: true },
  { module: 'optimization',  label: 'Optimization',    icon: '⚡', phase: 13, available: true },
  { module: 'bim',           label: 'BIM Integration', icon: '🔗', phase: 14, available: true },
  { module: 'fem',           label: 'Advanced FEM',    icon: '🔬', phase: 15, available: true },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { activeModule, setActiveModule, sidebarOpen, toggleSidebar } = useUIStore()
  const { project, isDirty, saveProject, isSaving } = useProjectStore()

  if (!sidebarOpen) {
    return (
      <div className="w-12 border-r border-gray-200 bg-gray-50 flex flex-col items-center py-4 gap-3">
        <button
          onClick={toggleSidebar}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-lg"
        >
          ▶
        </button>
        {NAV_ITEMS.filter(n => n.available).map(n => (
          <button
            key={n.module}
            onClick={() => setActiveModule(n.module)}
            className={`w-8 h-8 flex items-center justify-center rounded text-sm transition-all ${
              activeModule === n.module ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-600'
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
    <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-black text-sm">
            C
          </div>
          <span className="text-gray-800 font-mono font-bold text-sm">CivilOS</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-gray-600 transition-colors text-xs"
        >
          ◀
        </button>
      </div>

      {/* Project name */}
      {project && (
        <div className="px-4 py-3 border-b border-gray-200">
          <p className="text-xs text-gray-400 font-mono">Active Project</p>
          <p className="text-gray-800 font-mono text-xs font-semibold mt-0.5 truncate">
            {project.meta.name}
          </p>
          <p className="text-xs font-mono mt-0.5 text-gray-500">
            {project.meta.projectNo}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {/* Available */}
        <div className="px-3 mb-1">
          <p className="text-xs text-gray-400 font-mono px-1 mb-2 tracking-widest">PHASE 1–15</p>
          {NAV_ITEMS.filter(n => n.available).map(n => (
            <NavButton key={n.module} item={n} active={activeModule === n.module} onClick={() => setActiveModule(n.module)} />
          ))}
        </div>

        {/* Upcoming */}
        <div className="px-3 mt-4">
          <p className="text-xs text-gray-400 font-mono px-1 mb-2 tracking-widest">UPCOMING</p>
          {NAV_ITEMS.filter(n => !n.available).map(n => (
            <div
              key={n.module}
              className="flex items-center gap-3 px-3 py-2 rounded-lg opacity-40 cursor-not-allowed"
            >
              <span className="text-sm w-5 text-center text-gray-400">{n.icon}</span>
              <span className="text-xs font-mono text-gray-400">{n.label}</span>
              <span className="ml-auto text-xs text-gray-300 font-mono">P{n.phase}</span>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="px-4 py-4 border-t border-gray-200 space-y-2">
        {isDirty && (
          <button
            onClick={saveProject}
            disabled={isSaving}
            className="w-full py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 font-mono text-xs font-semibold hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>
        )}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-full py-2 rounded-lg border border-gray-200 text-gray-500 font-mono text-xs hover:text-gray-700 hover:border-gray-300 transition-all"
        >
          ← Dashboard
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
          ? 'bg-blue-50 border border-blue-200 text-blue-700'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
      }`}
    >
      <span className="text-sm w-5 text-center">{item.icon}</span>
      <span className="text-xs font-mono font-medium">{item.label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
    </button>
  )
}
