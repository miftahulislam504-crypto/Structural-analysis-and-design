import { DrawingTool } from './ModelingModule'
import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'

interface Tool {
  id: DrawingTool
  label: string
  icon: string
  shortcut: string
  color: string
  available: boolean
}

const TOOLS: Tool[] = [
  { id: 'select', label: 'নির্বাচন',  icon: '↖', shortcut: 'S', color: '#94a3b8', available: true },
  { id: 'column', label: 'কলাম',      icon: '■', shortcut: 'C', color: '#3b82f6', available: true },
  { id: 'beam',   label: 'বিম',       icon: '━', shortcut: 'B', color: '#f97316', available: true },
  { id: 'slab',   label: 'স্ল্যাব',   icon: '▦', shortcut: 'P', color: '#22c55e', available: false },
  { id: 'wall',   label: 'দেওয়াল',    icon: '▌', shortcut: 'W', color: '#8b5cf6', available: false },
]

interface Props {
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
}

export default function ModelingToolbar({ activeTool, onToolChange }: Props) {
  const { project, saveProject, isDirty, isSaving } = useProjectStore()
  const { showGrid, toggleGrid } = useUIStore()

  return (
    <div className="h-12 border-b border-[#1e2d4a] bg-[#080d1a] flex items-center px-4 gap-2 shrink-0">

      {/* Drawing tools */}
      <div className="flex items-center gap-1 border-r border-[#1e2d4a] pr-3 mr-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => tool.available && onToolChange(tool.id)}
            disabled={!tool.available}
            title={`${tool.label} (${tool.shortcut})`}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold
              transition-all border
              ${activeTool === tool.id
                ? 'border-opacity-60 text-white'
                : tool.available
                  ? 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                  : 'border-transparent text-slate-700 cursor-not-allowed opacity-40'
              }
            `}
            style={activeTool === tool.id ? {
              borderColor: tool.color + '60',
              background: tool.color + '20',
              color: tool.color,
            } : {}}
          >
            <span className="text-sm">{tool.icon}</span>
            <span className="hidden sm:inline">{tool.label}</span>
            <span
              className="text-xs opacity-50 hidden lg:inline"
              style={{ fontSize: 9 }}
            >
              [{tool.shortcut}]
            </span>
          </button>
        ))}
      </div>

      {/* View toggles */}
      <div className="flex items-center gap-1 border-r border-[#1e2d4a] pr-3 mr-1">
        <ToggleButton
          active={showGrid}
          onClick={toggleGrid}
          label="গ্রিড"
          icon="⊞"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Member count badges */}
      {project && (
        <div className="flex items-center gap-3 text-xs font-mono mr-3">
          <span className="text-blue-400">
            ■ {project.members.columns.length} কলাম
          </span>
          <span className="text-orange-400">
            ━ {project.members.beams.length} বিম
          </span>
          <span className="text-green-400">
            ▦ {project.members.slabs.length} স্ল্যাব
          </span>
        </div>
      )}

      {/* Save */}
      <button
        onClick={saveProject}
        disabled={!isDirty || isSaving}
        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
          isDirty
            ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
            : 'border-[#1e2d4a] text-slate-700 cursor-default'
        }`}
      >
        {isSaving ? '...' : '💾'}
      </button>
    </div>
  )
}

function ToggleButton({
  active, onClick, label, icon,
}: {
  active: boolean; onClick: () => void; label: string; icon: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
        active
          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
          : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300'
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
