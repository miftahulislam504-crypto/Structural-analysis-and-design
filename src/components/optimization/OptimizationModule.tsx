// ============================================================
// CivilOS Structural — Optimization Module UI
// Phase 13: Cost & Material Optimization Dashboard
// ============================================================

import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import {
  runOptimization,
  OptimizationItem,
  OptimizationCategory,
  OptimizationSeverity,
  OptimizationReport,
} from '../../core/optimization/optimizationEngine'

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const SEVERITY_CONFIG: Record<OptimizationSeverity, { label: string; labelLocal: string; color: string; bg: string; icon: string }> = {
  recommended: { label: 'Recommended', labelLocal: 'জরুরি পরামর্শ', color: '#ef4444', bg: '#ef444412', icon: '🔴' },
  suggestion:  { label: 'Suggestion',  labelLocal: 'পরামর্শ',        color: '#f97316', bg: '#f9731612', icon: '🟡' },
  info:        { label: 'Info',         labelLocal: 'তথ্য',           color: '#3b82f6', bg: '#3b82f612', icon: '🔵' },
}

const CATEGORY_CONFIG: Record<OptimizationCategory, { label: string; labelLocal: string; icon: string; color: string }> = {
  over_design:  { label: 'Over-Design',      labelLocal: 'অতিরিক্ত ডিজাইন', icon: '↓',  color: '#ef4444' },
  section_size: { label: 'Section Size',      labelLocal: 'সেকশন সাইজ',       icon: '⊡',  color: '#f97316' },
  steel_grade:  { label: 'Steel Grade',       labelLocal: 'স্টিলের গ্রেড',     icon: '⚙',  color: '#eab308' },
  foundation:   { label: 'Foundation',        labelLocal: 'ফাউন্ডেশন',         icon: '▼',  color: '#8b5cf6' },
  material:     { label: 'Material',          labelLocal: 'উপকরণ',             icon: '◆',  color: '#06b6d4' },
}

const MEMBER_ICONS: Record<string, string> = {
  beam:       '—',
  column:     '|',
  slab:       '▦',
  foundation: '▽',
}

