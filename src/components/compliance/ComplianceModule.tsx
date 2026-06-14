import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import {
  runComplianceChecks,
  calcComplianceScore,
  ComplianceScore,
} from '../../core/bnbc/complianceEngine'
import { ComplianceReport, ComplianceCheck } from '../../lib/types'

type CategoryFilter = 'all' | ComplianceCheck['category']
type StatusFilter   = 'all' | ComplianceCheck['status']

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  drift:        { label: 'Story Drift',   icon: '⇄', color: '#ef4444' },
  irregularity: { label: 'Irregularity',  icon: '⬡', color: '#f97316' },
  ductility:    { label: 'Ductility',     icon: '🔗', color: '#eab308' },
  detailing:    { label: 'Detailing',     icon: '✏', color: '#22c55e' },
  shear:        { label: 'Shear/Lateral', icon: '↔', color: '#06b6d4' },
  bearing:      { label: 'Bearing',       icon: '▲', color: '#8b5cf6' },
}

const STATUS_COLORS: Record<string, string> = {
  pass:        '#22c55e',
  fail:        '#ef4444',
  warning:     '#f97316',
  not_checked: '#475569',
}

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#3b82f6', C: '#eab308', D: '#f97316', F: '#ef4444',
}

export default function ComplianceModule() {
  const { project } = useProjectStore()
  const [catFilter,  setCatFilter]  = useState<CategoryFilter>('all')
  const [statFilter, setStatFilter] = useState<StatusFilter>('all')
  const [expanded,   setExpanded]   = useState<string | null>(null)

  if (!project) return null

  const report = useMemo<ComplianceReport>(
    () => runComplianceChecks(project, project.results.status === 'complete' ? project.results : undefined),
    [project.members, project.grid, project.loads, project.materials, project.results]
  )

  const score = useMemo(() => calcComplianceScore(report), [report])

  const filtered = report.checks.filter(c =>
    (catFilter  === 'all' || c.category === catFilter) &&
    (statFilter === 'all' || c.status   === statFilter)
  )

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-5xl">

        {/* Header */}
        <div>
          <div className="h-0.5 rounded mb-4"
            style={{ background: `linear-gradient(90deg,${STATUS_COLORS[report.overallStatus]},transparent)` }} />
          <h2 className="text-slate-200 font-mono font-bold text-base">BNBC 2020 Compliance Dashboard</h2>
          <p className="text-slate-500 font-mono text-xs mt-1">
            {project.meta.name} · {project.meta.projectNo} · Auto-generated compliance check
          </p>
        </div>

        {/* Score card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Grade */}
          <div className="rounded-xl border p-6 flex flex-col items-center justify-center gap-2"
            style={{ borderColor: GRADE_COLORS[score.grade]+'50', background: GRADE_COLORS[score.grade]+'08' }}>
            <div className="text-6xl font-black font-mono" style={{ color: GRADE_COLORS[score.grade] }}>
              {score.grade}
            </div>
            <div className="text-xs font-mono text-slate-500">Compliance Grade</div>
            <div className="text-2xl font-bold font-mono" style={{ color: GRADE_COLORS[score.grade] }}>
              {score.score}/100
            </div>
          </div>

          {/* Check counts */}
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Pass',    value: score.passed,  color: '#22c55e' },
              { label: 'Fail',    value: score.failed,  color: '#ef4444' },
              { label: 'Warning', value: score.warned,  color: '#f97316' },
              { label: 'Skipped', value: score.skipped, color: '#475569' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border p-4 text-center"
                style={{ borderColor: s.color+'30', background: s.color+'08' }}>
                <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-mono text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          report.overallStatus === 'pass'    ? 'border-green-500/30 bg-green-500/8'  :
          report.overallStatus === 'fail'    ? 'border-red-500/30 bg-red-500/8'      :
                                              'border-orange-500/30 bg-orange-500/8'
        }`}>
          <span className="text-2xl">
            {report.overallStatus === 'pass' ? '✅' : report.overallStatus === 'fail' ? '❌' : '⚠️'}
          </span>
          <div>
            <div className="font-mono font-bold text-sm" style={{ color: STATUS_COLORS[report.overallStatus] }}>
              {report.overallStatus === 'pass' ? 'সব BNBC 2020 চেক PASS — ভবন compliance-এ আছে'
                : report.overallStatus === 'fail' ? `${score.failed}টি critical failure — সংশোধন করুন`
                : `${score.warned}টি warning — review করুন`}
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">
              {score.total} checks · Generated: {new Date(report.generatedAt).toLocaleString('bn-BD')}
            </div>
          </div>
        </div>

        {/* Category summary */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {Object.entries(CATEGORY_LABELS).map(([cat, info]) => {
            const catChecks = report.checks.filter(c => c.category === cat)
            const fails = catChecks.filter(c => c.status === 'fail').length
            const warns = catChecks.filter(c => c.status === 'warning').length
            const status = fails > 0 ? 'fail' : warns > 0 ? 'warning' : 'pass'
            return (
              <button key={cat}
                onClick={() => setCatFilter(catFilter === cat ? 'all' : cat as CategoryFilter)}
                className="rounded-xl border p-3 text-center transition-all"
                style={{
                  borderColor: catFilter === cat ? info.color : STATUS_COLORS[status]+'30',
                  background:  catFilter === cat ? info.color+'15' : STATUS_COLORS[status]+'08',
                }}>
                <div className="text-lg">{info.icon}</div>
                <div className="text-xs font-mono mt-1" style={{ color: info.color }}>{info.label}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: STATUS_COLORS[status] }}>
                  {fails > 0 ? `${fails}F` : warns > 0 ? `${warns}W` : '✓'}
                </div>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-slate-500 text-xs font-mono">Status:</span>
          {(['all', 'pass', 'fail', 'warning', 'not_checked'] as const).map(s => (
            <button key={s} onClick={() => setStatFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                statFilter === s
                  ? 'text-white border-slate-500 bg-slate-500/20'
                  : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300'
              }`}
              style={statFilter === s && s !== 'all' ? {
                borderColor: STATUS_COLORS[s]+'60',
                background:  STATUS_COLORS[s]+'15',
                color:       STATUS_COLORS[s],
              } : {}}>
              {s === 'all' ? 'সব' : s === 'not_checked' ? 'Skipped' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && (
                <span className="ml-1">({report.checks.filter(c => c.status === s).length})</span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs font-mono text-slate-600">{filtered.length} checks</span>
        </div>

        {/* Checks list */}
        <div className="space-y-2">
          {filtered.map(check => (
            <CheckCard
              key={check.id}
              check={check}
              expanded={expanded === check.id}
              onToggle={() => setExpanded(expanded === check.id ? null : check.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-slate-600 font-mono text-sm py-12">
              এই ফিল্টারে কোনো check নেই
            </div>
          )}
        </div>

        {/* BNBC Reference note */}
        <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4 text-xs font-mono text-slate-500 space-y-1">
          <div className="text-slate-400 font-semibold">📚 Reference Documents</div>
          <div>• Bangladesh National Building Code (BNBC) 2020</div>
          <div>• ACI 318-19: Building Code Requirements for Structural Concrete</div>
          <div>• IS 2502: Code of Practice for Bending and Fixing of Bars for Concrete Reinforcement</div>
          <div className="text-slate-600 mt-2">
            ⚠ এই compliance check preliminary — final review একজন licensed structural engineer দিয়ে করাতে হবে।
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Check Card ────────────────────────────────────────────────

function CheckCard({ check, expanded, onToggle }: {
  check: ComplianceCheck; expanded: boolean; onToggle: () => void
}) {
  const color  = STATUS_COLORS[check.status]
  const catInfo = CATEGORY_LABELS[check.category]
  const ratio  = check.limit > 0 ? check.value / check.limit : 0
  const pct    = Math.min(ratio * 100, 150)  // for bar

  return (
    <div className="rounded-xl border overflow-hidden transition-all"
      style={{ borderColor: color+'30' }}>

      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/2 transition-all"
        style={{ background: color+'05' }}>

        {/* Status icon */}
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
          style={{ background: color+'20', color }}>
          {check.status === 'pass' ? '✓'
            : check.status === 'fail' ? '✗'
            : check.status === 'warning' ? '!'
            : '?'}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-semibold text-slate-200 truncate">
            {check.nameLocal}
          </div>
          <div className="text-xs font-mono text-slate-600 mt-0.5">{check.bnbcReference}</div>
        </div>

        {/* Category badge */}
        <span className="text-xs font-mono px-2 py-0.5 rounded-full shrink-0"
          style={{ background: (catInfo?.color ?? '#475569')+'20', color: catInfo?.color ?? '#475569' }}>
          {catInfo?.icon} {catInfo?.label}
        </span>

        {/* Value */}
        <div className="text-right shrink-0 min-w-[80px]">
          <div className="font-mono font-bold text-sm" style={{ color }}>
            {check.value.toFixed(3)}
          </div>
          <div className="text-xs text-slate-600 font-mono">
            / {check.limit.toFixed(3)} {check.unit}
          </div>
        </div>

        {/* Expand chevron */}
        <span className="text-slate-600 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Progress bar */}
      {check.status !== 'not_checked' && (
        <div className="h-1 bg-[#1e2d4a]">
          <div className="h-full transition-all duration-500 rounded-r"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: check.status === 'pass' ? '#22c55e'
                : check.status === 'fail' ? '#ef4444'
                : '#f97316',
            }} />
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 border-t border-[#1e2d4a] bg-[#080d1a] space-y-3">
          <div className="grid grid-cols-3 gap-3 text-xs font-mono">
            <div className="bg-[#0d1221] rounded-lg p-3 border border-[#1e2d4a]">
              <div className="text-slate-500">Actual Value</div>
              <div className="font-bold mt-1" style={{ color }}>
                {check.value.toFixed(4)} {check.unit}
              </div>
            </div>
            <div className="bg-[#0d1221] rounded-lg p-3 border border-[#1e2d4a]">
              <div className="text-slate-500">Code Limit</div>
              <div className="font-bold mt-1 text-slate-300">
                {check.limit.toFixed(4)} {check.unit}
              </div>
            </div>
            <div className="bg-[#0d1221] rounded-lg p-3 border border-[#1e2d4a]">
              <div className="text-slate-500">Ratio (V/L)</div>
              <div className="font-bold mt-1" style={{ color: ratio > 1 ? '#ef4444' : '#22c55e' }}>
                {check.limit > 0 ? ratio.toFixed(3) : '—'}
              </div>
            </div>
          </div>

          {check.suggestion && (
            <div className="text-xs font-mono text-slate-400 bg-[#0d1221] rounded-lg px-3 py-2 border border-[#1e2d4a]">
              💡 {check.suggestion}
            </div>
          )}

          {check.failedMembers && check.failedMembers.length > 0 && (
            <div className="text-xs font-mono text-red-400 bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/20">
              Failed members: {check.failedMembers.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
