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
    { id: 'seismic',    label: '🌀 ভূমিকম্প (ELF)',  color: '#ef4444' },
    { id: 'wind',       label: '💨 বায়ু লোড',         color: '#3b82f6' },
    { id: 'comparison', label: '⚖ তুলনা',             color: '#22c55e' },
  ] as const

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#1e2d4a] bg-[#080d1a] px-6 shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-mono border-b-2 transition-all ${
              tab === t.id ? 'text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
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
        title="ভূমিকম্প লোড — Equivalent Lateral Force (ELF)"
        subtitle="BNBC 2020, Part 6, Chapter 2"
        color="#ef4444"
      />

      {/* Building parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Zone',         value: `Zone ${project.loads.seismicLoad.seismicZone}`,   color: '#ef4444' },
          { label: 'Site Class',   value: project.loads.seismicLoad.siteClass,               color: '#f97316' },
          { label: 'R',           value: bs.R.toString(),                                     color: '#eab308' },
          { label: 'I (Importance)', value: bs.I.toString(),                                  color: '#22c55e' },
        ].map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Period */}
      <InfoCard title="🕐 বিল্ডিং পিরিয়ড">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ParamRow label="hn (height)" value={`${per.hn} m`} />
          <ParamRow label="Ct"          value={per.Ct.toString()} />
          <ParamRow label="Ta = Ct·hn^0.75" value={`${per.Ta} s`} highlight />
          <ParamRow label="T_upper (Cu·Ta)" value={`${per.T_upper} s`} />
        </div>
      </InfoCard>

      {/* Base shear */}
      <InfoCard title="⚡ Design Base Shear">
        <div className="mb-4 px-4 py-3 rounded-lg bg-[#080d1a] border border-[#1e3a5f] font-mono text-xs text-cyan-300">
          {bs.formula}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Ca',         value: bs.Ca.toString(),             color: '#94a3b8' },
            { label: 'Cv',         value: bs.Cv.toString(),             color: '#94a3b8' },
            { label: 'W (Seismic Weight)', value: `${bs.W} kN`,        color: '#94a3b8' },
            { label: 'V (computed)',      value: `${bs.V} kN`,          color: '#f97316' },
            { label: 'V_min',            value: `${bs.V_min} kN`,       color: '#64748b' },
            { label: 'V_max',            value: `${bs.V_max} kN`,       color: '#64748b' },
          ].map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Governing V */}
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-center gap-4">
          <div>
            <div className="text-xs text-slate-500 font-mono">Design Base Shear V (governing)</div>
            <div className="text-3xl font-bold font-mono text-red-400 mt-1">{bs.V_used} kN</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-500 font-mono">Cs = V/W</div>
            <div className="text-xl font-bold font-mono text-red-300">{bs.Cs}</div>
          </div>
        </div>

        {Ft > 0 && (
          <div className="mt-3 text-xs font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2">
            ⚠ T = {per.Ta}s &gt; 0.7s → Top Force Ft = {Ft} kN (BNBC 2020)
          </div>
        )}
      </InfoCard>

      {/* Story distribution */}
      <InfoCard title="📊 তলাভিত্তিক বল বিতরণ">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e2d4a]">
                {['তলা', 'hx (m)', 'Wx (kN)', 'Wx·hx', 'Cvx', 'Fx (kN)', 'Accum. Shear (kN)'].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-slate-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...stories].reverse().map(s => (
                <tr key={s.storyId} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                  <td className="px-3 py-2.5 text-slate-300 font-semibold">{s.storyLabel}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.hx}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.Wx}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.Wx_hx.toFixed(0)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.Cvx}</td>
                  <td className="px-3 py-2.5 text-right text-red-400 font-semibold">{s.Fx}</td>
                  <td className="px-3 py-2.5 text-right text-orange-400">{s.Mx_accum}</td>
                </tr>
              ))}
              <tr className="border-t border-[#1e3a5f] bg-red-500/5">
                <td className="px-3 py-2.5 text-red-400 font-bold" colSpan={5}>Base Shear</td>
                <td className="px-3 py-2.5 text-right text-red-400 font-bold">{bs.V_used}</td>
                <td className="px-3 py-2.5 text-right text-red-300 font-bold">{bs.V_used}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InfoCard>

      {/* Force diagram (simple bar chart) */}
      <InfoCard title="📈 Story Force Diagram">
        <ForceDiagram stories={stories} color="#ef4444" valueKey="Fx" />
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
        title="বায়ু লোড — BNBC 2020"
        subtitle="Part 6, Chapter 2 — Wind Pressure Method"
        color="#3b82f6"
      />

      {/* Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Basic Wind Speed', value: `${result.basicWindSpeed} km/h`, color: '#3b82f6' },
          { label: 'Exposure',         value: `Cat. ${result.exposureCategory}`,color: '#06b6d4' },
          { label: 'Importance Iw',    value: result.importanceFactor.toString(),color: '#22c55e' },
          { label: 'Gust Factor G',    value: '0.85',                            color: '#8b5cf6' },
        ].map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Base shear summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5 text-center">
          <div className="text-xs text-slate-500 font-mono mb-1">Total Fx (X-Wind)</div>
          <div className="text-3xl font-bold font-mono text-blue-400">{result.totalFx} kN</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-center">
          <div className="text-xs text-slate-500 font-mono mb-1">Total Fy (Y-Wind)</div>
          <div className="text-3xl font-bold font-mono text-cyan-400">{result.totalFy} kN</div>
        </div>
      </div>

      {/* Story table */}
      <InfoCard title="📊 তলাভিত্তিক বায়ু বল">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1e2d4a]">
                {['তলা', 'Height (m)', 'Kz', 'qz (kN/m²)', 'Area X (m²)', 'Area Y (m²)', 'Fx (kN)', 'Fy (kN)'].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-slate-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...result.stories].reverse().map(s => (
                <tr key={s.storyId} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                  <td className="px-3 py-2.5 text-slate-300 font-semibold">{s.storyLabel}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.height.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.Kz.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.qz.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.area_x}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400">{s.area_y}</td>
                  <td className="px-3 py-2.5 text-right text-blue-400 font-semibold">{s.Fx}</td>
                  <td className="px-3 py-2.5 text-right text-cyan-400 font-semibold">{s.Fy}</td>
                </tr>
              ))}
              <tr className="border-t border-[#1e3a5f] bg-blue-500/5">
                <td className="px-3 py-2.5 text-blue-400 font-bold" colSpan={6}>Total</td>
                <td className="px-3 py-2.5 text-right text-blue-400 font-bold">{result.totalFx}</td>
                <td className="px-3 py-2.5 text-right text-cyan-400 font-bold">{result.totalFy}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </InfoCard>

      <InfoCard title="📈 Wind Force Diagram">
        <ForceDiagram stories={result.stories} color="#3b82f6" valueKey="Fx" />
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

  const govColor = (g: string) => g === 'Seismic' ? '#ef4444' : '#3b82f6'

  return (
    <div className="max-w-3xl space-y-6">
      <SectionHeader
        title="Seismic vs Wind — তুলনামূলক বিশ্লেষণ"
        subtitle="BNBC 2020 — Governing Lateral Load"
        color="#22c55e"
      />

      {/* Base shear comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-5 text-center">
          <div className="text-xs text-slate-500 font-mono mb-2">🌀 Seismic V</div>
          <div className="text-3xl font-bold font-mono text-red-400">{V_seismic}</div>
          <div className="text-xs text-slate-600 font-mono mt-1">kN</div>
        </div>
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 p-5 text-center">
          <div className="text-xs text-slate-500 font-mono mb-2">💨 Wind Fx</div>
          <div className="text-3xl font-bold font-mono text-blue-400">{V_wind_x}</div>
          <div className="text-xs text-slate-600 font-mono mt-1">kN</div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/8 p-5 text-center">
          <div className="text-xs text-slate-500 font-mono mb-2">💨 Wind Fy</div>
          <div className="text-3xl font-bold font-mono text-cyan-400">{V_wind_y}</div>
          <div className="text-xs text-slate-600 font-mono mt-1">kN</div>
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
              <div className="text-xs text-slate-500 font-mono mb-3">{item.dir}</div>
              <div className="text-xl font-bold font-mono" style={{ color: govColor(item.governs) }}>
                {item.governs} Governs
              </div>
              <div className="mt-3 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Seismic V</span>
                  <span className="text-red-400">{item.V_s} kN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Wind F</span>
                  <span className="text-blue-400">{item.V_w} kN</span>
                </div>
                <div className="flex justify-between border-t border-[#1e2d4a] pt-1.5">
                  <span className="text-slate-400">Design V</span>
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
              <tr className="border-b border-[#1e2d4a]">
                {['তলা', 'Seismic Fx (kN)', 'Wind Fx (kN)', 'Wind Fy (kN)', 'Governs'].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-slate-500 first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...seismic.stories].reverse().map((sf, i) => {
                const wf   = [...wind.stories].reverse()[i]
                const gov  = sf.Fx >= (wf?.Fx ?? 0) ? 'Seismic' : 'Wind'
                return (
                  <tr key={sf.storyId} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                    <td className="px-3 py-2.5 text-slate-300 font-semibold">{sf.storyLabel}</td>
                    <td className="px-3 py-2.5 text-right text-red-400">{sf.Fx}</td>
                    <td className="px-3 py-2.5 text-right text-blue-400">{wf?.Fx ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-cyan-400">{wf?.Fy ?? '—'}</td>
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

      <div className="bg-[#0d1221] rounded-xl border border-[#1e2d4a] p-4 text-xs font-mono text-slate-500">
        ℹ BNBC 2020: Design করতে হবে সবচেয়ে বেশি force দিয়ে।
        Phase 4-এর DSM Solver-এ Wind ও Seismic load এখন automatically যোগ হবে।
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
            <div className="w-8 text-right text-xs font-mono text-slate-500">{s.storyLabel}</div>
            <div className="flex-1 bg-[#080d1a] rounded-full h-6 relative border border-[#1e2d4a] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color + 'aa' }} />
              <div className="absolute inset-0 flex items-center px-3">
                <span className="text-xs font-mono text-slate-300">{val.toFixed(1)} kN</span>
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
      <h2 className="text-slate-200 font-mono font-bold text-base">{title}</h2>
      <p className="text-slate-500 font-mono text-xs mt-1">{subtitle}</p>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#1e2d4a] bg-[#080d1a]">
        <span className="text-slate-300 font-mono font-semibold text-sm">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: color + '30', background: color + '08' }}>
      <div className="text-xs text-slate-600 font-mono">{label}</div>
      <div className="font-mono font-bold text-base mt-1" style={{ color }}>{value}</div>
    </div>
  )
}

function ParamRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#080d1a] rounded-lg p-3 border border-[#1e2d4a]">
      <div className="text-xs text-slate-600 font-mono">{label}</div>
      <div className={`font-mono font-bold text-sm mt-1 ${highlight ? 'text-yellow-400' : 'text-slate-300'}`}>
        {value}
      </div>
    </div>
  )
}

function ErrorMsg() {
  return (
    <div className="flex items-center justify-center h-40 text-slate-500 font-mono text-sm">
      ⚠ গণনায় সমস্যা হয়েছে — প্রজেক্ট সেটআপ চেক করুন
    </div>
  )
}