const RATING_CONFIG: Record<string, { label: string; labelLocal: string; color: string }> = {
  A: { label: 'Very Efficient',    labelLocal: 'অত্যন্ত দক্ষ',       color: '#22c55e' },
  B: { label: 'Good',              labelLocal: 'ভালো',                color: '#84cc16' },
  C: { label: 'Moderate',          labelLocal: 'মাঝামাঝি',            color: '#eab308' },
  D: { label: 'Over-designed',     labelLocal: 'অতিরিক্ত ডিজাইন',    color: '#f97316' },
  F: { label: 'Highly Wasteful',   labelLocal: 'অতিরিক্ত অপচয়',     color: '#ef4444' },
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function OptimizationModule() {
  const { project } = useProjectStore()

  const [catFilter,  setCatFilter]  = useState<OptimizationCategory | 'all'>('all')
  const [sevFilter,  setSevFilter]  = useState<OptimizationSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<OptimizationItem['memberType'] | 'all'>('all')
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [sortBy,     setSortBy]     = useState<'saving' | 'severity' | 'utilization'>('saving')

  if (!project) return null

  // Check if design is done
  const hasDesign = project.design.beamDesigns.length > 0
    || project.design.columnDesigns.length > 0
    || project.design.slabDesigns.length > 0

  if (!hasDesign) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-3xl">⚡</div>
        <h2 className="text-slate-200 font-mono font-bold text-lg">Optimization Engine</h2>
        <p className="text-slate-500 font-mono text-sm max-w-xs">
          আগে RCC Design (Phase 6) রান করুন, তারপর Optimization শুরু হবে।
        </p>
      </div>
    )
  }

  const report = useMemo<OptimizationReport>(
    () => runOptimization(project),
    [project.design, project.members, project.materials, project.loads]
  )

  const { summary } = report

  // Filter + sort
  const filtered = report.items
    .filter(i =>
      (catFilter  === 'all' || i.category   === catFilter)  &&
      (sevFilter  === 'all' || i.severity   === sevFilter)  &&
      (typeFilter === 'all' || i.memberType === typeFilter)
    )
    .sort((a, b) => {
      if (sortBy === 'saving')      return b.saving - a.saving
      if (sortBy === 'severity') {
        const rank = { recommended: 3, suggestion: 2, info: 1 }
        return rank[b.severity] - rank[a.severity]
      }
      return a.utilization - b.utilization
    })

  const rating = RATING_CONFIG[summary.overallRating]

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-5xl">

        {/* ── Header ──────────────────────────────────── */}
        <div>
          <div className="h-0.5 rounded mb-4"
            style={{ background: `linear-gradient(90deg,${rating.color},transparent)` }} />
          <h2 className="text-slate-200 font-mono font-bold text-base">
            Optimization Engine — Phase 13
          </h2>
          <p className="text-slate-500 font-mono text-xs mt-1">
            {project.meta.name} · Cost & Material Optimization Analysis
          </p>
        </div>

        {/* ── Summary Cards ────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* Rating */}
          <div className="rounded-xl border p-4 flex flex-col items-center justify-center gap-1 sm:col-span-1 row-span-2"
            style={{ borderColor: rating.color + '40', background: rating.color + '08' }}>
            <div className="text-5xl font-black font-mono" style={{ color: rating.color }}>
              {summary.overallRating}
            </div>
            <div className="text-xs font-mono text-center" style={{ color: rating.color }}>
              {rating.labelLocal}
            </div>
            <div className="text-xs font-mono text-slate-500 text-center mt-1">
              Efficiency Rating
            </div>
          </div>

          {/* Saving */}
          <div className="rounded-xl border border-green-500/20 bg-green-500/05 p-4 flex flex-col gap-1">
            <div className="text-2xl font-bold font-mono text-green-400">
              ৳{(summary.estimatedSaving / 1000).toFixed(0)}K
            </div>
            <div className="text-xs font-mono text-slate-500">অনুমানিত সাশ্রয়</div>
          </div>

          {/* Steel saving */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/05 p-4 flex flex-col gap-1">
            <div className="text-2xl font-bold font-mono text-cyan-400">
              {summary.steelSavingKg.toFixed(0)} kg
            </div>
            <div className="text-xs font-mono text-slate-500">স্টিল সাশ্রয়</div>
          </div>

          {/* Items count */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/05 p-4 flex flex-col gap-1">
            <div className="text-2xl font-bold font-mono text-orange-400">
              {summary.totalItems}
            </div>
            <div className="text-xs font-mono text-slate-500">মোট পরামর্শ</div>
          </div>

          {/* Severity breakdown */}
          <div className="rounded-xl border border-slate-700/50 bg-white/02 p-4 sm:col-span-2">
            <div className="text-xs font-mono text-slate-500 mb-3">Severity Breakdown</div>
            <div className="flex gap-4">
              {[
                { key: 'recommended', val: summary.recommendedCount },
                { key: 'suggestion',  val: summary.suggestionCount  },
                { key: 'info',        val: summary.infoCount         },
              ].map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <div className="text-sm">{SEVERITY_CONFIG[s.key as OptimizationSeverity].icon}</div>
                  <div>
                    <div className="text-base font-bold font-mono"
                      style={{ color: SEVERITY_CONFIG[s.key as OptimizationSeverity].color }}>
                      {s.val}
                    </div>
                    <div className="text-xs font-mono text-slate-600">
                      {SEVERITY_CONFIG[s.key as OptimizationSeverity].labelLocal}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Concrete reduction */}
          <div className="rounded-xl border border-slate-700/50 bg-white/02 p-4 sm:col-span-1">
            <div className="text-xs font-mono text-slate-500 mb-2">কংক্রিট হ্রাস</div>
            <div className="text-xl font-bold font-mono text-slate-300">
              {summary.concreteReductionM3.toFixed(1)} m³
            </div>
          </div>
        </div>

        {/* ── Global Notes ─────────────────────────────── */}
        {report.globalNotes.length > 0 && (
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/05 p-4 space-y-2">
            <div className="text-xs font-mono text-blue-400 font-semibold mb-2">
              🌐 Global Optimization Notes
            </div>
            {report.globalNotes.map((note, i) => (
              <p key={i} className="text-xs font-mono text-slate-400 leading-relaxed">
                • {note}
              </p>
            ))}
          </div>
        )}

        {/* ── Filters & Sort ───────────────────────────── */}
        <div className="flex flex-wrap gap-3">

          {/* Category filter */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCatFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                catFilter === 'all'
                  ? 'border-slate-500 bg-slate-500/20 text-slate-300'
                  : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
              }`}
            >
              সব ({report.items.length})
            </button>
            {(Object.keys(CATEGORY_CONFIG) as OptimizationCategory[]).map(cat => {
              const c = CATEGORY_CONFIG[cat]
              const cnt = report.items.filter(i => i.category === cat).length
              if (cnt === 0) return null
              return (
                <button key={cat}
                  onClick={() => setCatFilter(cat === catFilter ? 'all' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                    catFilter === cat
                      ? 'text-white'
                      : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
                  }`}
                  style={catFilter === cat ? { borderColor: c.color + '60', background: c.color + '20', color: c.color } : {}}
                >
                  {c.icon} {c.labelLocal} ({cnt})
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <div className="ml-auto flex gap-1">
            {(['saving', 'severity', 'utilization'] as const).map(s => (
              <button key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  sortBy === s
                    ? 'border-slate-500 bg-slate-500/20 text-slate-300'
                    : 'border-slate-700/50 text-slate-600 hover:text-slate-400'
                }`}
              >
                {s === 'saving' ? '৳ সর্বোচ্চ' : s === 'severity' ? 'জরুরি' : '% ব্যবহার'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Item List ────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-600 font-mono text-sm">
            এই ফিল্টারে কোনো পরামর্শ নেই
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <OptimizationCard
                key={item.id}
                item={item}
                expanded={expanded === item.id}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
              />
            ))}
          </div>
        )}

        {/* ── Empty State ───────────────────────────────── */}
        {report.items.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-4xl">✅</div>
            <p className="text-slate-300 font-mono font-bold">Design Well-Optimized!</p>
            <p className="text-slate-600 font-mono text-sm">
              সব member সঠিক utilization range-এ আছে।
            </p>
          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// OPTIMIZATION CARD
// ─────────────────────────────────────────────

function OptimizationCard({
  item, expanded, onToggle,
}: {
  item:     OptimizationItem
  expanded: boolean
  onToggle: () => void
}) {
  const sev = SEVERITY_CONFIG[item.severity]
  const cat = CATEGORY_CONFIG[item.category]

  return (
    <div
      className="rounded-xl border transition-all cursor-pointer"
      style={{
        borderColor: expanded ? sev.color + '40' : '#1e2d4a',
        background:  expanded ? sev.bg : 'transparent',
      }}
      onClick={onToggle}
    >
      {/* ── Card Header ─────────────────────── */}
      <div className="flex items-center gap-3 p-4">

        {/* Member type icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-mono font-bold shrink-0"
          style={{ background: sev.color + '15', color: sev.color }}>
          {MEMBER_ICONS[item.memberType]}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-300 font-mono font-semibold text-sm">
              {item.memberLabel}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ background: cat.color + '18', color: cat.color }}>
              {cat.labelLocal}
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full"
              style={{ background: sev.color + '18', color: sev.color }}>
              {sev.icon} {sev.labelLocal}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">
            {item.titleLocal}
          </p>
        </div>

        {/* Saving badge */}
        <div className="text-right shrink-0">
          <div className="text-green-400 font-mono font-bold text-sm">
            ৳{item.saving >= 1000 ? (item.saving / 1000).toFixed(1) + 'K' : item.saving}
          </div>
          <div className="text-xs font-mono text-slate-600">{item.savingUnit}</div>
        </div>

        {/* Utilization bar */}
        <div className="w-16 shrink-0">
          <div className="text-xs font-mono text-slate-600 mb-1 text-right">
            {(item.utilization * 100).toFixed(0)}%
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width:      `${Math.min(item.utilization * 100, 100)}%`,
                background: item.utilization > 0.75 ? '#22c55e'
                          : item.utilization > 0.50 ? '#eab308'
                          : '#ef4444',
              }}
            />
          </div>
        </div>

        {/* Chevron */}
        <div className="text-slate-600 text-xs shrink-0">
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* ── Expanded Detail ─────────────────── */}
      {expanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-3">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Current */}
            <div className="rounded-lg border border-red-500/20 bg-red-500/05 p-3">
              <div className="text-xs font-mono text-red-400 mb-1">বর্তমান</div>
              <div className="text-xs font-mono text-slate-300">{item.current}</div>
            </div>

            {/* Suggested */}
            <div className="rounded-lg border border-green-500/20 bg-green-500/05 p-3">
              <div className="text-xs font-mono text-green-400 mb-1">প্রস্তাবিত</div>
              <div className="text-xs font-mono text-slate-300">{item.suggested}</div>
            </div>
          </div>

          {/* Saving detail */}
          <div className="rounded-lg border border-slate-700/50 bg-white/02 p-3 flex items-center gap-3">
            <div>
              <div className="text-xs font-mono text-slate-500 mb-1">সাশ্রয়ের বিস্তারিত</div>
              <div className="text-xs font-mono text-slate-400">{item.savingDetail}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xl font-bold font-mono text-green-400">
                ৳{item.saving >= 1000 ? (item.saving / 1000).toFixed(1) + 'K' : item.saving}
              </div>
              <div className="text-xs font-mono text-slate-600">{item.savingUnit}</div>
            </div>
          </div>

          {/* Code reference */}
          <div className="text-xs font-mono text-slate-600">
            📖 কোড রেফারেন্স: {item.code}
          </div>
        </div>
      )}
    </div>
  )
}
