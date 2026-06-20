import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { designShearWall, ShearWallDesignResult } from '../../core/design/advanced/shearWallDesign'
import { designPile, PileCapacityResult, SoilLayer } from '../../core/design/advanced/pileDesign'
import { designStaircase, StaircaseDesignResult } from '../../core/design/advanced/staircaseDesign'

type Tab = 'shearwall' | 'pile' | 'staircase'

export default function AdvancedMembersModule() {
  const { project } = useProjectStore()
  const [tab, setTab] = useState<Tab>('shearwall')
  if (!project) return null

  const TABS = [
    { id: 'shearwall', label: '▌ Shear Wall',     color: '#dc2626' },
    { id: 'pile',      label: '⬇ Pile Foundation', color: '#7c3aed' },
    { id: 'staircase', label: '⟋ Staircase',       color: '#d97706' },
  ] as const

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-[#e5e7eb] bg-[#ffffff] px-6 shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-mono border-b-2 transition-all shrink-0 ${
              tab === t.id ? 'text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={tab === t.id ? { borderColor: t.color, color: t.color } : {}}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6">
        {tab === 'shearwall' && <ShearWallTab project={project} />}
        {tab === 'pile'      && <PileTab project={project} />}
        {tab === 'staircase' && <StaircaseTab project={project} />}
      </div>
    </div>
  )
}

// ── Shear Wall Tab ────────────────────────────────────────────

