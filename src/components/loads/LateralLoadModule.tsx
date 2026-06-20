import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { calculateWindLoad, WindLoadResult } from '../../core/bnbc/windLoad'
import { calculateSeismicLoad, SeismicLoadResult } from '../../core/bnbc/seismicLoad'

type Tab = 'seismic' | 'wind' | 'comparison'

export default function LateralLoadModule() {
  const { project } = useProjectStore()
  const [tab, setTab] = useState<Tab>('seismic')

  if (!project) return null

  const seismicResult = useMemo(() => {
    try { return calculateSeismicLoad(project) }
    catch { return null }
  }, [project.loads, project.grid, project.members])

  const windResult = useMemo(() => {
    try { return calculateWindLoad(project) }
    catch { return null }
  }, [project.loads, project.grid])

  const TABS = [
    { id: 'seismic',    label: '🌀 Seismic (ELF)',  color: '#dc2626' },
    { id: 'wind',       label: '💨 Wind Load',         color: '#1a56db' },
    { id: 'comparison', label: '⚖ Comparison',             color: '#059669' },
  ] as const

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#e5e7eb] bg-[#ffffff] px-6 shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-mono border-b-2 transition-all ${
              tab === t.id ? 'text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            style={ tab === t.id ? { borderColor: t.color, color: t.color } : {} }>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'seismic'    && <SeismicTab result={seismicResult} project={project} />}
        {tab === 'wind'       && <WindTab result={windResult} project={project} />}
        {tab === 'comparison' && <ComparisonTab seismic={seismicResult} wind={windResult} />}
      </div>
    </div>
  )
}

// ── Seismic Tab ───────────────────────────────────────────────

function SeismicTab({ result, project }: { result: SeismicLoadResult | null; project: any }) {
  if (!result) return <ErrorMsg />

  const { baseShear: bs, period: per, stories, totalWeight, Ft } = result

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader
        title="Seismic Load — Equivalent Lateral Force (ELF)"
        subtitle="BNBC 2020, Part 6, Chapter 2"
        color="#dc2626"
      />

      {/* Building parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Zone',         value: `Zone ${project.loads.seismicLoad.seismicZone}`,   color: '#dc2626' },
          { label: 'Site Class',   value: project.loads.seismicLoad.siteClass,               color: '#d97706' },
          { label: 'R',           value: bs.R.toString(),                                     color: '#d97706' },
          { label: 'I (Importance)', value: bs.I.toString(),                                  color: '#059669' },
        ].map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Period */}
      <InfoCard title="🕐 Building Period">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ParamRow label="hn (height)" value={`${per.hn} m`} />
          <ParamRow label="Ct"          value={per.Ct.toString()} />
          <ParamRow label="Ta = Ct·hn^0.75" value={`${per.Ta} s`} highlight />
          <ParamRow label="T_upper (Cu·Ta)" value={`${per.T_upper} s`} />
        </div>
      </InfoCard>

      {/* Base shear */}
      <InfoCard title="⚡ Design Base Shear">
        <div className="mb-4 px-4 py-3 rounded-lg bg-[#ffffff] border border-[#d1d5db] font-mono text-xs text-cyan-300">
          {bs.formula}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Ca',         value: bs.Ca.toString(),             color: '#6b7280' },
            { label: 'Cv',         value: bs.Cv.toString(),             color: '#6b7280' },
            { label: 'W (Seismic Weight)', value: `${bs.W} kN`,        color: '#6b7280' },
            { label: 'V (computed)',      value: `${bs.V} kN`,          color: '#d97706' },
            { label: 'V_min',            value: `${bs.V_min} kN`,       color: '#6b7280' },
            { label: 'V_max',            value: `${bs.V_max} kN`,       color: '#6b7280' },
          ].map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Governing V */}
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-center gap-4">
          <div>
            <div className="text-xs text-gray-500 font-mono">Design Base Shear V (governing)</div>
            <div className="text-3xl font-bold font-mono text-red-600 mt-1">{bs.V_used} kN</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-gray-500 font-mono">Cs = V/W</div>
            <div className="text-xl font-bold font-mono text-red-500">{bs.Cs}</div>
          </div>
        </div>

        {Ft > 0 && (
          <div className="mt-3 text-xs font-mono text-amber-600 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2">
            ⚠ T = {per.Ta}s &gt; 0.7s → Top Force Ft = {Ft} kN (BNBC 2020)
          </div>
        )}
      </InfoCard>

      {/* Story distribution */}
      <InfoCard title="📊 Story-wise Force Distribution">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#e5e7eb]">
                {['Story', 'hx (m)', 'Wx (kN)', 'Wx·hx', 'Cvx', 'Fx (kN)', 'Accum. Shear (kN)'].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-gray-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...stories].reverse().map(s => (
                <tr key={s.storyId} className="border-b border-[#f3f4f6] last:border-0 hover:bg-white/2">
                  <td className="px-3 py-2.5 text-gray-700 font-semibold">{s.storyLabel}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.hx}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.Wx}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.Wx_hx.toFixed(0)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.Cvx}</td>
                  <td className="px-3 py-2.5 text-right text-red-600 font-semibold">{s.Fx}</td>
                  <td className="px-3 py-2.5 text-right text-orange-600">{s.Mx_accum}</td>
                </tr>
              ))}
              <tr className="border-t border-[#d1d5db] bg-red-500/5">
                <td className="px-3 py-2.5 text-red-600 font-bold" colSpan={5}>Base Shear</td>
                <td className="px-3 py-2.5 text-right text-red-600 font-bold">{bs.V_used}</td>
                <td className="px-3 py-2.5 text-right text-red-500 font-bold">{bs.V_used}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InfoCard>

      {/* Force diagram (simple bar chart) */}
      <InfoCard title="📈 Story Force Diagram">
        <ForceDiagram stories={stories} color="#dc2626" valueKey="Fx" />
      </InfoCard>
    </div>
  )
}

