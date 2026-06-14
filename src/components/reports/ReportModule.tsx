import { useState, useMemo } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { assembleReport, ReportDocument, ReportType, ReportContent } from '../../core/report/reportEngine'
import { exportToPDF, exportToDOCX, exportBBSToExcel } from '../../core/report/exporters'
import { generateBBS } from '../../core/bbs/bbsEngine'

const REPORT_TYPES: { id: ReportType; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'full',          label: 'Complete Report',      icon: '📋', desc: 'সব section একসাথে',         color: '#ef4444' },
  { id: 'design_basis',  label: 'Design Basis',         icon: '📐', desc: 'Parameters + Seismic + Wind', color: '#3b82f6' },
  { id: 'analysis',      label: 'Analysis Report',      icon: '🧮', desc: 'Results + Drifts + Forces',   color: '#8b5cf6' },
  { id: 'compliance',    label: 'Compliance Report',    icon: '✅', desc: 'BNBC 2020 checks',             color: '#22c55e' },
  { id: 'member_design', label: 'Member Design',        icon: '🏗', desc: 'Beam/Column/Slab summary',    color: '#f97316' },
  { id: 'bbs',           label: 'BBS Report',           icon: '🔩', desc: 'Bar Bending Schedule',        color: '#06b6d4' },
]

type ExportState = 'idle' | 'generating' | 'done' | 'error'

