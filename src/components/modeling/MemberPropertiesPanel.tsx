import { useState, useEffect } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { Column, Beam } from '../../lib/types'
import { STANDARD_BAR_DIAMETERS, barArea } from '../../lib/utils'

interface Props {
  memberId: string
  memberType: string
  onClose: () => void
}

export default function MemberPropertiesPanel({ memberId, memberType, onClose }: Props) {
  const { project, updateColumn, updateBeam, deleteColumn, deleteBeam } = useProjectStore()
  if (!project) return null

  function handleDelete() {
    if (memberType === 'column') deleteColumn(memberId)
    else deleteBeam(memberId)
    onClose()
  }

  return (
    <div className="w-72 border-l border-[#e5e7eb] bg-[#ffffff] flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb]">
        <div>
          <div className="text-xs text-gray-500 font-mono">
            {memberType === 'column' ? '■ Column' : '━ Beam'}
          </div>
          <div className="text-gray-800 font-mono font-semibold text-sm mt-0.5">
            {memberType === 'column'
              ? project.members.columns.find(c => c.id === memberId)?.label
              : project.members.beams.find(b => b.id === memberId)?.label}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-600 transition-colors"
        >✕</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {memberType === 'column' && (
          <ColumnProperties memberId={memberId} />
        )}
        {memberType === 'beam' && (
          <BeamProperties memberId={memberId} />
        )}
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-[#e5e7eb]">
        <button
          onClick={handleDelete}
          className="w-full py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 text-xs font-mono hover:bg-red-500/20 transition-all"
        >
          🗑 Delete (Del)
        </button>
      </div>
    </div>
  )
}

// ── Column Properties ─────────────────────────────────────────

function ColumnProperties({ memberId }: { memberId: string }) {
  const { project, updateColumn } = useProjectStore()
  const col = project?.members.columns.find(c => c.id === memberId)
  if (!col) return null

  const isRect = col.section.type === 'rectangular'
  const isCirc = col.section.type === 'circular'

  function update(data: Partial<Column>) {
    updateColumn(memberId, data)
  }

  function setSection(type: 'rectangular' | 'circular') {
    if (type === 'rectangular') {
      update({ section: { type: 'rectangular', width: 300, depth: 400 } })
    } else {
      update({ section: { type: 'circular', diameter: 400 } })
    }
  }

  const gridX = project?.grid.xLines.find(l => l.id === col.gridX)?.label ?? '—'
  const gridY = project?.grid.yLines.find(l => l.id === col.gridY)?.label ?? '—'

  return (
    <div className="p-4 space-y-5">
      {/* Location info */}
      <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb]">
        <p className="text-xs text-gray-500 font-mono mb-2">Location</p>
        <div className="flex gap-3 text-xs font-mono">
          <span className="text-blue-600">X: {gridX}</span>
          <span className="text-blue-600">Y: {gridY}</span>
        </div>
      </div>

      {/* Label */}
      <PropField label="Label">
        <input
          value={col.label}
          onChange={e => update({ label: e.target.value })}
          className="input-field"
        />
      </PropField>

      {/* Section type */}
      <PropField label="Section Type">
        <div className="flex gap-2">
          {[
            { type: 'rectangular' as const, label: 'Rectangular' },
            { type: 'circular' as const, label: 'Circular' },
          ].map(opt => (
            <button
              key={opt.type}
              onClick={() => setSection(opt.type)}
              className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-all ${
                col.section.type === opt.type
                  ? 'border-blue-500/40 bg-blue-500/15 text-blue-600'
                  : 'border-[#e5e7eb] text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PropField>

      {/* Dimensions */}
      {isRect && (
        <div className="grid grid-cols-2 gap-3">
          <PropField label="Width b (mm)">
            <input
              type="number"
              value={(col.section as any).width}
              onChange={e => update({ section: { ...col.section, type: 'rectangular', width: Number(e.target.value) } as any })}
              className="input-field"
            />
          </PropField>
          <PropField label="Depth h (mm)">
            <input
              type="number"
              value={(col.section as any).depth}
              onChange={e => update({ section: { ...col.section, type: 'rectangular', depth: Number(e.target.value) } as any })}
              className="input-field"
            />
          </PropField>
        </div>
      )}

      {isCirc && (
        <PropField label="Diameter D (mm)">
          <input
            type="number"
            value={(col.section as any).diameter}
            onChange={e => update({ section: { type: 'circular', diameter: Number(e.target.value) } })}
            className="input-field"
          />
        </PropField>
      )}

      <PropField label="Clear Cover (mm)">
        <input
          type="number"
          value={col.clearCover}
          onChange={e => update({ clearCover: Number(e.target.value) })}
          className="input-field"
        />
      </PropField>

      <PropField label="Rotation (°)">
        <input
          type="number"
          value={col.rotation}
          onChange={e => update({ rotation: Number(e.target.value) })}
          className="input-field"
        />
      </PropField>

      {/* Section summary */}
      <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb] space-y-1.5">
        <p className="text-xs text-gray-500 font-mono mb-2">Section Summary</p>
        {isRect && (
          <>
            <SummaryRow label="b × h" value={`${(col.section as any).width} × ${(col.section as any).depth} mm`} />
            <SummaryRow
              label="Area (Ag)"
              value={`${((col.section as any).width * (col.section as any).depth / 1e6).toFixed(4)} m²`}
            />
          </>
        )}
        {isCirc && (
          <>
            <SummaryRow label="D" value={`${(col.section as any).diameter} mm`} />
            <SummaryRow
              label="Area (Ag)"
              value={`${(Math.PI * Math.pow((col.section as any).diameter, 2) / 4 / 1e6).toFixed(4)} m²`}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── Beam Properties ──────────────────────────────────────────

function BeamProperties({ memberId }: { memberId: string }) {
  const { project, updateBeam } = useProjectStore()
  const beam = project?.members.beams.find(b => b.id === memberId)
  if (!beam) return null

  function update(data: Partial<Beam>) {
    updateBeam(memberId, data)
  }

  const bw = (beam.section as any).width ?? 250
  const bd = (beam.section as any).depth ?? 450

  return (
    <div className="p-4 space-y-5">
      {/* Connection info */}
      <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb]">
        <p className="text-xs text-gray-500 font-mono mb-2">Connection Nodes</p>
        <div className="text-xs font-mono text-gray-600 space-y-1">
          <div>Start: <span className="text-orange-600">{beam.startNodeId.replace('node_', '').replace('_', '-')}</span></div>
          <div>End: <span className="text-orange-600">{beam.endNodeId.replace('node_', '').replace('_', '-')}</span></div>
        </div>
      </div>

      {/* Label */}
      <PropField label="Label">
        <input
          value={beam.label}
          onChange={e => update({ label: e.target.value })}
          className="input-field"
        />
      </PropField>

      {/* Section type */}
      <PropField label="Section Type">
        <div className="flex gap-2">
          {[
            { type: 'rectangular', label: 'Rectangular' },
            { type: 't_beam', label: 'T-Beam' },
          ].map(opt => (
            <button
              key={opt.type}
              onClick={() => {
                if (opt.type === 'rectangular') {
                  update({ section: { type: 'rectangular', width: 250, depth: 450 } })
                } else {
                  update({ section: { type: 't_beam', webWidth: 250, webDepth: 450, flangeWidth: 700, flangeThickness: 125 } })
                }
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-mono border transition-all ${
                beam.section.type === opt.type
                  ? 'border-orange-500/40 bg-orange-500/15 text-orange-600'
                  : 'border-[#e5e7eb] text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PropField>

      {/* Dimensions */}
      {beam.section.type === 'rectangular' && (
        <div className="grid grid-cols-2 gap-3">
          <PropField label="Width bw (mm)">
            <input
              type="number"
              value={bw}
              onChange={e => update({ section: { type: 'rectangular', width: Number(e.target.value), depth: bd } })}
              className="input-field"
            />
          </PropField>
          <PropField label="Depth h (mm)">
            <input
              type="number"
              value={bd}
              onChange={e => update({ section: { type: 'rectangular', width: bw, depth: Number(e.target.value) } })}
              className="input-field"
            />
          </PropField>
        </div>
      )}

      {beam.section.type === 't_beam' && (
        <div className="grid grid-cols-2 gap-3">
          <PropField label="Web bw (mm)">
            <input type="number" value={(beam.section as any).webWidth}
              onChange={e => update({ section: { ...(beam.section as any), webWidth: Number(e.target.value) } })}
              className="input-field" />
          </PropField>
          <PropField label="Web h (mm)">
            <input type="number" value={(beam.section as any).webDepth}
              onChange={e => update({ section: { ...(beam.section as any), webDepth: Number(e.target.value) } })}
              className="input-field" />
          </PropField>
          <PropField label="Flange bf (mm)">
            <input type="number" value={(beam.section as any).flangeWidth}
              onChange={e => update({ section: { ...(beam.section as any), flangeWidth: Number(e.target.value) } })}
              className="input-field" />
          </PropField>
          <PropField label="Flange tf (mm)">
            <input type="number" value={(beam.section as any).flangeThickness}
              onChange={e => update({ section: { ...(beam.section as any), flangeThickness: Number(e.target.value) } })}
              className="input-field" />
          </PropField>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-600 font-mono">Cantilever</label>
        <button
          onClick={() => update({ isCantilever: !beam.isCantilever })}
          className={`w-10 h-5 rounded-full transition-all ${beam.isCantilever ? 'bg-orange-500' : 'bg-[#e5e7eb]'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white mx-0.5 transition-transform ${beam.isCantilever ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <PropField label="Clear Cover (mm)">
        <input
          type="number"
          value={beam.clearCover}
          onChange={e => update({ clearCover: Number(e.target.value) })}
          className="input-field"
        />
      </PropField>

      {/* Section summary */}
      <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb] space-y-1.5">
        <p className="text-xs text-gray-500 font-mono mb-2">Section Summary</p>
        <SummaryRow label="bw × h" value={`${bw} × ${bd} mm`} />
        <SummaryRow label="d (eff.)" value={`${bd - beam.clearCover - 10 - 8} mm`} />
        <SummaryRow label="Area" value={`${(bw * bd / 1e6).toFixed(4)} m²`} />
      </div>
    </div>
  )
}

// ── Shared UI ─────────────────────────────────────────────────

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 font-mono mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs font-mono">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  )
}