function ShearWallTab({ project }: { project: any }) {
  const [params, setParams] = useState({
    lw: 4000, hw: 12000, tw: 200,
    Vu: 300, Mu: 2000, Pu: 500,
  })

  const result = useMemo<ShearWallDesignResult | null>(() => {
    try {
      return designShearWall({
        id: 'SW1', label: 'SW-1',
        lw: params.lw, hw: params.hw, tw: params.tw,
        Vu: params.Vu, Mu: params.Mu, Pu: params.Pu,
        fc: project.materials.concrete.fc,
        fy: project.materials.steel.fy,
        fyt: project.materials.steel.fyt,
        lambda: 1.0,
        seismicZone: project.loads.seismicLoad.seismicZone,
      })
    } catch { return null }
  }, [params, project.materials])

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader title="Shear Wall Design — ACI 318-19 §11"
        subtitle="In-plane shear §11.5.4 · Boundary elements §11.7.6 · Min reinforcement §11.6"
        color="#dc2626" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 space-y-3">
          <h4 className="text-gray-600 font-mono text-xs tracking-wider">WALL GEOMETRY + FORCES</h4>
          {[
            { key: 'lw', label: 'lw — Wall Length (mm)' },
            { key: 'hw', label: 'hw — Wall Height (mm)' },
            { key: 'tw', label: 'tw — Thickness (mm)'   },
            { key: 'Vu', label: 'Vu (kN)'                },
            { key: 'Mu', label: 'Mu (kN·m)'              },
            { key: 'Pu', label: 'Pu (kN)'                },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 font-mono">{f.label}</label>
              <input type="number" value={(params as any)[f.key]}
                onChange={e => setParams(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                className="input-field mt-1" />
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              <ResultCard title="📊 Shear Design" color="#dc2626">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <MiniStat label="hw/lw"     value={result.hw_lw.toString()} />
                  <MiniStat label="φVn"       value={`${result.phiVn} kN`} color={result.phiVn >= result.phiVn ? '#059669' : '#dc2626'} />
                  <MiniStat label="ρh"        value={result.rho_h.toFixed(4)} />
                  <MiniStat label="ρv"        value={result.rho_v.toFixed(4)} />
                </div>
                <div className="mt-3 space-y-1.5 text-xs font-mono text-gray-600">
                  <div>Horizontal: #{result.barH}mm @ {result.s_h}mm (2 curtains)</div>
                  <div>Vertical:   #{result.barV}mm @ {result.s_v}mm (2 curtains)</div>
                </div>
              </ResultCard>

              <ResultCard title="📐 Flexural Capacity" color="#d97706">
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label="Mn"   value={`${result.Mn} kN·m`} />
                  <MiniStat label="φMn"  value={`${result.phiMn} kN·m`}
                    color={result.phiMn >= 0 ? '#059669' : '#dc2626'} />
                </div>
              </ResultCard>

              {result.needsBE && (
                <ResultCard title="⬛ Boundary Elements Required" color="#dc2626">
                  <div className="grid grid-cols-3 gap-3">
                    <MiniStat label="BE Length" value={`${result.BE_length} mm`} />
                    <MiniStat label="BE Width"  value={`${result.BE_width} mm`} />
                    <MiniStat label="BE ρ_min"  value={`${(result.BE_rho*100).toFixed(1)}%`} />
                  </div>
                  <div className="mt-3 text-xs font-mono text-amber-600">
                    ⚠ Provide special boundary element confinement per ACI 18.10.6
                  </div>
                </ResultCard>
              )}
            </>
          ) : <div className="text-gray-500 font-mono text-sm text-center py-20">Calculating...</div>}
        </div>
      </div>
    </div>
  )
}

// ── Pile Tab ──────────────────────────────────────────────────

const DEFAULT_LAYERS: SoilLayer[] = [
  { id: 'L1', name: 'Soft Clay',    thickness: 3,  type: 'clay',  cu: 20,  phi: 0,  gamma: 17, N_spt: 4  },
  { id: 'L2', name: 'Medium Sand',  thickness: 5,  type: 'sand',  cu: 0,   phi: 30, gamma: 18, N_spt: 15 },
  { id: 'L3', name: 'Stiff Clay',   thickness: 6,  type: 'clay',  cu: 80,  phi: 0,  gamma: 19, N_spt: 25 },
  { id: 'L4', name: 'Dense Sand',   thickness: 10, type: 'sand',  cu: 0,   phi: 35, gamma: 20, N_spt: 40 },
]

function PileTab({ project }: { project: any }) {
  const [params, setParams] = useState({
    diameter: 450, length: 12000, noOfPiles: 4, Pu: 2400,
  })
  const [layers, setLayers] = useState<SoilLayer[]>(DEFAULT_LAYERS)

  const result = useMemo<PileCapacityResult | null>(() => {
    try {
      return designPile({
        id: 'P1', label: 'Pile Group-1',
        diameter:  params.diameter,
        length:    params.length,
        pileType:  'bored',
        soilLayers: layers,
        Pu:        params.Pu,
        fc:        project.materials.concrete.fc,
        fy:        project.materials.steel.fy,
        noOfPiles: params.noOfPiles,
      })
    } catch { return null }
  }, [params, layers, project.materials])

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader title="Pile Foundation — IS 2911 / Tomlinson"
        subtitle="Skin friction (α/β method) · End bearing · Group efficiency · Settlement"
        color="#7c3aed" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          {/* Pile params */}
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 space-y-3">
            <h4 className="text-gray-600 font-mono text-xs tracking-wider">PILE PARAMETERS</h4>
            {[
              { key: 'diameter',  label: 'Diameter (mm)' },
              { key: 'length',    label: 'Length (mm)'   },
              { key: 'noOfPiles', label: 'No. of Piles'  },
              { key: 'Pu',        label: 'Pu (kN)'       },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 font-mono">{f.label}</label>
                <input type="number" value={(params as any)[f.key]}
                  onChange={e => setParams(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="input-field mt-1" />
              </div>
            ))}
          </div>

          {/* Soil profile summary */}
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e7eb] bg-[#ffffff]">
              <span className="text-gray-500 font-mono text-xs">Soil Profile</span>
            </div>
            {layers.map((l, i) => (
              <div key={l.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-[#f3f4f6] last:border-0 text-xs font-mono">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: l.type === 'clay' ? '#d97706' : l.type === 'sand' ? '#d97706' : '#059669' }} />
                <div className="flex-1 text-gray-600">{l.name}</div>
                <div className="text-gray-500">{l.thickness}m</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              {/* Capacity summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Skin Friction Qs', value: `${result.Qs} kN`, color: '#d97706' },
                  { label: 'End Bearing Qb',   value: `${result.Qb} kN`, color: '#1a56db' },
                  { label: 'Ultimate Qu',      value: `${result.Qu} kN`, color: '#7c3aed' },
                  { label: 'Allowable Qa',     value: `${result.Qa} kN`, color: '#059669' },
                ].map(s => <MiniStat key={s.label} label={s.label} value={s.value} color={s.color} />)}
              </div>

              {/* Layer breakdown */}
              <ResultCard title="📊 Layer-by-Layer Skin Friction" color="#7c3aed">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      {['Layer', 'Depth (m)', 'fs (kPa)', 'Qs (kN)'].map(h => (
                        <th key={h} className="text-right px-3 py-2 text-gray-500 first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.layers.map((l, i) => (
                      <tr key={i} className="border-b border-[#f3f4f6] last:border-0">
                        <td className="px-3 py-2 text-gray-700">{l.name}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{l.depth.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{l.fs}</td>
                        <td className="px-3 py-2 text-right text-purple-600 font-semibold">{l.qs}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-[#d1d5db] bg-purple-500/5">
                      <td className="px-3 py-2 text-purple-600 font-bold" colSpan={3}>Total Qs</td>
                      <td className="px-3 py-2 text-right text-purple-600 font-bold">{result.Qs}</td>
                    </tr>
                  </tbody>
                </table>
              </ResultCard>

              {/* Pile cap */}
              <ResultCard title="⬛ Pile Cap Sizing" color="#1a56db">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Cap L" value={`${result.capL} mm`} />
                  <MiniStat label="Cap B" value={`${result.capB} mm`} />
                  <MiniStat label="Cap t" value={`${result.capT} mm`} />
                </div>
                <div className="mt-3 text-xs font-mono text-gray-500">
                  Pile spacing = 3D = {3 * params.diameter}mm · Edge = 1.5D = {1.5 * params.diameter}mm
                </div>
              </ResultCard>

              <ResultCard title="Settlement" color="#0891b2">
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold font-mono text-cyan-600">{result.settlement} mm</div>
                  <div className={`text-xs font-mono ${result.settlement <= 25 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {result.settlement <= 25 ? '✓ ≤ 25mm — Acceptable' : '✗ > 25mm — Review required'}
                  </div>
                </div>
              </ResultCard>
            </>
          ) : <div className="text-gray-500 font-mono text-sm text-center py-20">Calculating...</div>}
        </div>
      </div>
    </div>
  )
}

// ── Staircase Tab ─────────────────────────────────────────────

function StaircaseTab({ project }: { project: any }) {
  const [params, setParams] = useState({
    riser: 150, tread: 275, noOfRisers: 12,
    flightWidth: 1200, waistThick: 150,
    LL: 3.0, finishLoad: 1.0,
  })
  const [support, setSupport] = useState<'simply_supported' | 'one_end_fixed' | 'both_fixed'>('both_fixed')

  const result = useMemo<StaircaseDesignResult | null>(() => {
    try {
      return designStaircase({
        id: 'ST1', label: 'Stair-1',
        riser:       params.riser,
        tread:       params.tread,
        noOfRisers:  params.noOfRisers,
        flightWidth: params.flightWidth,
        waistThick:  params.waistThick,
        supportType: support,
        fc:          project.materials.concrete.fc,
        fy:          project.materials.steel.fy,
        LL:          params.LL,
        finishLoad:  params.finishLoad,
      })
    } catch { return null }
  }, [params, support, project.materials])

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader title="Staircase Design — ACI 318-19 (Waist Slab)"
        subtitle="Geometry check (BNBC 2020) · Flexure · Shear · Distribution steel"
        color="#d97706" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 space-y-3">
            <h4 className="text-gray-600 font-mono text-xs tracking-wider">STAIR PARAMETERS</h4>
            {[
              { key: 'riser',       label: 'Riser R (mm)'      },
              { key: 'tread',       label: 'Tread T (mm)'      },
              { key: 'noOfRisers',  label: 'No. of Risers'     },
              { key: 'flightWidth', label: 'Flight Width (mm)' },
              { key: 'waistThick',  label: 'Waist h (mm)'      },
              { key: 'LL',          label: 'LL (kN/m²)'        },
              { key: 'finishLoad',  label: 'Finish (kN/m²)'    },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 font-mono">{f.label}</label>
                <input type="number" value={(params as any)[f.key]}
                  onChange={e => setParams(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="input-field mt-1" />
              </div>
            ))}

            <div>
              <label className="text-xs text-gray-500 font-mono">Support Condition</label>
              <select value={support} onChange={e => setSupport(e.target.value as any)}
                className="input-field mt-1">
                <option value="simply_supported">Simply Supported</option>
                <option value="one_end_fixed">One End Fixed</option>
                <option value="both_fixed">Both Ends Fixed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {result ? (
            <>
              <StatusBanner status={result.status} warnings={result.warnings} />
              <ChecksGrid checks={result.checks} />

              {/* Geometry */}
              <ResultCard title="📐 Geometry" color="#d97706">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MiniStat label="Angle"        value={`${result.angle}°`} />
                  <MiniStat label="cos θ"        value={result.cosAngle.toFixed(3)} />
                  <MiniStat label="Flight L"     value={`${(result.flightLength/1000).toFixed(2)} m`} />
                  <MiniStat label="Slant L"      value={`${(result.slantLength/1000).toFixed(2)} m`} />
                  <MiniStat label="2R+T"         value={`${2*params.riser + params.tread} mm`}
                    color={2*params.riser+params.tread >= 550 && 2*params.riser+params.tread <= 700 ? '#059669' : '#dc2626'} />
                  <MiniStat label="h_min"        value={`${result.h_min} mm`} />
                </div>
              </ResultCard>

              {/* Loads */}
              <ResultCard title="↓ Loads" color="#d97706">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Self Weight"  value={`${result.selfWeight} kN/m²`} />
                  <MiniStat label="wu (factored)" value={`${result.wu} kN/m²`} color="#d97706" />
                  <MiniStat label="Mu"           value={`${result.Mu} kN·m/m`} color="#d97706" />
                </div>
              </ResultCard>

              {/* Reinforcement */}
              <ResultCard title="🔩 Reinforcement" color="#059669">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500 font-mono mb-1">Main (Longitudinal)</div>
                    <div className="text-emerald-600 font-mono font-bold text-sm">
                      #{result.barMain}mm @ {result.sMain}mm
                    </div>
                    <div className="text-gray-500 font-mono text-xs">As = {result.As_main} mm²/m</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-mono mb-1">Distribution (Transverse)</div>
                    <div className="text-cyan-600 font-mono font-bold text-sm">
                      #{result.barDist}mm @ {result.sDist}mm
                    </div>
                    <div className="text-gray-500 font-mono text-xs">As = {result.As_dist} mm²/m</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <MiniStat label="d_eff"  value={`${result.d_eff} mm`} />
                  <MiniStat label="Vu"     value={`${result.Vu} kN/m`} />
                  <MiniStat label="φVc"    value={`${result.Vc} kN/m`}
                    color={result.shearOK ? '#059669' : '#dc2626'} />
                </div>
              </ResultCard>
            </>
          ) : <div className="text-gray-500 font-mono text-sm text-center py-20">Calculating...</div>}
        </div>
      </div>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, color }: any) {
  return (
    <div>
      <div className="h-0.5 rounded mb-4" style={{ background: `linear-gradient(90deg,${color},transparent)` }} />
      <h2 className="text-gray-800 font-mono font-bold text-base">{title}</h2>
      <p className="text-gray-500 font-mono text-xs mt-1">{subtitle}</p>
    </div>
  )
}

function ResultCard({ title, color, children }: any) {
  return (
    <div className="rounded-xl border bg-[#f9fafb] overflow-hidden" style={{ borderColor: color + '30' }}>
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
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${ok ? 'border-green-500/30 bg-green-500/8' : 'border-red-500/30 bg-red-500/8'}`}>
      <span className="text-2xl shrink-0">{ok ? '✅' : '❌'}</span>
      <div>
        <div className={`font-mono font-bold text-sm ${ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {ok ? 'Design OK' : 'Design FAIL'}
        </div>
        {warnings.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {warnings.map((w, i) => (
              <div key={i} className="text-xs font-mono text-amber-500 flex gap-1">
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
        <div key={i} className={`rounded-lg border px-3 py-2 ${c.passed ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
          <div className={`text-xs font-mono font-semibold ${c.passed ? 'text-emerald-600' : 'text-red-600'}`}>
            {c.passed ? '✓' : '✗'} {c.name}
          </div>
          <div className="text-xs font-mono text-gray-500 mt-0.5">
            {typeof c.value === 'number' ? c.value.toFixed(1) : c.value} /
            {typeof c.limit === 'number' ? c.limit.toFixed(1) : c.limit} {c.unit}
          </div>
        </div>
      ))}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#ffffff] rounded-lg px-3 py-2 border border-[#e5e7eb]">
      <div className="text-xs text-gray-500 font-mono">{label}</div>
      <div className="font-mono font-bold text-xs mt-0.5" style={{ color: color ?? '#6b7280' }}>{value}</div>
    </div>
  )
}
