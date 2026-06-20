import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',         color: '#6b7280' },
  in_review: { label: 'In Review',     color: '#d97706' },
  approved:  { label: 'Approved',      color: '#059669' },
  archived:  { label: 'Archived',      color: '#6b7280' },
}

const SYSTEM_LABELS: Record<string, string> = {
  rcc_frame:    'RCC Frame',
  dual_system:  'Dual System',
  shear_wall:   'Shear Wall',
  steel_frame:  'Steel Frame',
  load_bearing: 'Load Bearing',
}

const USE_LABELS: Record<string, string> = {
  residential:   'Residential',
  commercial:    'Commercial',
  industrial:    'Industrial',
  institutional: 'Institutional',
  mixed:         'Mixed',
}

const PHASE_MODULES = [
  { module: 'project_setup', label: 'Project Setup', icon: '⚙️', desc: 'Grid, Materials, Loads', phase: 1, available: true, color: '#dc2626' },
  { module: 'modeling',      label: 'Modeling',       icon: '🏗️', desc: '2D/3D Model Canvas', phase: 2, available: false, color: '#d97706' },
  { module: 'analysis',      label: 'Analysis',       icon: '🧮', desc: 'DSM Frame Solver',   phase: 4, available: false, color: '#059669' },
  { module: 'design',        label: 'Design',         icon: '📐', desc: 'ACI + BNBC Design',  phase: 6, available: false, color: '#1a56db' },
  { module: 'detailing',     label: 'Detailing',      icon: '✏️', desc: 'Rebar Layout',       phase: 8, available: false, color: '#7c3aed' },
  { module: 'compliance',    label: 'BNBC Check',     icon: '✅', desc: 'Compliance Report',   phase: 11, available: false, color: '#059669' },
] as const

