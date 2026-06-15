// ============================================================
// CivilOS Structural — BIM Integration Module UI
// Phase 14: Import from Architectural · Export to Estimate
// ============================================================

import { useState, useRef } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import {
  parseCivpFile,
  importFromArchitectural,
  exportToArchitectural,
  exportToEstimate,
  downloadCivpFile,
  BIMImportResult,
  CivpExchangeFile,
} from '../../core/bim/bimEngine'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type ActiveTab  = 'import' | 'export'
type ExportTarget = 'architectural' | 'estimate'
type ExportState  = 'idle' | 'generating' | 'done' | 'error'

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function BIMModule() {
  const { project, updateProject } = useProjectStore()
  const [tab,          setTab]         = useState<ActiveTab>('import')
  const [importResult, setImportResult] = useState<BIMImportResult | null>(null)
  const [parseError,   setParseError]   = useState<string | null>(null)
  const [parsedFile,   setParsedFile]   = useState<CivpExchangeFile | null>(null)
  const [exportState,  setExportState]  = useState<Record<ExportTarget, ExportState>>({
    architectural: 'idle',
    estimate:      'idle',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!project) return null

  // ── Import handlers ─────────────────────────

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setParseError(null)
    setParsedFile(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const result = parseCivpFile(text)
      if (!result.ok) {
        setParseError(result.error)
        return
      }
      setParsedFile(result.file)
    }
    reader.readAsText(file)
  }

  function handleImport() {
    if (!parsedFile || !project) return
    const result = importFromArchitectural(parsedFile, project)
    setImportResult(result)

    if (result.success && result.patch) {
      updateProject({
        ...(result.patch.grid    ? { grid:    result.patch.grid }    : {}),
        ...(result.patch.members ? { members: result.patch.members } : {}),
      })
    }
  }

  // ── Export handlers ─────────────────────────

  function handleExport(target: ExportTarget) {
    if (!project) return
    setExportState(s => ({ ...s, [target]: 'generating' }))
    try {
      const file = target === 'architectural'
        ? exportToArchitectural(project)
        : exportToEstimate(project)

      const suffix = target === 'architectural' ? 'arch' : 'estimate'
      downloadCivpFile(file, `${project.meta.projectNo}_${suffix}.civp`)
      setExportState(s => ({ ...s, [target]: 'done' }))
      setTimeout(() => setExportState(s => ({ ...s, [target]: 'idle' })), 3000)
    } catch (err) {
      console.error(err)
      setExportState(s => ({ ...s, [target]: 'error' }))
      setTimeout(() => setExportState(s => ({ ...s, [target]: 'idle' })), 3000)
    }
  }

  // ─────────────────────────────────────────────────────────
  const hasDesign = project.design.beamDesigns.length > 0 || project.design.columnDesigns.length > 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-6 max-w-4xl">

        {/* ── Header ──────────────────────────────────── */}
        <div>
          <div className="h-0.5 rounded mb-4"
            style={{ background: 'linear-gradient(90deg,#8b5cf6,transparent)' }} />
          <h2 className="text-slate-200 font-mono font-bold text-base">BIM Integration Engine — Phase 14</h2>
          <p className="text-slate-500 font-mono text-xs mt-1">
            {project.meta.name} · Architectural ↔ Structural ↔ CivilOS Estimate
          </p>
        </div>

        {/* ── Data Flow Diagram ────────────────────────── */}
        <div className="rounded-xl border border-slate-700/40 bg-white/02 p-4">
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs font-mono">
            <FlowBox label="Architectural BIM" sub=".civp file" color="#8b5cf6" />
            <FlowArrow label="Import Grid + Members" dir="→" color="#8b5cf6" />
            <FlowBox label="CivilOS Structural" sub="Phase 14" color="#ef4444" active />
            <FlowArrow label="Export Sizes" dir="→" color="#3b82f6" />
            <FlowBox label="Architectural" sub="Updated" color="#3b82f6" />
            <div className="w-full sm:hidden" />
            <div className="hidden sm:block text-slate-700 mx-2">|</div>
            <FlowArrow label="BOQ + Quantities" dir="↓" color="#22c55e" vertical />
            <div className="w-full flex justify-center mt-2 sm:hidden">
              <FlowBox label="CivilOS Estimate" sub="BOQ + Costing" color="#22c55e" />
            </div>
          </div>
          {/* Estimate box for desktop */}
          <div className="hidden sm:flex justify-center mt-3">
            <FlowBox label="CivilOS Estimate" sub="BOQ + Costing" color="#22c55e" />
          </div>
        </div>

        {/* ── Tab Switcher ──────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-lg bg-slate-800/40 border border-slate-700/40 w-fit">
          {([
            { key: 'import', label: '📥 Import', sub: 'Architectural → এখানে' },
            { key: 'export', label: '📤 Export', sub: 'এখান থেকে → অন্য App' },
          ] as const).map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-lg text-xs font-mono font-semibold transition-all flex flex-col items-center gap-0.5 ${
                tab === t.key
                  ? 'bg-slate-700 text-slate-200 shadow'
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <span>{t.label}</span>
              <span className="text-slate-600 font-normal text-[10px]">{t.sub}</span>
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════
            IMPORT TAB
        ════════════════════════════════════════════ */}
        {tab === 'import' && (
          <div className="space-y-4">

            <SectionHeader icon="📥" title="Architectural BIM Import" titleLocal=".civp ফাইল থেকে Grid ও Member import" />

            {/* File drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed border-slate-600 hover:border-purple-500/60 bg-white/02 hover:bg-purple-500/04 p-8 text-center cursor-pointer transition-all group"
            >
              <div className="text-3xl mb-3">📂</div>
              <p className="text-slate-400 font-mono text-sm group-hover:text-slate-300 transition-colors">
                .civp ফাইল বেছে নিন
              </p>
              <p className="text-slate-600 font-mono text-xs mt-1">
                CivilOS Architectural থেকে export করা .civp file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".civp,.json"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Parse error */}
            {parseError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/08 p-4">
                <p className="text-red-400 font-mono text-xs">⚠ {parseError}</p>
              </div>
            )}

            {/* Parsed file preview */}
            {parsedFile && !importResult && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/05 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="text-purple-300 font-mono font-semibold text-sm">ফাইল রেডি</span>
                  <span className="ml-auto text-xs font-mono text-slate-500">
                    Source: {parsedFile.source}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <InfoRow label="প্রজেক্ট"  value={parsedFile.project_name} />
                  <InfoRow label="প্রজেক্ট নং" value={parsedFile.project_no} />
                  <InfoRow label="Grid X"    value={`${parsedFile.grid?.xLines.length ?? 0} টি`} />
                  <InfoRow label="Grid Y"    value={`${parsedFile.grid?.yLines.length ?? 0} টি`} />
                  <InfoRow label="Story"     value={`${parsedFile.grid?.stories.length ?? 0} টি`} />
                  <InfoRow label="Column"    value={`${parsedFile.members?.columns.length ?? 0} টি`} />
                  <InfoRow label="Slab"      value={`${parsedFile.members?.slabs.length ?? 0} টি`} />
                  <InfoRow label="Opening"   value={`${parsedFile.openings?.length ?? 0} টি`} />
                </div>

                <button
                  onClick={handleImport}
                  className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold text-sm hover:bg-purple-500/30 transition-all"
                >
                  ✅ Import শুরু করুন
                </button>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`rounded-xl border p-4 space-y-3 ${
                importResult.success
                  ? 'border-green-500/30 bg-green-500/05'
                  : 'border-red-500/30 bg-red-500/05'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{importResult.success ? '✅' : '❌'}</span>
                  <span className={`font-mono font-bold text-sm ${
                    importResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {importResult.success ? 'Import সফল!' : 'Import ব্যর্থ'}
                  </span>
                </div>

                {/* Imported counts */}
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(importResult.imported).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white/03 border border-slate-700/40 p-2 text-center">
                      <div className="text-lg font-bold font-mono text-slate-300">{v}</div>
                      <div className="text-[10px] font-mono text-slate-600 capitalize">{k}</div>
                    </div>
                  ))}
                </div>

                {/* Warnings */}
                {importResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-yellow-500 font-semibold">⚠ সতর্কতা:</p>
                    {importResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs font-mono text-slate-500">• {w}</p>
                    ))}
                  </div>
                )}

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-mono text-red-400 font-semibold">✖ Error:</p>
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs font-mono text-red-300">• {e}</p>
                    ))}
                  </div>
                )}

                {importResult.success && (
                  <button
                    onClick={() => { setImportResult(null); setParsedFile(null) }}
                    className="text-xs font-mono text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    আবার import করুন →
                  </button>
                )}
              </div>
            )}

            {/* What gets imported info */}
            <div className="rounded-xl border border-slate-700/30 bg-white/01 p-4 space-y-2">
              <p className="text-xs font-mono text-slate-500 font-semibold">📋 Import-এ কী আসবে:</p>
              {[
                ['Grid Lines', 'X ও Y axis grid, spacing সহ'],
                ['Story Heights', 'Floor-to-floor height, elevation'],
                ['Column Positions', 'Grid intersection-এ column placement'],
                ['Wall Positions', 'Structural ও shear wall'],
                ['Slab Boundaries', 'Panel boundary, thickness'],
                ['Opening Locations', 'Door/window — load calculation-এর জন্য'],
              ].map(([title, desc]) => (
                <div key={title} className="flex gap-3 text-xs font-mono">
                  <span className="text-purple-400 shrink-0">✦</span>
                  <span className="text-slate-400 font-semibold w-36 shrink-0">{title}</span>
                  <span className="text-slate-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            EXPORT TAB
        ════════════════════════════════════════════ */}
        {tab === 'export' && (
          <div className="space-y-5">

            <SectionHeader icon="📤" title="BIM Export" titleLocal="এই প্রজেক্টের data অন্য App-এ পাঠান" />

            {/* Export Card 1 — Architectural */}
            <ExportCard
              icon="🏛"
              title="Architectural App-এ Export"
              titleLocal="Updated member sizes → Architectural BIM"
              color="#3b82f6"
              state={exportState.architectural}
              items={[
                'Column section sizes (updated from design)',
                'Beam dimensions + rebar details',
                'Slab thickness',
                'Foundation sizes',
                'Grid + story data',
              ]}
              itemsLocal={[
                'Column সেকশন সাইজ (design-এর পর update)',
                'Beam ডিমেনশন + rebar বিস্তারিত',
                'Slab পুরুত্ব',
                'Foundation সাইজ',
                'Grid + story data',
              ]}
              onExport={() => handleExport('architectural')}
              filename={`${project.meta.projectNo}_arch.civp`}
            />

            {/* Export Card 2 — Estimate/BOQ */}
            <ExportCard
              icon="📊"
              title="CivilOS Estimate-এ Export (BOQ)"
              titleLocal="Quantities → BOQ + Costing"
              color="#22c55e"
              state={exportState.estimate}
              disabled={!hasDesign}
              disabledNote="RCC Design সম্পন্ন হলে quantity accurate হবে"
              items={[
                `Concrete: ${project.members.columns.length + project.members.beams.length + project.members.slabs.length + project.members.foundations.length} members`,
                'Steel weight per member (from BBS)',
                'Formwork area per story',
                'Earthwork — excavation volume',
                'Summary: total concrete m³ + steel MT',
              ]}
              itemsLocal={[
                `Concrete: মোট ${project.members.columns.length + project.members.beams.length + project.members.slabs.length + project.members.foundations.length}টি member`,
                'প্রতি member-এর স্টিলের ওজন (BBS থেকে)',
                'প্রতি story-র formwork area',
                'Earthwork — মাটি খোঁড়ার volume',
                'Summary: মোট concrete m³ + স্টিল MT',
              ]}
              onExport={() => handleExport('estimate')}
              filename={`${project.meta.projectNo}_estimate.civp`}
            />

            {/* Quick summary of current project quantities */}
            <div className="rounded-xl border border-slate-700/30 bg-white/01 p-4">
              <p className="text-xs font-mono text-slate-500 font-semibold mb-3">
                📐 বর্তমান প্রজেক্টের Member Count
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: 'Column',     val: project.members.columns.length,     color: '#ef4444' },
                  { label: 'Beam',       val: project.members.beams.length,        color: '#f97316' },
                  { label: 'Slab',       val: project.members.slabs.length,        color: '#eab308' },
                  { label: 'Foundation', val: project.members.foundations.length,  color: '#8b5cf6' },
                  { label: 'Wall',       val: project.members.walls.length,        color: '#06b6d4' },
                ].map(m => (
                  <div key={m.label} className="rounded-lg border p-3 text-center"
                    style={{ borderColor: m.color + '30', background: m.color + '08' }}>
                    <div className="text-xl font-bold font-mono" style={{ color: m.color }}>{m.val}</div>
                    <div className="text-xs font-mono text-slate-600 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* .civp format info */}
            <div className="rounded-xl border border-slate-700/30 bg-white/01 p-4">
              <p className="text-xs font-mono text-slate-500 font-semibold mb-2">📄 .civp ফাইল ফরম্যাট</p>
              <pre className="text-[10px] font-mono text-slate-600 leading-relaxed overflow-x-auto">{`{
  "civp_version": "2.0",
  "source": "structural",
  "exported_at": <timestamp>,
  "project_name": "${project.meta.name}",
  "grid": { "xLines": [...], "yLines": [...], "stories": [...] },
  "members": { "columns": [...], "beams": [...], ... },
  "quantities": { "concrete": [...], "steel": [...], "summary": {...} }
}`}</pre>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function SectionHeader({ icon, title, titleLocal }: { icon: string; title: string; titleLocal: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-base shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-slate-200 font-mono font-semibold text-sm">{title}</p>
        <p className="text-slate-500 font-mono text-xs mt-0.5">{titleLocal}</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-600 w-28 shrink-0">{label}:</span>
      <span className="text-slate-300 truncate">{value}</span>
    </div>
  )
}

function FlowBox({ label, sub, color, active }: { label: string; sub: string; color: string; active?: boolean }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-center min-w-[110px]"
      style={{
        borderColor: color + (active ? '80' : '40'),
        background:  color + (active ? '18' : '08'),
      }}>
      <p className="font-mono font-bold text-xs" style={{ color }}>{label}</p>
      <p className="font-mono text-[10px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  )
}

function FlowArrow({ label, dir, color, vertical }: { label: string; dir: string; color: string; vertical?: boolean }) {
  return (
    <div className={`flex ${vertical ? 'flex-col' : 'flex-row'} items-center gap-1`}>
      <span className="font-mono text-base" style={{ color }}>{dir}</span>
      <span className="font-mono text-[10px] text-slate-600">{label}</span>
    </div>
  )
}

function ExportCard({
  icon, title, titleLocal, color, state, items, itemsLocal,
  onExport, filename, disabled, disabledNote,
}: {
  icon:         string
  title:        string
  titleLocal:   string
  color:        string
  state:        ExportState
  items:        string[]
  itemsLocal:   string[]
  onExport:     () => void
  filename:     string
  disabled?:    boolean
  disabledNote?: string
}) {
  const btnLabel =
    state === 'generating' ? 'তৈরি হচ্ছে...' :
    state === 'done'       ? '✅ Download হয়েছে!' :
    state === 'error'      ? '⚠ Error হয়েছে' :
    `⬇ Export করুন`

  return (
    <div className="rounded-xl border p-5 space-y-4"
      style={{ borderColor: color + '30', background: color + '05' }}>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: color + '18', border: `1px solid ${color}30` }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 font-mono font-semibold text-sm">{title}</p>
          <p className="text-slate-500 font-mono text-xs mt-0.5">{titleLocal}</p>
        </div>
        <div className="shrink-0 text-[10px] font-mono text-slate-700 bg-slate-800/60 px-2 py-1 rounded">
          {filename}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {items.map((item, i) => (
          <div key={i} className="text-xs font-mono text-slate-500 flex gap-2">
            <span style={{ color: color + 'cc' }}>✦</span>
            <span>{itemsLocal[i]}</span>
          </div>
        ))}
      </div>

      {disabled && disabledNote && (
        <p className="text-xs font-mono text-yellow-600">⚠ {disabledNote}</p>
      )}

      <button
        onClick={onExport}
        disabled={state === 'generating'}
        className="w-full py-3 rounded-xl font-mono font-bold text-sm transition-all disabled:opacity-50"
        style={{
          background:   state === 'done' ? '#22c55e20' : state === 'error' ? '#ef444420' : color + '18',
          borderWidth:  1,
          borderStyle:  'solid',
          borderColor:  state === 'done' ? '#22c55e50' : state === 'error' ? '#ef444450' : color + '40',
          color:        state === 'done' ? '#22c55e'   : state === 'error' ? '#ef4444'   : color,
        }}
      >
        {btnLabel}
      </button>
    </div>
  )
}
