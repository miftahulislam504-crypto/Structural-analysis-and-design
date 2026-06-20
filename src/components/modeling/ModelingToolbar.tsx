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
  { id: 'select', label: 'Select',  icon: '↖', shortcut: 'S', color: '#6b7280', available: true },
  { id: 'column', label: 'Column',      icon: '■', shortcut: 'C', color: '#1a56db', available: true },
  { id: 'beam',   label: 'Beam',       icon: '━', shortcut: 'B', color: '#d97706', available: true },
  { id: 'slab',   label: 'Slab',   icon: '▦', shortcut: 'P', color: '#059669', available: false },
  { id: 'wall',   label: 'Wall',    icon: '▌', shortcut: 'W', color: '#7c3aed', available: false },
]

interface Props {
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
}

export default function ModelingToolbar({ activeTool, onToolChange }: Props) {
  const { project, saveProject, isDirty, isSaving } = useProjectStore()
  const { showGrid, toggleGrid } = useUIStore()

  return (
    <div className="h-12 border-b border-[#e5e7eb] bg-[#ffffff] flex items-center px-4 gap-2 shrink-0">

      {/* Drawing tools */}
      <div className="flex items-center gap-1 border-r border-[#e5e7eb] pr-3 mr-1">
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
                ? 'border-opacity-60 text-gray-900'
                : tool.available
                  ? 'border-[#e5e7eb] text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  : 'border-transparent text-gray-400 cursor-not-allowed opacity-40'
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
      <div className="flex items-center gap-1 border-r border-[#e5e7eb] pr-3 mr-1">
        <ToggleButton
          active={showGrid}
          onClick={toggleGrid}
          label="Grid"
          icon="⊞"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Member count badges */}
      {project && (
        <div className="flex items-center gap-3 text-xs font-mono mr-3">
          <span className="text-blue-600">
            ■ {project.members.columns.length} Columns
          </span>
          <span className="text-orange-600">
            ━ {project.members.beams.length} Beams
          </span>
          <span className="text-emerald-600">
            ▦ {project.members.slabs.length} Slabs
          </span>
        </div>
      )}

      {/* Save */}
      <button
        onClick={saveProject}
        disabled={!isDirty || isSaving}
        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
          isDirty
            ? 'border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20'
            : 'border-[#e5e7eb] text-gray-400 cursor-default'
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
          ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600'
          : 'border-[#e5e7eb] text-gray-500 hover:text-gray-700'
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
