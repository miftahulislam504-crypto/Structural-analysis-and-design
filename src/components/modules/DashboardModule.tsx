import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  draft:     { label: 'খসড়া',          color: '#64748b' },
  in_review: { label: 'পর্যালোচনাধীন', color: '#f97316' },
  approved:  { label: 'অনুমোদিত',      color: '#22c55e' },
  archived:  { label: 'সংরক্ষিত',      color: '#475569' },
}

const SYSTEM_LABELS: Record<string, string> = {
  rcc_frame:    'RCC ফ্রেম',
  dual_system:  'ডুয়াল সিস্টেম',
  shear_wall:   'শেয়ার ওয়াল',
  steel_frame:  'স্টিল ফ্রেম',
  load_bearing: 'লোড বেয়ারিং',
}

const USE_LABELS: Record<string, string> = {
  residential:   'আবাসিক',
  commercial:    'বাণিজ্যিক',
  industrial:    'শিল্প',
  institutional: 'প্রাতিষ্ঠানিক',
  mixed:         'মিশ্র',
}

const PHASE_MODULES = [
  { module: 'project_setup', label: 'প্রজেক্ট সেটআপ', icon: '⚙️', desc: 'গ্রিড, উপকরণ, লোড', phase: 1, available: true, color: '#ef4444' },
  { module: 'modeling',      label: 'মডেলিং',         icon: '🏗️', desc: '2D/3D মডেল ক্যানভাস', phase: 2, available: false, color: '#f97316' },
  { module: 'analysis',      label: 'অ্যানালাইসিস',   icon: '🧮', desc: 'DSM ফ্রেম সলভার',    phase: 4, available: false, color: '#22c55e' },
  { module: 'design',        label: 'ডিজাইন',         icon: '📐', desc: 'ACI + BNBC ডিজাইন',  phase: 6, available: false, color: '#3b82f6' },
  { module: 'detailing',     label: 'ডিটেইলিং',       icon: '✏️', desc: 'রিবার লেআউট',       phase: 8, available: false, color: '#8b5cf6' },
  { module: 'compliance',    label: 'BNBC চেক',       icon: '✅', desc: 'কমপ্লায়েন্স রিপোর্ট', phase: 11, available: false, color: '#22c55e' },
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
      <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] overflow-hidden">
        <div className="h-1 rainbow-bar" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-100 font-mono truncate">{meta.name}</h1>
              <p className="text-slate-500 text-sm mt-1 font-mono">{meta.projectNo} • {meta.address}</p>
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
            <MetaItem label="স্ট্রাকচারাল সিস্টেম" value={SYSTEM_LABELS[meta.structuralSystem] ?? meta.structuralSystem} />
            <MetaItem label="ভবনের ব্যবহার" value={USE_LABELS[meta.buildingUse] ?? meta.buildingUse} />
            <MetaItem label="গুরুত্ব শ্রেণী" value={`Category ${meta.importanceCategory}`} />
            <MetaItem label="প্রকৌশলী" value={meta.engineer || '—'} />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="মোট তলা" value={totalStories || '—'} unit="টি" color="#3b82f6" icon="🏢" />
        <StatCard label="ভবন উচ্চতা" value={buildingHeight > 0 ? buildingHeight.toFixed(1) : '—'} unit="m" color="#22c55e" icon="📏" />
        <StatCard label="কলাম" value={totalColumns || '—'} unit="টি" color="#f97316" icon="⬜" />
        <StatCard label="বিম" value={totalBeams || '—'} unit="টি" color="#8b5cf6" icon="━" />
      </div>

      {/* Building Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Seismic info */}
        <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-5">
          <h3 className="text-slate-300 font-mono font-semibold text-sm mb-4">🌀 ভূমিকম্প প্যারামিটার</h3>
          <div className="space-y-2">
            <ParamRow label="সিসমিক জোন" value={`Zone ${project.loads.seismicLoad.seismicZone}`} />
            <ParamRow label="সাইট ক্লাস" value={project.loads.seismicLoad.siteClass} />
            <ParamRow label="Z (Zone Factor)" value={project.loads.seismicLoad.Z.toString()} />
            <ParamRow label="R (Response Mod.)" value={project.loads.seismicLoad.responseModificationFactor.toString()} />
            <ParamRow label="বিশ্লেষণ পদ্ধতি" value={
              project.loads.seismicLoad.analysisMethod === 'static'
                ? 'স্ট্যাটিক (ELF)'
                : project.loads.seismicLoad.analysisMethod === 'response_spectrum'
                ? 'রেসপন্স স্পেকট্রাম'
                : 'টাইম হিস্ট্রি'
            } />
          </div>
        </div>

        {/* Material info */}
        <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-5">
          <h3 className="text-slate-300 font-mono font-semibold text-sm mb-4">🧱 উপকরণ</h3>
          <div className="space-y-2">
            <ParamRow label="কংক্রিট গ্রেড" value={project.materials.concrete.grade} />
            <ParamRow label="f'c" value={`${project.materials.concrete.fc} MPa`} />
            <ParamRow label="Ec" value={`${project.materials.concrete.Ec.toLocaleString()} MPa`} />
            <ParamRow label="স্টিল গ্রেড" value={project.materials.steel.grade} />
            <ParamRow label="fy" value={`${project.materials.steel.fy} MPa`} />
          </div>
        </div>
      </div>

      {/* Analysis Status */}
      <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-5">
        <h3 className="text-slate-300 font-mono font-semibold text-sm mb-4">📊 অ্যানালাইসিস স্ট্যাটাস</h3>
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: results.status === 'complete' ? '#22c55e'
                : results.status === 'running' ? '#f97316'
                : results.status === 'failed' ? '#ef4444'
                : '#475569',
            }}
          />
          <span className="text-slate-400 font-mono text-sm">
            {results.status === 'complete' ? '✓ অ্যানালাইসিস সম্পন্ন'
              : results.status === 'running' ? '⟳ চলছে...'
              : results.status === 'failed' ? '✗ ব্যর্থ হয়েছে'
              : 'অপেক্ষায় আছে — মডেলিং শেষ হলে রান করুন'}
          </span>
        </div>
      </div>

      {/* Module Cards */}
      <div>
        <h3 className="text-slate-500 font-mono text-xs tracking-widest mb-4">WORKFLOW</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PHASE_MODULES.map((m) => (
            <button
              key={m.module}
              onClick={() => m.available && setActiveModule(m.module as any)}
              disabled={!m.available}
              className={`p-4 rounded-xl border text-left transition-all ${
                m.available
                  ? 'border-[#1e2d4a] bg-[#0d1221] hover:border-[#1e3a5f] hover:bg-[#111827] cursor-pointer'
                  : 'border-[#1a2030] bg-[#090e1a] opacity-40 cursor-not-allowed'
              }`}
            >
              <div className="text-2xl mb-3">{m.icon}</div>
              <div className="text-xs font-mono font-semibold text-slate-300">{m.label}</div>
              <div className="text-xs text-slate-600 mt-1 font-mono">{m.desc}</div>
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
      <p className="text-slate-600 text-xs font-mono">{label}</p>
      <p className="text-slate-300 text-sm font-mono font-semibold mt-0.5 truncate">{value}</p>
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
        <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>
      </div>
      <div className="text-xs text-slate-600 font-mono mt-1">{label}</div>
    </div>
  )
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-[#1a2030] last:border-0">
      <span className="text-slate-500 text-xs font-mono">{label}</span>
      <span className="text-slate-300 text-xs font-mono font-semibold">{value}</span>
    </div>
  )
}