export default function DashboardModule() {
  const { project } = useProjectStore()
  const { setActiveModule } = useUIStore()

  if (!project) return null

  const { meta, grid, members, results } = project
  const statusInfo = STATUS_INFO[meta.status] ?? STATUS_INFO.draft

  const totalStories = grid.stories.length
  const buildingHeight = grid.stories.reduce((sum, s) => sum + s.height, 0) / 1000 // m
  const totalColumns = members.columns.length
  const totalBeams = members.beams.length
  const totalSlabs = members.slabs.length

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Project Header Card */}
      <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
        <div className="h-1 rainbow-bar" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900 font-mono truncate">{meta.name}</h1>
              <p className="text-gray-500 text-sm mt-1 font-mono">{meta.projectNo} • {meta.address}</p>
            </div>
            <span
              className="px-3 py-1 rounded-full text-xs font-mono border shrink-0"
              style={{
                color: statusInfo.color,
                borderColor: statusInfo.color + '40',
                background: statusInfo.color + '15',
              }}
            >
              {statusInfo.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <MetaItem label="Structural System" value={SYSTEM_LABELS[meta.structuralSystem] ?? meta.structuralSystem} />
            <MetaItem label="Building Use" value={USE_LABELS[meta.buildingUse] ?? meta.buildingUse} />
            <MetaItem label="Importance Category" value={`Category ${meta.importanceCategory}`} />
            <MetaItem label="Engineer" value={meta.engineer || '—'} />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Stories" value={totalStories || '—'} unit="" color="#1a56db" icon="🏢" />
        <StatCard label="Building Height" value={buildingHeight > 0 ? buildingHeight.toFixed(1) : '—'} unit="m" color="#059669" icon="📏" />
        <StatCard label="Columns" value={totalColumns || '—'} unit="" color="#d97706" icon="⬜" />
        <StatCard label="Beams" value={totalBeams || '—'} unit="" color="#7c3aed" icon="━" />
      </div>

      {/* Building Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Seismic info */}
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
          <h3 className="text-gray-700 font-mono font-semibold text-sm mb-4">🌀 Seismic Parameters</h3>
          <div className="space-y-2">
            <ParamRow label="Seismic Zone" value={`Zone ${project.loads.seismicLoad.seismicZone ?? project.loads.seismicLoad.zone ?? 2}`} />
            <ParamRow label="Site Class" value={project.loads.seismicLoad.siteClass} />
            <ParamRow label="Z (Zone Factor)" value={(project.loads.seismicLoad.Z ?? 0).toString()} />
            <ParamRow label="R (Response Mod.)" value={project.loads.seismicLoad.responseModificationFactor.toString()} />
            <ParamRow label="Analysis Method" value={
              (project.loads.seismicLoad.analysisMethod ?? 'static') === 'static'
                ? 'Static (ELF)'
                : (project.loads.seismicLoad.analysisMethod ?? 'static') === 'response_spectrum'
                ? 'Response Spectrum'
                : 'Time History'
            } />
          </div>
        </div>

        {/* Material info */}
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
          <h3 className="text-gray-700 font-mono font-semibold text-sm mb-4">🧱 Materials</h3>
          <div className="space-y-2">
            <ParamRow label="Concrete Grade" value={project.materials.concrete.grade} />
            <ParamRow label="f'c" value={`${project.materials.concrete.fc} MPa`} />
            <ParamRow label="Ec" value={`${project.materials.concrete.Ec.toLocaleString()} MPa`} />
            <ParamRow label="Steel Grade" value={project.materials.steel.grade} />
            <ParamRow label="fy" value={`${project.materials.steel.fy} MPa`} />
          </div>
        </div>
      </div>

      {/* Analysis Status */}
      <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-5">
        <h3 className="text-gray-700 font-mono font-semibold text-sm mb-4">📊 Analysis Status</h3>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: results.status === 'complete' ? '#059669'
                : results.status === 'running' ? '#d97706'
                : results.status === 'failed' ? '#dc2626'
                : '#6b7280',
            }}
          />
          <span className="text-gray-600 font-mono text-sm">
            {results.status === 'complete' ? '✓ Analysis Complete'
              : results.status === 'running' ? '⟳ Running...'
              : results.status === 'failed' ? '✗ Failed'
              : 'Waiting — run after modeling is complete'}
          </span>
        </div>
      </div>

      {/* Module Cards */}
      <div>
        <h3 className="text-gray-500 font-mono text-xs tracking-widest mb-4">WORKFLOW</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PHASE_MODULES.map((m) => (
            <button
              key={m.module}
              onClick={() => m.available && setActiveModule(m.module as any)}
              disabled={!m.available}
              className={`p-4 rounded-xl border text-left transition-all ${
                m.available
                  ? 'border-[#e5e7eb] bg-[#f9fafb] hover:border-blue-300 hover:bg-white hover:shadow-sm cursor-pointer'
                  : 'border-[#f3f4f6] bg-[#ffffff] opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="text-2xl mb-3">{m.icon}</div>
              <div className="text-xs font-mono font-semibold text-gray-700">{m.label}</div>
              <div className="text-xs text-gray-500 mt-1 font-mono">{m.desc}</div>
              {!m.available && (
                <div className="mt-2 text-xs font-mono" style={{ color: m.color }}>
                  Phase {m.phase}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs font-mono">{label}</p>
      <p className="text-gray-700 text-sm font-mono font-semibold mt-0.5 truncate">{value}</p>
    </div>
  )
}

function StatCard({
  label, value, unit, color, icon,
}: {
  label: string; value: string | number; unit: string; color: string; icon: string
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: color + '30', background: color + '08' }}
    >
      <div className="text-xl mb-2">{icon}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>
        {value}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </div>
      <div className="text-xs text-gray-500 font-mono mt-1">{label}</div>
    </div>
  )
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[#f3f4f6] last:border-0">
      <span className="text-gray-500 text-xs font-mono">{label}</span>
      <span className="text-gray-700 text-xs font-mono font-semibold">{value}</span>
    </div>
  )
}
