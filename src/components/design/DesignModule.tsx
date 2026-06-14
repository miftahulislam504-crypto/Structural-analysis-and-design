import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'
import { designBeam, BeamDesignOutput } from '../../core/design/beamDesign'
import { designColumn, ColumnDesignOutput } from '../../core/design/columnDesign'
import { designSlab, SlabDesignOutput } from '../../core/design/slabDesign'
import { designFooting, FootingDesignOutput } from '../../core/design/footingDesign'

type Tab = 'beam' | 'column' | 'slab' | 'footing'

export default function DesignModule() {
  const { project } = useProjectStore()
  const [tab, setTab] = useState<Tab>('beam')
  if (!project) return null

  const TABS = [
    { id: 'beam',    label: '━ বিম ডিজাইন',    color: '#f97316', count: project.members.beams.length },
    { id: 'column',  label: '■ কলাম ডিজাইন',  color: '#3b82f6', count: project.members.columns.length },
    { id: 'slab',    label: '▦ স্ল্যাব ডিজাইন', color: '#22c55e', count: project.members.slabs.length },
    { id: 'footing', label: '▲ ফুটিং ডিজাইন',  color: '#8b5cf6', count: project.members.foundations.length },
  ] as const

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#1e2d4a] bg-[#080d1a] px-6 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-mono border-b-2 transition-all shrink-0 ${
              tab === t.id ? 'text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
            style={tab === t.id ? { borderColor: t.color, color: t.color } : {}}>
            {t.label}
            <span className="text-xs px-1.5 rounded-full"
              style={{ background: t.color + '20', color: t.color }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'beam'    && <BeamDesignTab    project={project} />}
        {tab === 'column'  && <ColumnDesignTab  project={project} />}
        {tab === 'slab'    && <SlabDesignTab    project={project} />}
        {tab === 'footing' && <FootingDesignTab project={project} />}
      </div>
    </div>
  )
}

// ── Beam Design Tab ───────────────────────────────────────────