export default function ReportModule() {
  const { project } = useProjectStore()
  const [selectedType, setSelectedType]   = useState<ReportType>('full')
  const [preview,      setPreview]        = useState<ReportDocument | null>(null)
  const [pdfState,     setPdfState]       = useState<ExportState>('idle')
  const [docxState,    setDocxState]      = useState<ExportState>('idle')
  const [xlsxState,    setXlsxState]      = useState<ExportState>('idle')
  const [activeSection, setActiveSection] = useState<string | null>(null)

  if (!project) return null

  // Auto-generate preview when type changes
  const doc = useMemo<ReportDocument>(
    () => assembleReport(project, selectedType),
    [selectedType, project.meta, project.members, project.grid,
     project.loads, project.materials, project.results]
  )

  async function handlePDF() {
    setPdfState('generating')
    try {
      await exportToPDF(doc)
      setPdfState('done')
      setTimeout(() => setPdfState('idle'), 3000)
    } catch (e) {
      console.error(e)
      setPdfState('error')
      setTimeout(() => setPdfState('idle'), 3000)
    }
  }

  async function handleDOCX() {
    setDocxState('generating')
    try {
      await exportToDOCX(doc)
      setDocxState('done')
      setTimeout(() => setDocxState('idle'), 3000)
    } catch (e) {
      console.error(e)
      setDocxState('error')
      setTimeout(() => setDocxState('idle'), 3000)
    }
  }

  async function handleExcel() {
    setXlsxState('generating')
    try {
      const sheet = generateBBS(project)
      await exportBBSToExcel(sheet)
      setXlsxState('done')
      setTimeout(() => setXlsxState('idle'), 3000)
    } catch (e) {
      console.error(e)
      setXlsxState('error')
      setTimeout(() => setXlsxState('idle'), 3000)
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — controls */}
      <div className="w-72 border-r border-[#1e2d4a] bg-[#080d1a] flex flex-col shrink-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-5 border-b border-[#1e2d4a]">
          <div className="h-0.5 rounded mb-4" style={{ background: 'linear-gradient(90deg,#ef4444,#f97316)' }} />
          <h2 className="text-slate-200 font-mono font-bold text-sm">Report Export</h2>
          <p className="text-slate-600 font-mono text-xs mt-1">Phase 12 — PDF · DOCX · Excel</p>
        </div>

        {/* Report type selector */}
        <div className="px-4 py-4 border-b border-[#1e2d4a]">
          <p className="text-slate-600 font-mono text-xs tracking-wider mb-3">REPORT TYPE</p>
          <div className="space-y-2">
            {REPORT_TYPES.map(t => (
              <button key={t.id} onClick={() => setSelectedType(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                  selectedType === t.id
                    ? 'text-white'
                    : 'border-[#1e2d4a] text-slate-500 hover:text-slate-300 hover:border-slate-600'
                }`}
                style={selectedType === t.id ? {
                  borderColor: t.color + '50',
                  background:  t.color + '15',
                } : {}}>
                <span className="text-lg">{t.icon}</span>
                <div>
                  <div className="text-xs font-mono font-semibold"
                    style={{ color: selectedType === t.id ? t.color : undefined }}>
                    {t.label}
                  </div>
                  <div className="text-xs text-slate-600 font-mono mt-0.5">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Export buttons */}
        <div className="px-4 py-4 space-y-3">
          <p className="text-slate-600 font-mono text-xs tracking-wider mb-3">EXPORT FORMAT</p>

          <ExportButton
            icon="📄"
            label="Export PDF"
            sublabel="Professional report"
            color="#ef4444"
            state={pdfState}
            onClick={handlePDF}
          />
          <ExportButton
            icon="📝"
            label="Export DOCX"
            sublabel="Word document"
            color="#3b82f6"
            state={docxState}
            onClick={handleDOCX}
          />
          <ExportButton
            icon="📊"
            label="Export BBS Excel"
            sublabel="Bar bending schedule"
            color="#22c55e"
            state={xlsxState}
            onClick={handleExcel}
          />
        </div>

        {/* Document info */}
        <div className="px-4 py-4 border-t border-[#1e2d4a] mt-auto">
          <div className="bg-[#0d1221] rounded-xl border border-[#1e2d4a] p-3 space-y-1.5 text-xs font-mono">
            <div className="text-slate-500">Document Info</div>
            <div className="flex justify-between text-slate-400">
              <span>Sections</span>
              <span className="text-slate-200">{doc.sections.length}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Type</span>
              <span className="text-slate-200">{REPORT_TYPES.find(t => t.id === selectedType)?.label}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Project</span>
              <span className="text-slate-200 truncate max-w-[100px]">{project.meta.projectNo}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — preview */}
      <div className="flex-1 overflow-y-auto bg-[#0a0f1e]">
        {/* Preview header */}
        <div className="sticky top-0 z-10 px-6 py-3 bg-[#080d1a] border-b border-[#1e2d4a] flex items-center gap-3">
          <span className="text-slate-500 font-mono text-xs">PREVIEW</span>
          <span className="text-slate-300 font-mono text-xs font-semibold">{doc.title}</span>
          <span className="ml-auto text-slate-600 font-mono text-xs">
            {new Date(doc.generatedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Cover */}
        <div className="mx-6 mt-6 rounded-2xl overflow-hidden border border-[#1e2d4a]">
          {/* Cover gradient */}
          <div className="relative px-8 py-10 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0f172a, #1a1f3a)' }}>
            <div className="absolute top-0 left-0 w-2 h-full"
              style={{ background: 'linear-gradient(180deg,#ef4444,#f97316)' }} />
            <div className="absolute top-0 left-0 right-0 h-0.5"
              style={{ background: 'linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6)' }} />

            <div className="text-xs font-mono text-slate-500 mb-2 tracking-widest">
              CivilOS STRUCTURAL v2.0
            </div>
            <div className="text-2xl font-bold font-mono text-white mb-1">{doc.title}</div>
            <div className="text-slate-400 font-mono text-sm">{doc.subtitle}</div>

            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 text-xs font-mono">
              {[
                ['Project No.', doc.projectMeta.projectNo],
                ['Date', doc.projectMeta.date],
                ['Client', doc.projectMeta.client || '—'],
                ['Engineer', doc.projectMeta.engineer || '—'],
                ['Code', doc.projectMeta.code],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-slate-600">{k}:</span>
                  <span className="text-slate-300">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="px-6 py-6 space-y-4">
          {doc.sections.map((section, si) => (
            <div key={section.id} className="rounded-xl border border-[#1e2d4a] overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between px-5 py-4 bg-[#0d1221] hover:bg-[#111827] transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-slate-600 font-mono text-xs">
                    {String(si).padStart(2, '0')}
                  </span>
                  <span className="text-slate-200 font-mono font-semibold text-sm">
                    {section.title}
                  </span>
                  <span className="text-slate-600 font-mono text-xs">
                    ({section.content.length} items)
                  </span>
                </div>
                <span className="text-slate-600 text-xs">
                  {activeSection === section.id ? '▲' : '▼'}
                </span>
              </button>

              {/* Section content preview */}
              {activeSection === section.id && (
                <div className="p-5 space-y-4 bg-[#0a0f1e] border-t border-[#1e2d4a]">
                  {section.content.map((item, i) => (
                    <ContentPreview key={i} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="px-6 pb-8">
          <div className="rounded-xl border border-[#1e2d4a] bg-[#0d1221] p-4 text-xs font-mono text-slate-600 space-y-1">
            <div className="text-slate-500 font-semibold">📦 Required npm packages for export:</div>
            <div className="font-mono text-slate-600">
              npm install jspdf docx xlsx
            </div>
            <div className="text-slate-700 mt-2">
              • jsPDF — PDF generation (client-side)<br/>
              • docx — Microsoft Word DOCX generation<br/>
              • xlsx (SheetJS) — Excel BBS export
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Export Button ─────────────────────────────────────────────

function ExportButton({ icon, label, sublabel, color, state, onClick }: {
  icon: string; label: string; sublabel: string
  color: string; state: ExportState; onClick: () => void
}) {
  const stateConfig = {
    idle:       { text: label,        bg: color + '15', border: color + '40', textCol: color },
    generating: { text: 'Generating...', bg: color + '20', border: color + '60', textCol: color },
    done:       { text: '✓ Downloaded!', bg: '#22c55e15', border: '#22c55e40', textCol: '#22c55e' },
    error:      { text: '✗ Error',      bg: '#ef444415', border: '#ef444440', textCol: '#ef4444' },
  }
  const cfg = stateConfig[state]

  return (
    <button
      onClick={onClick}
      disabled={state === 'generating'}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-mono text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.textCol }}>
      <span className="text-lg shrink-0">{state === 'generating' ? '⟳' : icon}</span>
      <div className="text-left">
        <div className="text-xs font-semibold">{cfg.text}</div>
        <div className="text-xs opacity-60 mt-0.5">{sublabel}</div>
      </div>
    </button>
  )
}

// ── Content Preview renderer ──────────────────────────────────

function ContentPreview({ item }: { item: ReportContent }) {
  switch (item.type) {
    case 'heading':
      return (
        <div className={`font-mono font-bold ${
          item.level === 1 ? 'text-red-400 text-sm border-b border-[#1e2d4a] pb-2'
            : item.level === 2 ? 'text-blue-400 text-xs'
            : 'text-slate-400 text-xs'
        }`}>
          {item.text}
        </div>
      )

    case 'paragraph':
      return <p className="text-slate-500 font-mono text-xs leading-relaxed">{item.text}</p>

    case 'keyvalue':
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {item.items.map((kv, i) => (
            <div key={i} className="flex gap-2 text-xs font-mono">
              <span className="text-slate-600 shrink-0">{kv.key}:</span>
              <span className="text-slate-300">{kv.value}{kv.unit ? ` ${kv.unit}` : ''}</span>
            </div>
          ))}
        </div>
      )

    case 'table':
      return (
        <div className="overflow-x-auto rounded-lg border border-[#1e2d4a]">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-[#080d1a]">
                {item.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-blue-400 font-semibold">
                    {String(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.rows.slice(0, 8).map((row, ri) => (
                <tr key={ri} className="border-t border-[#1a2030]">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2 ${ci === 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
              {item.rows.length > 8 && (
                <tr className="border-t border-[#1a2030]">
                  <td colSpan={item.headers.length}
                    className="px-3 py-2 text-slate-700 text-center italic">
                    ... {item.rows.length - 8} more rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )

    case 'checklist':
      return (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {item.items.map((ci, i) => {
            const colors = { pass: '#22c55e', fail: '#ef4444', warning: '#f97316', not_checked: '#475569' }
            return (
              <div key={i} className="flex items-center gap-2 text-xs font-mono">
                <span style={{ color: colors[ci.status] }}>
                  {ci.status === 'pass' ? '✓' : ci.status === 'fail' ? '✗' : ci.status === 'warning' ? '⚠' : '?'}
                </span>
                <span className="text-slate-400 truncate flex-1">{ci.label}</span>
                <span className="text-slate-600 shrink-0">{ci.value}</span>
              </div>
            )
          })}
        </div>
      )

    case 'formula':
      return (
        <div className="bg-[#080d1a] rounded-lg px-4 py-3 border border-[#1e3a5f]">
          <div className="text-blue-400 font-mono text-sm font-bold">{item.latex}</div>
          <div className="text-slate-500 font-mono text-xs mt-1">{item.description}</div>
        </div>
      )

    case 'spacer':
      return <div className="h-2" />

    default:
      return null
  }
}