// ── Wind Tab ──────────────────────────────────────────────────

function WindTab({ result, project }: { result: WindLoadResult | null; project: any }) {
  if (!result) return <ErrorMsg />

  return (
    <div className="max-w-4xl space-y-6">
      <SectionHeader
        title="Wind Load — BNBC 2020"
        subtitle="Part 6, Chapter 2 — Wind Pressure Method"
        color="#1a56db"
      />

      {/* Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Basic Wind Speed', value: `${result.basicWindSpeed} km/h`, color: '#1a56db' },
          { label: 'Exposure',         value: `Cat. ${result.exposureCategory}`,color: '#0891b2' },
          { label: 'Importance Iw',    value: result.importanceFactor.toString(),color: '#059669' },
          { label: 'Gust Factor G',    value: '0.85',                            color: '#7c3aed' },
        ].map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Base shear summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-center">
          <div className="text-xs text-gray-500 font-mono mb-1">Total Fx (X-Wind)</div>
          <div className="text-3xl font-bold font-mono text-blue-600">{result.totalFx} kN</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-center">
          <div className="text-xs text-gray-500 font-mono mb-1">Total Fy (Y-Wind)</div>
          <div className="text-3xl font-bold font-mono text-cyan-600">{result.totalFy} kN</div>
        </div>
      </div>

      {/* Story table */}
      <InfoCard title="📊 Story-wise Wind Force">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#e5e7eb]">
                {['Story', 'Height (m)', 'Kz', 'qz (kN/m²)', 'Area X (m²)', 'Area Y (m²)', 'Fx (kN)', 'Fy (kN)'].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-gray-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...result.stories].reverse().map(s => (
                <tr key={s.storyId} className="border-b border-[#f3f4f6] last:border-0 hover:bg-white/2">
                  <td className="px-3 py-2.5 text-gray-700 font-semibold">{s.storyLabel}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.height.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.Kz.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.qz.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.area_x}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{s.area_y}</td>
                  <td className="px-3 py-2.5 text-right text-blue-600 font-semibold">{s.Fx}</td>
                  <td className="px-3 py-2.5 text-right text-cyan-600 font-semibold">{s.Fy}</td>
                </tr>
              ))}
              <tr className="border-t border-[#d1d5db] bg-blue-500/5">
                <td className="px-3 py-2.5 text-blue-600 font-bold" colSpan={6}>Total</td>
                <td className="px-3 py-2.5 text-right text-blue-600 font-bold">{result.totalFx}</td>
                <td className="px-3 py-2.5 text-right text-cyan-600 font-bold">{result.totalFy}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InfoCard>

      <InfoCard title="📈 Wind Force Diagram">
        <ForceDiagram stories={result.stories} color="#1a56db" valueKey="Fx" />
      </InfoCard>
    </div>
  )
}

// ── Comparison Tab ────────────────────────────────────────────