function BeamDesignTab({ project }: { project: any }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [manualMu, setManualMu] = useState({ pos: 80, neg: 120, vu: 60, tu: 0 })

  const beams = project.members.beams

  const result = useMemo<BeamDesignOutput | null>(() => {
    const beam = beams.find((b: any) => b.id === selected)
    if (!beam) return null
    try {
      return designBeam({
        beam,
        Mu_pos:      manualMu.pos,
        Mu_neg:      manualMu.neg,
        Vu_max:      manualMu.vu,
        Tu:          manualMu.tu,
        fc:          project.materials.concrete.fc,
        fy:          project.materials.steel.fy,
        fyt:         project.materials.steel.fyt,
        Es:          project.materials.steel.Es,
        lambda:      1.0,
        seismicZone: project.loads.seismicLoad.seismicZone,
      })
    } catch { return null }
  }, [selected, manualMu, project.materials])

  if (beams.length === 0) return <EmptyMembers type="বিম" module="modeling" />

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader title="বিম ডিজাইন — ACI 318-19 §9" color="#f97316"
        subtitle="Flexure §9.3 · Shear §22.5 · Torsion §22.7 · Deflection §24" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: member list + inputs */}
        <div className="space-y-4">
          {/* Beam selector */}
          <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
            <div className="px-4 py-3 bg-[#080d1a] border-b border-[#1e2d4a]">
              <span className="text-slate-500 font-mono text-xs">বিম সিলেক্ট করুন</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {beams.map((b: any) => (
                <button key={b.id} onClick={() => setSelected(b.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a2030] last:border-0 transition-all ${
                    selected === b.id
                      ? 'bg-orange-500/15 border-l-2 border-l-orange-500'
                      : 'hover:bg-white/2'
                  }`}>
                  <div className="text-slate-300 font-mono text-xs font-semibold">{b.label}</div>
                  <div className="text-slate-600 font-mono text-xs mt-0.5">
                    {(b.section as any).width ?? 250}×{(b.section as any).depth ?? 450} mm
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual force input */}
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4 space-y-3">
            <h4 className="text-slate-400 font-mono text-xs tracking-wider">DESIGN FORCES</h4>
            {[
              { key: 'pos', label: '+Mu (kN·m)', hint: 'Positive moment' },
              { key: 'neg', label: '-Mu (kN·m)', hint: 'Negative moment' },
              { key: 'vu',  label: 'Vu (kN)',    hint: 'Max shear' },
              { key: 'tu',  label: 'Tu (kN·m)',  hint: 'Torsion' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 font-mono">{f.label}</label>
                <input type="number"
                  value={(manualMu as any)[f.key]}
                  onChange={e => setManualMu(m => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className="input-field mt-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              {/* Flexure results */}
              <ResultCard title="📐 Flexure Design" color="#f97316">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 font-mono mb-2">Bottom Steel (+Mu)</div>
                    <RebarDisplay layout={result.flexure.bars_pos}
                      As_req={result.flexure.As_pos_req} color="#f97316" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-mono mb-2">Top Steel (-Mu)</div>
                    <RebarDisplay layout={result.flexure.bars_neg}
                      As_req={result.flexure.As_neg_req} color="#f97316" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-mono">
                  <MiniStat label="As_min" value={`${result.flexure.As_min} mm²`} />
                  <MiniStat label="As_max" value={`${result.flexure.As_max} mm²`} />
                </div>
              </ResultCard>

              {/* Shear results */}
              <ResultCard title="✂ Shear Design" color="#ef4444">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <MiniStat label="φVc"    value={`${result.shear.Vc} kN`} />
                  <MiniStat label="Vs_req" value={`${result.shear.Vs_req} kN`} />
                  <MiniStat label="s_mid"  value={`${result.shear.stirrupSpacing_mid} mm`} color="#22c55e" />
                  <MiniStat label="s_end"  value={`${result.shear.stirrupSpacing_end} mm`} color="#f97316" />
                </div>
                <div className="mt-3 text-xs font-mono text-slate-400">
                  Stirrup: {result.shear.stirrupLegs}-leg #{result.shear.stirrupBar}mm @
                  {result.shear.stirrupSpacing_end}mm (end) / {result.shear.stirrupSpacing_mid}mm (mid)
                </div>
              </ResultCard>

              {/* Deflection */}
              <ResultCard title="↕ Deflection Check" color="#06b6d4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <MiniStat label="δ_immediate" value={`${result.deflection.delta_immediate} mm`} />
                  <MiniStat label="δ_long-term" value={`${result.deflection.delta_longterm} mm`} />
                  <MiniStat label="Limit L/240"  value={`${result.deflection.limit_total} mm`} />
                  <MiniStat label="Status"
                    value={result.deflection.passed ? 'PASS ✓' : 'FAIL ✗'}
                    color={result.deflection.passed ? '#22c55e' : '#ef4444'} />
                </div>
              </ResultCard>
            </>
          ) : (
            <SelectPrompt label="বাম দিক থেকে একটি বিম সিলেক্ট করুন" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Column Design Tab ─────────────────────────────────────────

function ColumnDesignTab({ project }: { project: any }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [forces, setForces] = useState({ Pu: 800, Mux: 60, Muy: 40, lu: 3000 })

  const columns = project.members.columns

  const result = useMemo<ColumnDesignOutput | null>(() => {
    const col = columns.find((c: any) => c.id === selected)
    if (!col) return null
    try {
      return designColumn({
        column:      col,
        Pu:          forces.Pu,
        Mux:         forces.Mux,
        Muy:         forces.Muy,
        lu:          forces.lu,
        fc:          project.materials.concrete.fc,
        fy:          project.materials.steel.fy,
        seismicZone: project.loads.seismicLoad.seismicZone,
      })
    } catch { return null }
  }, [selected, forces, project.materials])

  if (columns.length === 0) return <EmptyMembers type="কলাম" module="modeling" />

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader title="কলাম ডিজাইন — ACI 318-19 §10" color="#3b82f6"
        subtitle="Axial+Uniaxial §22.4 · Biaxial Bresler · P-M Diagram · Slenderness §6.6.4" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
            <div className="px-4 py-3 bg-[#080d1a] border-b border-[#1e2d4a]">
              <span className="text-slate-500 font-mono text-xs">কলাম সিলেক্ট করুন</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {columns.map((c: any) => (
                <button key={c.id} onClick={() => setSelected(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a2030] last:border-0 transition-all ${
                    selected === c.id ? 'bg-blue-500/15 border-l-2 border-l-blue-500' : 'hover:bg-white/2'
                  }`}>
                  <div className="text-slate-300 font-mono text-xs font-semibold">{c.label}</div>
                  <div className="text-slate-600 font-mono text-xs mt-0.5">
                    {c.section.type === 'rectangular'
                      ? `${c.section.width}×${c.section.depth} mm`
                      : `⌀${c.section.diameter} mm`}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4 space-y-3">
            <h4 className="text-slate-400 font-mono text-xs tracking-wider">DESIGN FORCES</h4>
            {[
              { key: 'Pu',  label: 'Pu (kN)',   },
              { key: 'Mux', label: 'Mux (kN·m)' },
              { key: 'Muy', label: 'Muy (kN·m)' },
              { key: 'lu',  label: 'lu (mm)',    },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 font-mono">{f.label}</label>
                <input type="number" value={(forces as any)[f.key]}
                  onChange={e => setForces(m => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className="input-field mt-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              {/* Longitudinal bars */}
              <ResultCard title="■ Longitudinal Reinforcement" color="#3b82f6">
                <RebarDisplay layout={result.longitudinalBars} As_req={0} color="#3b82f6" />
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-mono">
                  <MiniStat label="φPn0 (max axial)" value={`${result.phiPn0} kN`} />
                  <MiniStat label="Pn_max"           value={`${result.Pn_max} kN`} />
                  <MiniStat label="Tie Bar"          value={`#${result.tieBar}mm`} />
                  <MiniStat label="Tie Spacing"      value={`${result.tieSpacing} mm`} />
                </div>
              </ResultCard>

              {/* P-M Diagram */}
              <ResultCard title="📈 P-M Interaction Diagram" color="#8b5cf6">
                <PMDiagramChart
                  points={result.pmDiagram}
                  Pu={result.Pu}
                  Mu={Math.sqrt(result.Mux**2 + result.Muy**2)}
                />
              </ResultCard>

              {/* Slenderness */}
              <ResultCard title="📏 Slenderness" color="#64748b">
                <div className="text-xs font-mono text-slate-400">
                  {result.isSlender
                    ? '⚠ Slender Column — moment magnification needed (ACI 6.6.4)'
                    : '✓ Short Column — slenderness effects negligible'}
                </div>
              </ResultCard>
            </>
          ) : (
            <SelectPrompt label="বাম দিক থেকে একটি কলাম সিলেক্ট করুন" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Slab Design Tab ───────────────────────────────────────────

function SlabDesignTab({ project }: { project: any }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [params, setParams] = useState({ ln: 4500, ln2: 5500, wu: 12 })

  const slabs = project.members.slabs

  const result = useMemo<SlabDesignOutput | null>(() => {
    const slab = slabs.find((s: any) => s.id === selected)
    if (!slab) return null
    try {
      return designSlab({
        slab,
        ln:     params.ln,
        ln2:    params.ln2,
        wu:     params.wu,
        fc:     project.materials.concrete.fc,
        fy:     project.materials.steel.fy,
        lambda: 1.0,
      })
    } catch { return null }
  }, [selected, params, project.materials])

  if (slabs.length === 0) return <EmptyMembers type="স্ল্যাব" module="modeling" />

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader title="স্ল্যাব ডিজাইন — ACI 318-19 §7, §8" color="#22c55e"
        subtitle="One-Way: Coefficient Method · Two-Way: DDM · Punching §22.6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
            <div className="px-4 py-3 bg-[#080d1a] border-b border-[#1e2d4a]">
              <span className="text-slate-500 font-mono text-xs">স্ল্যাব সিলেক্ট করুন</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {slabs.map((s: any) => (
                <button key={s.id} onClick={() => setSelected(s.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a2030] last:border-0 transition-all ${
                    selected === s.id ? 'bg-green-500/15 border-l-2 border-l-green-500' : 'hover:bg-white/2'
                  }`}>
                  <div className="text-slate-300 font-mono text-xs font-semibold">{s.label}</div>
                  <div className="text-slate-600 font-mono text-xs mt-0.5">
                    {s.type} · {s.thickness}mm
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4 space-y-3">
            <h4 className="text-slate-400 font-mono text-xs tracking-wider">PARAMETERS</h4>
            {[
              { key: 'ln',  label: 'Short Span ln (mm)' },
              { key: 'ln2', label: 'Long Span ln2 (mm)' },
              { key: 'wu',  label: 'wu (kN/m²)'         },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 font-mono">{f.label}</label>
                <input type="number" value={(params as any)[f.key]}
                  onChange={e => setParams(m => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className="input-field mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              <ResultCard title="▦ Slab Reinforcement" color="#22c55e">
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: 'X-Bottom',  As: result.As_x_bot, bar: result.barX },
                    { label: 'X-Top',     As: result.As_x_top, bar: result.barX },
                    { label: 'Y-Bottom',  As: result.As_y_bot, bar: result.barY },
                    { label: 'Y-Top',     As: result.As_y_top, bar: result.barY },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="text-xs text-slate-500 font-mono mb-2">{r.label}</div>
                      <div className="text-green-400 font-mono text-sm font-bold">
                        #{r.bar.barDiameter}mm @ {r.bar.clearSpacing}mm
                      </div>
                      <div className="text-slate-500 font-mono text-xs">
                        As = {r.As.toFixed(0)} mm²/m
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MiniStat label="+Mu" value={`${result.Mu_pos.toFixed(2)} kN·m/m`} />
                  <MiniStat label="-Mu" value={`${result.Mu_neg.toFixed(2)} kN·m/m`} />
                </div>
              </ResultCard>

              {result.punchingCheck && (
                <ResultCard title="⬛ Punching Shear" color={result.punchingCheck.passed ? '#22c55e' : '#ef4444'}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="Vu"    value={`${result.punchingCheck.Vu} kN`} />
                    <MiniStat label="φVc"   value={`${result.punchingCheck.phiVc} kN`} />
                    <MiniStat label="Ratio" value={result.punchingCheck.ratio.toFixed(3)}
                      color={result.punchingCheck.passed ? '#22c55e' : '#ef4444'} />
                    <MiniStat label="bo"    value={`${result.punchingCheck.criticalPerimeter} mm`} />
                  </div>
                </ResultCard>
              )}
            </>
          ) : (
            <SelectPrompt label="বাম দিক থেকে একটি স্ল্যাব সিলেক্ট করুন" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Footing Design Tab ────────────────────────────────────────

function FootingDesignTab({ project }: { project: any }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [forces, setForces] = useState({ Pu: 1200, Pa: 900, Mux: 40, Muy: 30 })

  const foundations = project.members.foundations

  const result = useMemo<FootingDesignOutput | null>(() => {
    const fdn = foundations.find((f: any) => f.id === selected)
    if (!fdn) return null
    const col = project.members.columns[0]
    try {
      return designFooting({
        foundation: fdn,
        Pu:        forces.Pu,
        Mu_x:      forces.Mux,
        Mu_y:      forces.Muy,
        Pa:        forces.Pa,
        col_bx:    col?.section?.width  ?? 300,
        col_by:    col?.section?.depth  ?? 400,
        fc:        project.materials.concrete.fc,
        fy:        project.materials.steel.fy,
        lambda:    1.0,
      })
    } catch { return null }
  }, [selected, forces, project])

  if (foundations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="text-5xl">▲</div>
        <h3 className="text-slate-300 font-mono font-bold">কোনো ফুটিং নেই</h3>
        <p className="text-slate-600 font-mono text-sm max-w-xs">
          প্রজেক্ট সেটআপ থেকে Foundation যোগ করুন — Phase 7-এ auto-foundation আসবে
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <SectionHeader title="ফুটিং ডিজাইন — ACI 318-19 §13" color="#8b5cf6"
        subtitle="Bearing §13.2.6 · Punching §22.6.5 · One-Way Shear · Flexure §13.2.7" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
            <div className="px-4 py-3 bg-[#080d1a] border-b border-[#1e2d4a]">
              <span className="text-slate-500 font-mono text-xs">ফুটিং সিলেক্ট করুন</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {foundations.map((f: any) => (
                <button key={f.id} onClick={() => setSelected(f.id)}
                  className={`w-full text-left px-4 py-3 border-b border-[#1a2030] last:border-0 transition-all ${
                    selected === f.id ? 'bg-purple-500/15 border-l-2 border-l-purple-500' : 'hover:bg-white/2'
                  }`}>
                  <div className="text-slate-300 font-mono text-xs font-semibold">{f.label}</div>
                  <div className="text-slate-600 font-mono text-xs mt-0.5">
                    {f.length/1000}×{f.width/1000}m · t={f.thickness}mm
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4 space-y-3">
            <h4 className="text-slate-400 font-mono text-xs tracking-wider">DESIGN FORCES</h4>
            {[
              { key: 'Pu',  label: 'Pu (kN) — factored' },
              { key: 'Pa',  label: 'Pa (kN) — service'  },
              { key: 'Mux', label: 'Mux (kN·m)'         },
              { key: 'Muy', label: 'Muy (kN·m)'         },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-slate-500 font-mono">{f.label}</label>
                <input type="number" value={(forces as any)[f.key]}
                  onChange={e => setForces(m => ({ ...m, [f.key]: Number(e.target.value) }))}
                  className="input-field mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              <ResultCard title="▲ Bearing Pressure" color="#8b5cf6">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="q_max"  value={`${result.bearingPressure.q_max} kN/m²`}
                    color={result.bearingPressure.passed ? '#22c55e' : '#ef4444'} />
                  <MiniStat label="q_min"  value={`${result.bearingPressure.q_min} kN/m²`} />
                  <MiniStat label="q_all"  value={`${result.bearingPressure.q_allowable} kN/m²`} />
                </div>
              </ResultCard>

              <ResultCard title="🔩 Footing Reinforcement" color="#8b5cf6">
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <div className="text-slate-500 mb-1">X-direction</div>
                    <div className="text-purple-400 font-bold text-sm">
                      #{result.flexure.bars_pos.barDiameter}mm × {result.flexure.bars_pos.noOfBars} bars
                    </div>
                    <div className="text-slate-500">As = {result.flexure.As_pos_req} mm²</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Required depth</div>
                    <div className="text-purple-400 font-bold text-sm">{result.d_required} mm</div>
                    <div className="text-slate-500">Net q = {result.q_net} kN/m²</div>
                  </div>
                </div>
              </ResultCard>

              {result.punching && (
                <ResultCard title="⬛ Punching Shear" color={result.punching.passed ? '#22c55e' : '#ef4444'}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="Vu"    value={`${result.punching.Vu} kN`} />
                    <MiniStat label="φVc"   value={`${result.punching.phiVc} kN`} />
                    <MiniStat label="Ratio" value={result.punching.ratio.toFixed(3)}
                      color={result.punching.passed ? '#22c55e' : '#ef4444'} />
                    <MiniStat label="Status" value={result.punching.passed ? 'PASS ✓' : 'FAIL ✗'}
                      color={result.punching.passed ? '#22c55e' : '#ef4444'} />
                  </div>
                </ResultCard>
              )}
            </>
          ) : (
            <SelectPrompt label="বাম দিক থেকে একটি ফুটিং সিলেক্ট করুন" />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared UI Components ──────────────────────────────────────

function SectionHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div>
      <div className="h-0.5 rounded mb-4" style={{ background: `linear-gradient(90deg,${color},transparent)` }} />
      <h2 className="text-slate-200 font-mono font-bold text-base">{title}</h2>
      <p className="text-slate-500 font-mono text-xs mt-1">{subtitle}</p>
    </div>
  )
}

function ResultCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-[#0d1221] overflow-hidden"
      style={{ borderColor: color + '30' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: color + '20', background: color + '08' }}>
        <span className="font-mono font-semibold text-sm" style={{ color }}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function StatusBanner({ status, warnings }: { status: string; warnings: string[] }) {
  const ok = status === 'ok'
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${
      ok ? 'border-green-500/30 bg-green-500/8' : 'border-red-500/30 bg-red-500/8'
    }`}>
      <span className="text-2xl">{ok ? '✅' : '❌'}</span>
      <div>
        <div className={`font-mono font-bold text-sm ${ok ? 'text-green-400' : 'text-red-400'}`}>
          {ok ? 'Design OK — সব check pass' : 'Design FAIL — নিচের warnings দেখুন'}
        </div>
        {warnings.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {warnings.map((w, i) => (
              <div key={i} className="text-xs font-mono text-yellow-300 flex gap-1">
                <span>⚠</span><span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChecksGrid({ checks }: { checks: any[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {checks.map((c, i) => (
        <div key={i} className={`rounded-lg border px-3 py-2 ${
          c.passed ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'
        }`}>
          <div className={`text-xs font-mono font-semibold ${c.passed ? 'text-green-400' : 'text-red-400'}`}>
            {c.passed ? '✓' : '✗'} {c.name}
          </div>
          <div className="text-xs font-mono text-slate-500 mt-0.5">
            {c.value.toFixed(1)} / {c.limit.toFixed(1)} {c.unit}
          </div>
        </div>
      ))}
    </div>
  )
}

function RebarDisplay({ layout, As_req, color }: { layout: any; As_req: number; color: string }) {
  const As_prov = layout.noOfBars * Math.PI * Math.pow(layout.barDiameter / 2, 2)
  return (
    <div className="bg-[#080d1a] rounded-lg p-3 border border-[#1e2d4a]">
      <div className="font-mono font-bold text-sm" style={{ color }}>
        {layout.noOfBars}–#{layout.barDiameter}mm
      </div>
      <div className="text-xs font-mono text-slate-500 mt-1 space-y-0.5">
        <div>As_prov = {Math.round(As_prov)} mm²</div>
        {As_req > 0 && <div>As_req  = {As_req.toFixed(0)} mm²</div>}
        <div>Layers = {layout.layers}</div>
        <div>Clear s = {layout.clearSpacing} mm</div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#080d1a] rounded-lg px-3 py-2 border border-[#1e2d4a]">
      <div className="text-xs text-slate-600 font-mono">{label}</div>
      <div className="font-mono font-bold text-xs mt-0.5" style={{ color: color ?? '#94a3b8' }}>{value}</div>
    </div>
  )
}

function PMDiagramChart({ points, Pu, Mu }: { points: any[]; Pu: number; Mu: number }) {
  if (!points.length) return null

  const maxP = Math.max(...points.map(p => p.phi_Pn))
  const minP = Math.min(...points.map(p => p.phi_Pn))
  const maxM = Math.max(...points.map(p => p.phi_Mn))

  const W = 300, H = 200, pad = 20
  const toX = (m: number) => pad + (m / (maxM || 1)) * (W - 2 * pad)
  const toY = (p: number) => H - pad - ((p - minP) / ((maxP - minP) || 1)) * (H - 2 * pad)

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(p.phi_Mn).toFixed(1)},${toY(p.phi_Pn).toFixed(1)}`
  ).join(' ')

  const dotX = toX(Mu)
  const dotY = toY(Pu)

  return (
    <svg width={W} height={H} className="w-full">
      {/* Axes */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#1e2d4a" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#1e2d4a" strokeWidth={1} />
      {/* Labels */}
      <text x={W / 2} y={H - 2} fill="#475569" fontSize={9} textAnchor="middle" fontFamily="monospace">φMn (kN·m)</text>
      <text x={8} y={H / 2} fill="#475569" fontSize={9} textAnchor="middle" fontFamily="monospace"
        transform={`rotate(-90,8,${H / 2})`}>φPn (kN)</text>
      {/* P-M curve */}
      <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth={2} />
      <path d={pathD + ` L${pad},${H - pad} Z`} fill="#8b5cf6" fillOpacity={0.08} stroke="none" />
      {/* Design point */}
      <circle cx={dotX} cy={dotY} r={5}
        fill={dotX < W - pad && dotY > pad && dotY < H - pad ? '#22c55e' : '#ef4444'}
        stroke="white" strokeWidth={1} />
      <text x={dotX + 6} y={dotY - 4} fill="#94a3b8" fontSize={8} fontFamily="monospace">
        ({Mu.toFixed(0)}, {Pu.toFixed(0)})
      </text>
    </svg>
  )
}

function EmptyMembers({ type, module }: { type: string; module: string }) {
  const { setActiveModule } = useUIStore()
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
      <div className="text-5xl">📐</div>
      <h3 className="text-slate-300 font-mono font-bold">কোনো {type} নেই</h3>
      <p className="text-slate-600 font-mono text-sm">মডেলিং মডিউলে গিয়ে {type} যোগ করুন</p>
      <button onClick={() => setActiveModule('modeling')}
        className="px-6 py-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-sm hover:bg-red-500/30 transition-all">
        🏗 মডেলিংয়ে যান
      </button>
    </div>
  )
}

function SelectPrompt({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-slate-600 font-mono text-sm">
      ← {label}
    </div>
  )
}
