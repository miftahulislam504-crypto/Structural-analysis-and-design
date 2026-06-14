import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { generateBBS, BBSSheet, BBSBar, barShapeSVG } from '../../core/bbs/bbsEngine'

type Tab     = 'summary' | 'beam' | 'column' | 'slab' | 'foundation'
type SortKey = 'mark' | 'dia' | 'noOfBars' | 'totalLength' | 'totalWeight'

export default function BBSModule() {
  const { project } = useProjectStore()
  const [tab, setTab]   = useState<Tab>('summary')
  const [sort, setSort] = useState<SortKey>('mark')
  const [asc,  setAsc]  = useState(true)
  const [filter, setFilter] = useState('')

  if (!project) return null

  const sheet = useMemo<BBSSheet>(() => generateBBS(project), [
    project.members, project.grid, project.loads, project.materials
  ])

  const TABS: { id: Tab; label: string; color: string; count: number }[] = [
    { id: 'summary',    label: '📊 Summary',     color: '#22c55e',  count: sheet.summary.length },
    { id: 'beam',       label: '━ Beam',         color: '#f97316',  count: sheet.bars.filter(b => b.memberType === 'beam').length },
    { id: 'column',     label: '■ Column',       color: '#3b82f6',  count: sheet.bars.filter(b => b.memberType === 'column').length },
    { id: 'slab',       label: '▦ Slab',         color: '#06b6d4',  count: sheet.bars.filter(b => b.memberType === 'slab').length },
    { id: 'foundation', label: '▲ Foundation',   color: '#8b5cf6',  count: sheet.bars.filter(b => b.memberType === 'foundation').length },
  ]

  function getBars(type: Tab): BBSBar[] {
    let bars = type === 'summary' ? sheet.bars : sheet.bars.filter(b => b.memberType === type)
    if (filter) bars = bars.filter(b =>
      b.memberLabel.toLowerCase().includes(filter.toLowerCase()) ||
      b.mark.toLowerCase().includes(filter.toLowerCase())
    )
    return [...bars].sort((a, b) => {
      const va = (a as any)[sort], vb = (b as any)[sort]
      return asc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[#1e2d4a] bg-[#080d1a] px-6 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-4 text-xs font-mono border-b-2 transition-all shrink-0 ${
              tab === t.id ? 'text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
            style={tab === t.id ? { borderColor: t.color, color: t.color } : {}}>
            {t.label}
            <span className="px-1.5 rounded-full text-xs"
              style={{ background: t.color+'20', color: t.color }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {tab === 'summary' ? (
          <SummaryTab sheet={sheet} />
        ) : (
          <BarsTab
            bars={getBars(tab)}
            color={TABS.find(t => t.id === tab)?.color ?? '#94a3b8'}
            sort={sort} asc={asc}
            onSort={k => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(true) } }}
            filter={filter} onFilter={setFilter}
          />
        )}
      </div>
    </div>
  )
}

// ── Summary Tab ───────────────────────────────────────────────

function SummaryTab({ sheet }: { sheet: BBSSheet }) {
  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <div className="h-0.5 rounded mb-4" style={{ background: 'linear-gradient(90deg,#22c55e,#06b6d4)' }} />
        <h2 className="text-slate-200 font-mono font-bold text-base">
          Bar Bending Schedule — {sheet.projectName}
        </h2>
        <p className="text-slate-500 font-mono text-xs mt-1">
          {sheet.projectNo} · Prepared by: {sheet.preparedBy} · {sheet.date}
        </p>
      </div>

      {/* Grand total cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Bars',    value: sheet.grandTotal.bars.toLocaleString(),          unit: 'nos',  color: '#3b82f6' },
          { label: 'Total Weight',  value: sheet.grandTotal.weight.toLocaleString(),         unit: 'kg',   color: '#f97316' },
          { label: 'Total Tonnage', value: sheet.grandTotal.tonnage.toFixed(3),              unit: 'MT',   color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border p-5 text-center"
            style={{ borderColor: s.color+'30', background: s.color+'08' }}>
            <div className="text-3xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-mono text-slate-500 mt-1">{s.unit}</div>
            <div className="text-xs font-mono text-slate-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* By diameter summary */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <div className="px-5 py-3 bg-[#080d1a] border-b border-[#1e2d4a]">
          <span className="text-slate-300 font-mono font-semibold text-sm">Steel Summary — By Diameter</span>
        </div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2d4a] bg-[#080d1a]">
              {['Bar ⌀ (mm)', 'No. of Bars', 'Total Length (m)', 'Total Weight (kg)', '% of Total'].map(h => (
                <th key={h} className="text-right px-5 py-3 text-slate-500 first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.summary.map(s => {
              const pct = sheet.grandTotal.weight > 0
                ? (s.totalWeight / sheet.grandTotal.weight * 100).toFixed(1) : '0'
              return (
                <tr key={s.dia} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                  <td className="px-5 py-3 text-slate-200 font-semibold">⌀{s.dia}</td>
                  <td className="px-5 py-3 text-right text-slate-300">{s.totalBars}</td>
                  <td className="px-5 py-3 text-right text-cyan-400">{s.totalLength.toFixed(1)}</td>
                  <td className="px-5 py-3 text-right text-orange-400">{s.totalWeight.toFixed(1)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-[#1e2d4a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-cyan-500"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-slate-400">{pct}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {/* Total row */}
            <tr className="border-t border-[#1e3a5f] bg-green-500/5">
              <td className="px-5 py-3 text-green-400 font-bold">TOTAL</td>
              <td className="px-5 py-3 text-right text-green-400 font-bold">{sheet.grandTotal.bars}</td>
              <td className="px-5 py-3 text-right text-green-400 font-bold">
                {sheet.summary.reduce((s, r) => s + r.totalLength, 0).toFixed(1)}
              </td>
              <td className="px-5 py-3 text-right text-green-400 font-bold">{sheet.grandTotal.weight}</td>
              <td className="px-5 py-3 text-right text-green-400 font-bold">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* By member type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { type: 'beam',       label: 'Beam',       color: '#f97316' },
          { type: 'column',     label: 'Column',     color: '#3b82f6' },
          { type: 'slab',       label: 'Slab',       color: '#06b6d4' },
          { type: 'foundation', label: 'Foundation', color: '#8b5cf6' },
        ].map(t => {
          const typeBars = sheet.bars.filter(b => b.memberType === t.type)
          const weight   = typeBars.reduce((s, b) => s + b.totalWeight, 0)
          return (
            <div key={t.type} className="rounded-xl border p-4"
              style={{ borderColor: t.color+'30', background: t.color+'08' }}>
              <div className="text-xs text-slate-500 font-mono">{t.label}</div>
              <div className="text-xl font-bold font-mono mt-1" style={{ color: t.color }}>
                {weight.toFixed(0)} kg
              </div>
              <div className="text-xs text-slate-600 font-mono mt-0.5">{typeBars.length} items</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Bars Table Tab ────────────────────────────────────────────

function BarsTab({ bars, color, sort, asc, onSort, filter, onFilter }: {
  bars: BBSBar[]; color: string; sort: SortKey; asc: boolean
  onSort: (k: SortKey) => void; filter: string; onFilter: (v: string) => void
}) {
  const totalWeight = bars.reduce((s, b) => s + b.totalWeight, 0)

  const SH = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="text-right px-4 py-3 text-slate-500 cursor-pointer hover:text-slate-300 select-none first:text-left"
      onClick={() => onSort(k)}>
      {label} {sort === k ? (asc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="max-w-6xl space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <input
          value={filter}
          onChange={e => onFilter(e.target.value)}
          placeholder="Search member / mark..."
          className="input-field max-w-xs"
        />
        <div className="text-xs font-mono text-slate-500 ml-auto">
          {bars.length} items · {totalWeight.toFixed(1)} kg
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#1e2d4a] overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-[#1e2d4a] bg-[#080d1a]">
              <th className="text-left px-4 py-3 text-slate-500">Shape</th>
              <SH k="mark"        label="Mark" />
              <th className="text-left px-4 py-3 text-slate-500">Member</th>
              <th className="text-right px-4 py-3 text-slate-500">Story</th>
              <SH k="dia"         label="⌀ (mm)" />
              <SH k="noOfBars"    label="No." />
              <th className="text-right px-4 py-3 text-slate-500">Cut Length (mm)</th>
              <th className="text-right px-4 py-3 text-slate-500">a (mm)</th>
              <th className="text-right px-4 py-3 text-slate-500">b (mm)</th>
              <SH k="totalWeight" label="Weight (kg)" />
              <th className="text-left px-4 py-3 text-slate-500">Note</th>
            </tr>
          </thead>
          <tbody>
            {bars.map(bar => (
              <tr key={bar.id} className="border-b border-[#1a2030] last:border-0 hover:bg-white/2">
                {/* Shape SVG */}
                <td className="px-3 py-2">
                  <div dangerouslySetInnerHTML={{ __html: barShapeSVG(bar) }}
                    className="opacity-90" />
                </td>
                <td className="px-4 py-2 font-semibold" style={{ color }}>{bar.mark}</td>
                <td className="px-4 py-2 text-slate-300">{bar.memberLabel}</td>
                <td className="px-4 py-2 text-right text-slate-500">{bar.storyLabel}</td>
                <td className="px-4 py-2 text-right text-slate-200 font-semibold">⌀{bar.dia}</td>
                <td className="px-4 py-2 text-right text-slate-300">{bar.noOfBars}</td>
                <td className="px-4 py-2 text-right text-cyan-400">{bar.totalLength}</td>
                <td className="px-4 py-2 text-right text-slate-400">{bar.a}</td>
                <td className="px-4 py-2 text-right text-slate-400">{bar.b ?? '—'}</td>
                <td className="px-4 py-2 text-right font-semibold" style={{ color }}>
                  {bar.totalWeight.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-slate-600 max-w-[200px] truncate" title={bar.note}>
                  {bar.note}
                </td>
              </tr>
            ))}
            {/* Total */}
            <tr className="border-t border-[#1e3a5f]" style={{ background: color+'08' }}>
              <td colSpan={9} className="px-4 py-3 font-bold" style={{ color }}>TOTAL</td>
              <td className="px-4 py-3 text-right font-bold" style={{ color }}>
                {totalWeight.toFixed(2)} kg
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {bars.length === 0 && (
        <div className="text-center text-slate-600 font-mono text-sm py-16">
          এই ধরনের কোনো member নেই
        </div>
      )}
    </div>
  )
}
