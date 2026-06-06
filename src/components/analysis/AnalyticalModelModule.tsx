import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import {
  convertToAnalyticalModel,
  validateAnalyticalModel,
  elementLength,
  ModelValidationResult,
} from '../../core/analysis/modelConverter'
import { AnalyticalModel } from '../../lib/types'

type Tab = 'overview' | 'nodes' | 'elements' | 'restraints'

export default function AnalyticalModelModule() {
  const { project, updateMeta } = useProjectStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [model, setModel] = useState<AnalyticalModel | null>(null)
  const [validation, setValidation] = useState<ModelValidationResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  if (!project) return null

  async function handleGenerate() {
    if (!project) return
    setIsGenerating(true)
    // Small delay for UX
    await new Promise(r => setTimeout(r, 400))
    const newModel = convertToAnalyticalModel(project)
    const val = validateAnalyticalModel(newModel, project)
    setModel(newModel)
    setValidation(val)
    setIsGenerating(false)
  }

  const colElements = model?.elements.filter(e => e.id.startsWith('E_COL')) ?? []
  const bmElements  = model?.elements.filter(e => e.id.startsWith('E_BM'))  ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#1e2d4a] bg-[#080d1a] px-6 shrink-0">
        {([
          { id: 'overview',   label: 'ওভারভিউ',   icon: '⊞' },
          { id: 'nodes',      label: 'নোড',        icon: '●' },
          { id: 'elements',   label: 'এলিমেন্ট',   icon: '━' },
          { id: 'restraints', label: 'সাপোর্ট',    icon: '▲' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-mono border-b-2 transition-all ${
              tab === t.id
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {model && t.id === 'nodes' && (
              <span className="bg-green-500/20 text-green-400 text-xs px-1.5 rounded-full">
                {model.nodes.length}
              </span>
            )}
            {model && t.id === 'elements' && (
              <span className="bg-orange-500/20 text-orange-400 text-xs px-1.5 rounded-full">
                {model.elements.length}
              </span>
            )}
            {model && t.id === 'restraints' && (
              <span className="bg-blue-500/20 text-blue-400 text-xs px-1.5 rounded-full">
                {model.restraints.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'overview' && (
          <OverviewTab
            project={project}
            model={model}
            validation={validation}
            isGenerating={isGenerating}
            onGenerate={handleGenerate}
            colElements={colElements}
            bmElements={bmElements}
          />
        )}
        {tab === 'nodes' && model && (
          <NodesTab model={model} />
        )}
        {tab === 'elements' && model && (
          <ElementsTab model={model} colElements={colElements} bmElements={bmElements} />
        )}
        {tab === 'restraints' && model && (
          <RestraintsTab model={model} />
        )}
        {!model && tab !== 'overview' && (
          <EmptyTab onGenerate={handleGenerate} />
        )}
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────

function OverviewTab({ project, model, validation, isGenerating, onGenerate, colElements, bmElements }: any) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="h-0.5 rounded mb-4" style={{ background: 'linear-gradient(90deg,#22c55e,#06b6d4)' }} />
        <h2 className="text-slate-200 font-mono font-bold text-base">
          Analytical Model Generation
        </h2>
        <p className="text-slate-500 font-mono text-xs mt-1">
          Physical Model → Nodes + Elements + DOF + Boundary Conditions
        </p>
      </div>

      {/* Physical model summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'কলাম',  value: project.members.columns.length, color: '#3b82f6', icon: '■' },
          { label: 'বিম',   value: project.members.beams.length,   color: '#f97316', icon: '━' },
          { label: 'স্ল্যাব', value: project.members.slabs.length,  color: '#22c55e', icon: '▦' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-4"
            style={{ borderColor: s.color + '30', background: s.color + '08' }}>
            <div className="text-xl mb-2">{s.icon}</div>
            <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-600 font-mono mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Conversion flow diagram */}
      <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-5">
        <h3 className="text-slate-400 font-mono text-xs tracking-widest mb-5">CONVERSION FLOW</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label: 'Physical Model', sublabel: 'Column/Beam', color: '#3b82f6' },
            { label: '→', color: '#334155', isArrow: true },
            { label: 'Grid Intersections', sublabel: 'Unique nodes', color: '#06b6d4' },
            { label: '→', color: '#334155', isArrow: true },
            { label: 'DOF Assignment', sublabel: '6 DOF/node', color: '#8b5cf6' },
            { label: '→', color: '#334155', isArrow: true },
            { label: 'Stiffness Matrix', sublabel: 'Phase 4 (DSM)', color: '#22c55e' },
          ].map((item, i) => (
            item.isArrow ? (
              <span key={i} className="text-slate-600 text-xl">→</span>
            ) : (
              <div key={i} className="px-4 py-3 rounded-lg border text-center"
                style={{ borderColor: item.color + '40', background: item.color + '10' }}>
                <div className="text-xs font-mono font-semibold" style={{ color: item.color }}>
                  {item.label}
                </div>
                <div className="text-xs text-slate-600 font-mono mt-0.5">{item.sublabel}</div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || project.members.columns.length === 0}
        className="w-full py-4 rounded-xl bg-gradient-to-r from-green-600 to-cyan-600 text-white font-mono font-bold text-sm hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isGenerating
          ? '⟳ Analytical Model তৈরি হচ্ছে...'
          : model
            ? '↺ পুনরায় Generate করুন'
            : '⚡ Analytical Model Generate করুন'}
      </button>

      {/* Validation results */}
      {validation && (
        <div className="space-y-4">
          {/* Status banner */}
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${
            validation.isValid
              ? 'border-green-500/30 bg-green-500/10'
              : 'border-red-500/30 bg-red-500/10'
          }`}>
            <span className="text-2xl">{validation.isValid ? '✅' : '❌'}</span>
            <div>
              <div className={`font-mono font-bold text-sm ${validation.isValid ? 'text-green-400' : 'text-red-400'}`}>
                {validation.isValid ? 'Model Valid — Phase 4 (DSM Solver) রান করা যাবে' : 'Model-এ সমস্যা আছে'}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                {validation.errors.length} error · {validation.warnings.length} warning
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'মোট নোড',         value: validation.stats.nodeCount,       color: '#22c55e' },
              { label: 'মোট এলিমেন্ট',    value: validation.stats.elementCount,    color: '#f97316' },
              { label: 'কলাম এলিমেন্ট',   value: validation.stats.columnCount,     color: '#3b82f6' },
              { label: 'বিম এলিমেন্ট',    value: validation.stats.beamCount,       color: '#f97316' },
              { label: 'Free DOF',         value: validation.stats.freeDOF,         color: '#8b5cf6' },
              { label: 'Restrained DOF',   value: validation.stats.restrainedDOF,   color: '#06b6d4' },
            ].map(s => (
              <div key={s.label} className="bg-[#0d1221] rounded-lg p-3 border border-[#1e2d4a]">
                <div className="text-xs text-slate-600 font-mono">{s.label}</div>
                <div className="font-mono font-bold text-lg mt-1" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Errors */}
          {validation.errors.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
              <h4 className="text-red-400 font-mono text-xs font-bold tracking-wider">ERRORS</h4>
              {validation.errors.map((err, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono text-red-300">
                  <span>✕</span><span>{err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
              <h4 className="text-yellow-400 font-mono text-xs font-bold tracking-wider">WARNINGS</h4>
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs font-mono text-yellow-300">
                  <span>⚠</span><span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Nodes Tab ─────────────────────────────────────────────────

function NodesTab({ model }: { model: AnalyticalModel }) {
  const [filter, setFilter] = useState<'all' | 'structural' | 'base' | 'master'>('all')

  const filtered = model.nodes.filter(n => {
    if (filter === 'structural') return !n.id.includes('BASE') && !n.id.includes('MASTER')
    if (filter === 'base')   return n.id.includes('BASE')
    if (filter === 'master') return n.id.includes('MASTER')
    return true
  })

  return (
    <div className="max-w-4xl space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {([
          { id: 'all',        label: `সব (${model.nodes.length})` },
          { id: 'structural', label: 'Structural' },
          { id: 'base',       label: 'Base/Support' },
          { id: 'master',     label: 'Master' },
        ] as const).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              filter === f.id
                ? 'border-green-500/40 bg-green-500/15 text-green-400'
                : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2d4a] bg-[#080d1a]">
              <th className="text-left px-4 py-3 text-slate-500">Node ID</th>
              <th className="text-right px-4 py-3 text-slate-500">X (m)</th>
              <th className="text-right px-4 py-3 text-slate-500">Y (m)</th>
              <th className="text-right px-4 py-3 text-slate-500">Z (m)</th>
              <th className="text-center px-4 py-3 text-slate-500">DOF (ux uy uz rx ry rz)</th>
              <th className="text-center px-4 py-3 text-slate-500">Type</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(node => {
              const isBase   = node.id.includes('BASE')
              const isMaster = node.id.includes('MASTER')
              const dofVals  = Object.values(node.dof)
              return (
                <tr key={node.id} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                  <td className="px-4 py-2.5 text-slate-400 max-w-[160px] truncate" title={node.id}>
                    {node.id}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{(node.x / 1000).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{(node.y / 1000).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{(node.z / 1000).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex gap-1 justify-center">
                      {dofVals.map((d, i) => (
                        <span key={i} className={`w-6 text-center rounded text-xs ${
                          d === -1
                            ? 'text-red-400 bg-red-500/10'
                            : 'text-green-400 bg-green-500/10'
                        }`}>
                          {d === -1 ? '✕' : d}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${
                      isBase   ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                      isMaster ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' :
                                 'border-green-500/30 text-green-400 bg-green-500/10'
                    }`}>
                      {isBase ? 'BASE' : isMaster ? 'MASTER' : 'STRUCT'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Elements Tab ──────────────────────────────────────────────

function ElementsTab({ model, colElements, bmElements }: any) {
  const [filter, setFilter] = useState<'all' | 'column' | 'beam'>('all')

  const filtered = filter === 'column' ? colElements
    : filter === 'beam' ? bmElements
    : model.elements

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex gap-2">
        {([
          { id: 'all',    label: `সব (${model.elements.length})` },
          { id: 'column', label: `কলাম (${colElements.length})` },
          { id: 'beam',   label: `বিম (${bmElements.length})` },
        ] as const).map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
              filter === f.id
                ? 'border-orange-500/40 bg-orange-500/15 text-orange-400'
                : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2d4a] bg-[#080d1a]">
              <th className="text-left px-4 py-3 text-slate-500">Element ID</th>
              <th className="text-center px-4 py-3 text-slate-500">Type</th>
              <th className="text-right px-4 py-3 text-slate-500">Length (m)</th>
              <th className="text-right px-4 py-3 text-slate-500">Area (mm²)</th>
              <th className="text-right px-4 py-3 text-slate-500">Ix (mm⁴)</th>
              <th className="text-right px-4 py-3 text-slate-500">E (MPa)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((el: any) => {
              const isCol = el.id.startsWith('E_COL')
              const len   = elementLength(el, model)
              return (
                <tr key={el.id} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                  <td className="px-4 py-2.5 text-slate-400 max-w-[160px] truncate" title={el.id}>{el.id}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${
                      isCol
                        ? 'border-blue-500/30 text-blue-400 bg-blue-500/10'
                        : 'border-orange-500/30 text-orange-400 bg-orange-500/10'
                    }`}>
                      {isCol ? 'COL' : 'BEAM'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{(len / 1000).toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {Math.round(el.sectionProperties.area).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {(el.sectionProperties.Ix / 1e6).toFixed(1)}×10⁶
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {el.materialProperties.E.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Restraints Tab ────────────────────────────────────────────

function RestraintsTab({ model }: { model: AnalyticalModel }) {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2d4a] bg-[#080d1a]">
              <th className="text-left px-4 py-3 text-slate-500">Node ID</th>
              <th className="text-center px-4 py-3 text-slate-500">UX</th>
              <th className="text-center px-4 py-3 text-slate-500">UY</th>
              <th className="text-center px-4 py-3 text-slate-500">UZ</th>
              <th className="text-center px-4 py-3 text-slate-500">RX</th>
              <th className="text-center px-4 py-3 text-slate-500">RY</th>
              <th className="text-center px-4 py-3 text-slate-500">RZ</th>
              <th className="text-center px-4 py-3 text-slate-500">Type</th>
            </tr>
          </thead>
          <tbody>
            {model.restraints.map(r => (
              <tr key={r.nodeId} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                <td className="px-4 py-2.5 text-slate-400 max-w-[140px] truncate" title={r.nodeId}>
                  {r.nodeId}
                </td>
                {[r.ux, r.uy, r.uz, r.rx, r.ry, r.rz].map((v, i) => (
                  <td key={i} className="px-4 py-2.5 text-center">
                    <span className={v ? 'text-red-400' : 'text-slate-700'}>
                      {v ? '✕' : '○'}
                    </span>
                  </td>
                ))}
                <td className="px-4 py-2.5 text-center">
                  <span className="px-2 py-0.5 rounded-full text-xs border border-blue-500/30 text-blue-400 bg-blue-500/10">
                    {r.type.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[#0d1221] rounded-xl border border-[#1e2d4a] p-4">
        <p className="text-xs text-slate-500 font-mono">
          ✕ = restrained (fixed) · ○ = free · মোট {model.restraints.length} support node
        </p>
      </div>
    </div>
  )
}

function EmptyTab({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-500 font-mono text-sm">আগে Analytical Model Generate করুন</p>
      <button onClick={onGenerate}
        className="px-6 py-2.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 font-mono text-sm hover:bg-green-500/30 transition-all">
        ⚡ Generate করুন
      </button>
    </div>
  )
}
