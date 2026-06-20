import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'
import { useAuthStore } from '../../store/useAuthStore'

const MODULE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  project_setup: 'Project Setup',
  modeling: 'Modeling',
  loads: 'Load Definition',
  analysis: 'Structural Analysis',
  design: 'Member Design',
  detailing: 'Detailing',
  drawing: 'Drawing Generation',
  bbs: 'Bar Bending Schedule',
  compliance: 'BNBC Compliance',
  report: 'Report Export',
}

export default function Topbar() {
  const { project, isDirty, saveProject, isSaving } = useProjectStore()
  const { activeModule, sidebarOpen, toggleSidebar } = useUIStore()
  const { user } = useAuthStore()

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center px-4 gap-4 shrink-0 sticky top-0 z-30">
      {/* Sidebar toggle (mobile) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-gray-600 transition-colors text-lg"
        >
          ☰
        </button>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-gray-400 truncate max-w-[120px]">
          {project?.meta.name ?? 'Project'}
        </span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-800 font-semibold">
          {MODULE_TITLES[activeModule] ?? activeModule}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Dirty indicator */}
      {isDirty && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-600 text-xs font-mono hidden sm:block">Unsaved</span>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={saveProject}
        disabled={!isDirty || isSaving}
        className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
          isDirty
            ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
            : 'border border-gray-200 text-gray-400 cursor-default'
        } disabled:opacity-50`}
      >
        {isSaving ? 'Saving...' : '💾 Save'}
      </button>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
        {user?.displayName?.[0]?.toUpperCase() ?? 'E'}
      </div>
    </header>
  )
}