function ComparisonTab({
  seismic, wind,
}: {
  seismic: SeismicLoadResult | null
  wind:    WindLoadResult | null
}) {
  if (!seismic || !wind) return <ErrorMsg />

  const V_seismic = seismic.baseShear.V_used
  const V_wind_x  = wind.totalFx
  const V_wind_y  = wind.totalFy
  const governs_x = V_seismic >= V_wind_x ? 'Seismic' : 'Wind'
  const governs_y = V_seismic >= V_wind_y ? 'Seismic' : 'Wind'

  const govColor = (g: string) => g === 'Seismic' ? '#dc2626' : '#1a56db'

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader
        title="Seismic vs Wind — Comparative Analysis"
        subtitle="BNBC 2020 — Governing Lateral Load"
        color="#059669"
      />

      {/* Base shear comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-5 text-center">
          <div className="text-xs text-gray-500 font-mono mb-2">🌀 Seismic V</div>
          <div className="text-3xl font-bold font-mono text-red-600">{V_seismic}</div>
          <div className="text-xs text-gray-500 font-mono mt-1">kN</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 p-5 text-center">
          <div className="text-xs text-gray-500 font-mono mb-2">💨 Wind Fx</div>
          <div className="text-3xl font-bold font-mono text-blue-600">{V_wind_x}</div>
          <div className="text-xs text-gray-500 font-mono mt-1">kN</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/8 p-5 text-center">
          <div className="text-xs text-gray-500 font-mono mb-2">💨 Wind Fy</div>
          <div className="text-3xl font-bold font-mono text-cyan-600">{V_wind_y}</div>
          <div className="text-xs text-gray-500 font-mono mt-1">kN</div>
        </div>
      </div>

      {/* Governing */}
      <InfoCard title="⚖ Governing Lateral Load">
        <div className="grid grid-cols-2 gap-4">
          {[
            { dir: 'X-Direction', governs: governs_x, V_s: V_seismic, V_w: V_wind_x },
            { dir: 'Y-Direction', governs: governs_y, V_s: V_seismic, V_w: V_wind_y },
          ].map(item => (
            <div key={item.dir} className="rounded-xl border p-4"
              style={{ borderColor: govColor(item.governs) + '40', background: govColor(item.governs) + '08' }}>
              <div className="text-xs text-gray-500 font-mono mb-3">{item.dir}</div>
              <div className="text-xl font-bold font-mono" style={{ color: govColor(item.governs) }}>
                {item.governs} Governs
              </div>
              <div className="mt-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Seismic V</span>
                  <span className="text-red-600">{item.V_s} kN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Wind F</span>
                  <span className="text-blue-600">{item.V_w} kN</span>
                </div>
                <div className="flex justify-between border-t border-[#e5e7eb] pt-1.5">
                  <span className="text-gray-600">Design V</span>
                  <span className="font-bold" style={{ color: govColor(item.governs) }}>
                    {Math.max(item.V_s, item.V_w).toFixed(2)} kN
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </InfoCard>

      {/* Story-by-story comparison */}
      <InfoCard title="📊 Story-by-Story Comparison">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#e5e7eb]">
                {['Story', 'Seismic Fx (kN)', 'Wind Fx (kN)', 'Wind Fy (kN)', 'Governs'].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-gray-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...seismic.stories].reverse().map((sf, i) => {
                const wf   = [...wind.stories].reverse()[i]
                const gov  = sf.Fx >= (wf?.Fx ?? 0) ? 'Seismic' : 'Wind'
                return (
                  <tr key={sf.storyId} className="border-b border-[#f3f4f6] last:border-0 hover:bg-white/2">
                    <td className="px-3 py-2.5 text-gray-700 font-semibold">{sf.storyLabel}</td>
                    <td className="px-3 py-2.5 text-right text-red-600">{sf.Fx}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{wf?.Fx ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-cyan-600">{wf?.Fy ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="px-2 py-0.5 rounded-full text-xs border"
                        style={{ color: govColor(gov), borderColor: govColor(gov)+'40', background: govColor(gov)+'10' }}>
                        {gov}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </InfoCard>

      <div className="bg-[#f9fafb] rounded-xl border border-[#e5e7eb] p-4 text-xs font-mono text-gray-500">
        ℹ BNBC 2020: Design must use whichever lateral force is greater.
        In Phase 4's DSM Solver, Wind and Seismic loads will now be added automatically.
      </div>
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────

function ForceDiagram({
  stories, color, valueKey,
}: {
  stories: any[]
  color: string
  valueKey: string
}) {
  const maxVal = Math.max(...stories.map(s => Math.abs(s[valueKey])), 0.1)
  return (
    <div className="space-y-2">
      {[...stories].reverse().map(s => {
        const val  = Math.abs(s[valueKey])
        const pct  = (val / maxVal) * 100
        return (
          <div key={s.storyId} className="flex items-center gap-3">
            <div className="w-8 text-right text-xs font-mono text-gray-500">{s.storyLabel}</div>
            <div className="flex-1 bg-[#ffffff] rounded-full h-6 relative border border-[#e5e7eb] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color + 'aa' }} />
              <div className="absolute inset-0 flex items-center px-3">
                <span className="text-xs font-mono text-gray-700">{val.toFixed(1)} kN</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div>
      <div className="h-0.5 rounded mb-4" style={{ background: `linear-gradient(90deg,${color},transparent)` }} />
      <h2 className="text-gray-800 font-mono font-bold text-base">{title}</h2>
      <p className="text-gray-500 font-mono text-xs mt-1">{subtitle}</p>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#e5e7eb] bg-[#ffffff]">
        <span className="text-gray-700 font-mono font-semibold text-sm">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: color + '30', background: color + '08' }}>
      <div className="text-xs text-gray-500 font-mono">{label}</div>
      <div className="font-mono font-bold text-base mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function ParamRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#ffffff] rounded-lg p-3 border border-[#e5e7eb]">
      <div className="text-xs text-gray-500 font-mono">{label}</div>
      <div className={`font-mono font-bold text-sm mt-1 ${highlight ? 'text-amber-600' : 'text-gray-700'}`}>
        {value}
      </div>
    </div>
  )
}

function ErrorMsg() {
  return (
    <div className="flex items-center justify-center h-40 text-gray-500 font-mono text-sm">
      ⚠ Calculation error — please check Project Setup
    </div>
  )
}
