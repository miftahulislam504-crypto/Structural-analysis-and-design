import { useRef, useState, useEffect, useCallback } from 'react'
import { Stage, Layer, Line, Circle, Rect, Text, Group, Arrow } from 'react-konva'
import { useProjectStore } from '../../store/useProjectStore'
import { useUIStore } from '../../store/useUIStore'
import { DrawingTool } from './ModelingModule'
import {
  CanvasTransform,
  mmToCanvas,
  canvasToMm,
  snapToGrid,
  fitGridToCanvas,
  getGridIntersections,
} from '../../core/geometry/gridEngine'
import { generateId } from '../../lib/utils'
import { Column, Beam, Story } from '../../lib/types'

interface Props {
  activeTool: DrawingTool
  activeStory: Story | null
  selectedMemberId: string | null
  onMemberSelect: (id: string, type: string) => void
  onCanvasClick: () => void
}

const COLORS = {
  gridLine:       '#1e2d4a',
  gridLineMajor:  '#243554',
  gridLabel:      '#475569',
  gridDot:        '#1e3a5f',
  snapDot:        '#06b6d4',
  column:         '#3b82f6',
  columnSelected: '#60a5fa',
  columnHover:    '#93c5fd',
  beam:           '#f97316',
  beamSelected:   '#fb923c',
  beamHover:      '#fdba74',
  beamPreview:    '#f97316',
  background:     '#0a0f1e',
  dimensionLine:  '#334155',
  dimensionText:  '#475569',
}

export default function PlanCanvas({
  activeTool,
  activeStory,
  selectedMemberId,
  onMemberSelect,
  onCanvasClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 800, height: 600 })
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 0.06, offsetX: 80, offsetY: 80 })
  const [snapPoint, setSnapPoint] = useState<{ x: number; y: number; gridX?: string; gridY?: string } | null>(null)
  const [beamStart, setBeamStart] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const { project, addColumn, addBeam, deleteColumn, deleteBeam } = useProjectStore()
  const { showGrid } = useUIStore()

  // ── Resize observer ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Fit grid on mount / grid change ─────────────────────────
  useEffect(() => {
    if (!project) return
    const t = fitGridToCanvas(project.grid, size.width, size.height)
    setTransform(t)
  }, [project?.grid, size.width, size.height])

  if (!project || !activeStory) return null

  const { grid, members, materials } = project
  const intersections = getGridIntersections(grid)

  // Current story members
  const storyColumns = members.columns.filter(c => c.storyId === activeStory.id)
  const storyBeams = members.beams.filter(b => b.storyId === activeStory.id)

  // ── Column size on canvas ────────────────────────────────────
  function colSizePx(col: Column): { w: number; h: number } {
    if (col.section.type === 'rectangular') {
      return {
        w: col.section.width * transform.scale,
        h: col.section.depth * transform.scale,
      }
    }
    const d = (col.section as any).diameter * transform.scale
    return { w: d, h: d }
  }

  // ── Grid node id from grid line ids ─────────────────────────
  function makeNodeId(gridX: string, gridY: string) {
    return `node_${gridX}_${gridY}`
  }

  // ── Get column at grid intersection ─────────────────────────
  function getColumnAt(gridX: string, gridY: string): Column | undefined {
    return storyColumns.find(c => c.gridX === gridX && c.gridY === gridY)
  }

  // ── Mouse handlers ───────────────────────────────────────────

  function handleMouseMove(e: any) {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    if (!pos) return

    setMousePos({ x: pos.x, y: pos.y })

    // Snap
    const mm = canvasToMm(pos.x, pos.y, transform)
    const snapped = snapToGrid(mm.x, mm.y, grid, 600 / transform.scale)
    setSnapPoint(snapped)

    // Panning with middle mouse / space
    if (isPanning) {
      const dx = pos.x - panStart.x
      const dy = pos.y - panStart.y
      setTransform(t => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }))
      setPanStart({ x: pos.x, y: pos.y })
    }
  }

  function handleStageClick(e: any) {
    if (isPanning) return
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    if (!pos) return

    const mm = canvasToMm(pos.x, pos.y, transform)
    const snapped = snapToGrid(mm.x, mm.y, grid, 600 / transform.scale)

    if (activeTool === 'select') {
      // Clicked empty canvas
      if (e.target === stage) onCanvasClick()
      return
    }

    if (activeTool === 'column') {
      if (!snapped.gridX || !snapped.gridY) return
      // Don't place if already exists
      if (getColumnAt(snapped.gridX, snapped.gridY)) return

      const col: Column = {
        id: generateId('col'),
        label: `C${members.columns.length + 1}`,
        gridX: snapped.gridX,
        gridY: snapped.gridY,
        storyId: activeStory.id,
        section: { type: 'rectangular', width: 300, depth: 400 },
        materialId: materials.concrete.id,
        clearCover: materials.globalClearCover,
        rotation: 0,
      }
      addColumn(col)
    }

    if (activeTool === 'beam') {
      if (!snapped.gridX || !snapped.gridY) return
      const nodeId = makeNodeId(snapped.gridX, snapped.gridY)

      if (!beamStart) {
        // First click — set start
        setBeamStart({ x: snapped.x, y: snapped.y, nodeId })
      } else {
        // Second click — create beam
        if (beamStart.nodeId === nodeId) {
          setBeamStart(null)
          return
        }
        const beam: Beam = {
          id: generateId('bm'),
          label: `B${members.beams.length + 1}`,
          startNodeId: beamStart.nodeId,
          endNodeId: nodeId,
          storyId: activeStory.id,
          section: { type: 'rectangular', width: 250, depth: 450 },
          materialId: materials.concrete.id,
          clearCover: materials.globalClearCover,
          isCantilever: false,
        }
        addBeam(beam)
        setBeamStart(null)
      }
    }
  }

  // ── Wheel zoom ───────────────────────────────────────────────
  function handleWheel(e: any) {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition()
    if (!pos) return

    const zoomFactor = e.evt.deltaY < 0 ? 1.1 : 0.9
    const newScale = Math.max(0.02, Math.min(0.5, transform.scale * zoomFactor))

    setTransform(t => ({
      scale: newScale,
      offsetX: pos.x - (pos.x - t.offsetX) * (newScale / t.scale),
      offsetY: pos.y - (pos.y - t.offsetY) * (newScale / t.scale),
    }))
  }

  // ── Delete key ───────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedMemberId) {
        const isCol = members.columns.some(c => c.id === selectedMemberId)
        if (isCol) deleteColumn(selectedMemberId)
        else deleteBeam(selectedMemberId)
        onCanvasClick()
      }
      // Escape cancels beam drawing
      if (e.key === 'Escape') setBeamStart(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedMemberId, members])

  // ── Parse node id to get grid coords ────────────────────────
  function nodeToMm(nodeId: string): { x: number; y: number } | null {
    const parts = nodeId.split('_') // node_gxId_gyId
    if (parts.length < 3) return null
    const gxId = parts[1]
    const gyId = parts[2]
    const xLine = grid.xLines.find(l => l.id === gxId)
    const yLine = grid.yLines.find(l => l.id === gyId)
    if (!xLine || !yLine) return null
    return { x: xLine.position, y: yLine.position }
  }

  // ── Canvas pixel position of a grid intersection ─────────────
  function gridMmToCanvas(mmX: number, mmY: number) {
    return mmToCanvas(mmX, mmY, transform)
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: activeTool === 'select' ? 'default' : activeTool === 'column' ? 'crosshair' : 'crosshair' }}
    >
      <Stage
        width={size.width}
        height={size.height}
        onMouseMove={handleMouseMove}
        onClick={handleStageClick}
        onWheel={handleWheel}
        style={{ background: COLORS.background }}
      >
        {/* ── Grid Layer ── */}
        {showGrid && (
          <Layer>
            {/* X grid lines */}
            {grid.xLines.map((xLine) => {
              const top = grid.yLines[0]?.position ?? 0
              const bottom = grid.yLines.at(-1)?.position ?? 10000
              const start = gridMmToCanvas(xLine.position, top - 1000)
              const end = gridMmToCanvas(xLine.position, bottom + 1000)
              return (
                <Group key={xLine.id}>
                  <Line
                    points={[start.x, start.y, end.x, end.y]}
                    stroke={COLORS.gridLine}
                    strokeWidth={1}
                    dash={[8, 8]}
                  />
                  {/* Label top */}
                  <Circle
                    x={start.x} y={start.y - 4}
                    radius={14}
                    fill="#0d1221"
                    stroke={COLORS.gridLineMajor}
                    strokeWidth={1}
                  />
                  <Text
                    x={start.x - 8} y={start.y - 12}
                    text={xLine.label}
                    fontSize={11}
                    fill={COLORS.gridLabel}
                    fontFamily="JetBrains Mono, monospace"
                    width={16}
                    align="center"
                  />
                </Group>
              )
            })}

            {/* Y grid lines */}
            {grid.yLines.map((yLine) => {
              const left = grid.xLines[0]?.position ?? 0
              const right = grid.xLines.at(-1)?.position ?? 15000
              const start = gridMmToCanvas(left - 1000, yLine.position)
              const end = gridMmToCanvas(right + 1000, yLine.position)
              return (
                <Group key={yLine.id}>
                  <Line
                    points={[start.x, start.y, end.x, end.y]}
                    stroke={COLORS.gridLine}
                    strokeWidth={1}
                    dash={[8, 8]}
                  />
                  {/* Label left */}
                  <Circle
                    x={start.x - 4} y={start.y}
                    radius={14}
                    fill="#0d1221"
                    stroke={COLORS.gridLineMajor}
                    strokeWidth={1}
                  />
                  <Text
                    x={start.x - 12} y={start.y - 7}
                    text={yLine.label}
                    fontSize={11}
                    fill={COLORS.gridLabel}
                    fontFamily="JetBrains Mono, monospace"
                    width={16}
                    align="center"
                  />
                </Group>
              )
            })}

            {/* Grid intersection dots */}
            {intersections.map((pt) => {
              const cp = gridMmToCanvas(pt.x, pt.y)
              return (
                <Circle
                  key={pt.label}
                  x={cp.x} y={cp.y}
                  radius={2}
                  fill={COLORS.gridDot}
                />
              )
            })}

            {/* Dimension lines between grid lines */}
            {grid.xLines.length >= 2 && grid.xLines.slice(0, -1).map((xLine, i) => {
              const nextLine = grid.xLines[i + 1]
              const span = nextLine.position - xLine.position
              const midX = (xLine.position + nextLine.position) / 2
              const topY = (grid.yLines[0]?.position ?? 0) - 1600
              const cp = gridMmToCanvas(midX, topY)
              const spanM = (span / 1000).toFixed(2)
              return (
                <Text
                  key={`dim-x-${i}`}
                  x={cp.x - 20} y={cp.y}
                  text={`${spanM}m`}
                  fontSize={9}
                  fill={COLORS.dimensionText}
                  fontFamily="JetBrains Mono, monospace"
                  width={40}
                  align="center"
                />
              )
            })}
          </Layer>
        )}

        {/* ── Members Layer ── */}
        <Layer>
          {/* Beams */}
          {storyBeams.map((beam) => {
            const startMm = nodeToMm(beam.startNodeId)
            const endMm = nodeToMm(beam.endNodeId)
            if (!startMm || !endMm) return null

            const startPx = gridMmToCanvas(startMm.x, startMm.y)
            const endPx = gridMmToCanvas(endMm.x, endMm.y)
            const isSelected = selectedMemberId === beam.id
            const isHovered = hoveredId === beam.id

            const bw = (beam.section as any).width ?? 250
            const beamWidthPx = Math.max(bw * transform.scale, 3)

            const color = isSelected
              ? COLORS.beamSelected
              : isHovered
                ? COLORS.beamHover
                : COLORS.beam

            // Midpoint for label
            const midX = (startPx.x + endPx.x) / 2
            const midY = (startPx.y + endPx.y) / 2

            return (
              <Group key={beam.id}>
                <Line
                  points={[startPx.x, startPx.y, endPx.x, endPx.y]}
                  stroke={color}
                  strokeWidth={beamWidthPx}
                  lineCap="round"
                  lineJoin="round"
                  opacity={0.85}
                  onClick={() => onMemberSelect(beam.id, 'beam')}
                  onMouseEnter={() => setHoveredId(beam.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  hitStrokeWidth={Math.max(beamWidthPx + 8, 16)}
                  shadowColor={isSelected ? COLORS.beamSelected : 'transparent'}
                  shadowBlur={isSelected ? 8 : 0}
                />
                {/* Beam label */}
                {transform.scale > 0.04 && (
                  <Text
                    x={midX - 12} y={midY - 8}
                    text={beam.label}
                    fontSize={9}
                    fill={isSelected ? '#fff' : '#94a3b8'}
                    fontFamily="JetBrains Mono, monospace"
                    width={24}
                    align="center"
                  />
                )}
              </Group>
            )
          })}

          {/* Columns */}
          {storyColumns.map((col) => {
            const xLine = grid.xLines.find(l => l.id === col.gridX)
            const yLine = grid.yLines.find(l => l.id === col.gridY)
            if (!xLine || !yLine) return null

            const cp = gridMmToCanvas(xLine.position, yLine.position)
            const { w, h } = colSizePx(col)
            const isSelected = selectedMemberId === col.id
            const isHovered = hoveredId === col.id

            const color = isSelected
              ? COLORS.columnSelected
              : isHovered
                ? COLORS.columnHover
                : COLORS.column

            const rectW = Math.max(w, 8)
            const rectH = Math.max(h, 8)

            if (col.section.type === 'circular') {
              return (
                <Group key={col.id}>
                  <Circle
                    x={cp.x} y={cp.y}
                    radius={rectW / 2}
                    fill={color + '30'}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    onClick={() => onMemberSelect(col.id, 'column')}
                    onMouseEnter={() => setHoveredId(col.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    shadowColor={isSelected ? color : 'transparent'}
                    shadowBlur={isSelected ? 10 : 0}
                  />
                  {/* Cross hatch */}
                  <Line points={[cp.x - rectW / 2, cp.y, cp.x + rectW / 2, cp.y]} stroke={color} strokeWidth={0.5} opacity={0.4} />
                  <Line points={[cp.x, cp.y - rectW / 2, cp.x, cp.y + rectW / 2]} stroke={color} strokeWidth={0.5} opacity={0.4} />
                  {transform.scale > 0.05 && (
                    <Text x={cp.x - 14} y={cp.y + rectW / 2 + 3} text={col.label}
                      fontSize={9} fill={isSelected ? color : '#64748b'}
                      fontFamily="JetBrains Mono, monospace" width={28} align="center" />
                  )}
                </Group>
              )
            }

            return (
              <Group key={col.id}>
                <Rect
                  x={cp.x - rectW / 2} y={cp.y - rectH / 2}
                  width={rectW} height={rectH}
                  fill={color + '25'}
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1.5}
                  onClick={() => onMemberSelect(col.id, 'column')}
                  onMouseEnter={() => setHoveredId(col.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  shadowColor={isSelected ? color : 'transparent'}
                  shadowBlur={isSelected ? 10 : 0}
                />
                {/* Cross */}
                <Line points={[cp.x - rectW / 2, cp.y, cp.x + rectW / 2, cp.y]} stroke={color} strokeWidth={0.5} opacity={0.4} />
                <Line points={[cp.x, cp.y - rectH / 2, cp.x, cp.y + rectH / 2]} stroke={color} strokeWidth={0.5} opacity={0.4} />
                {transform.scale > 0.05 && (
                  <Text x={cp.x - 14} y={cp.y + rectH / 2 + 3} text={col.label}
                    fontSize={9} fill={isSelected ? color : '#64748b'}
                    fontFamily="JetBrains Mono, monospace" width={28} align="center" />
                )}
              </Group>
            )
          })}
        </Layer>

        {/* ── Interaction Layer ── */}
        <Layer>
          {/* Beam preview while drawing */}
          {activeTool === 'beam' && beamStart && snapPoint && (
            <Line
              points={[
                gridMmToCanvas(beamStart.x, beamStart.y).x,
                gridMmToCanvas(beamStart.x, beamStart.y).y,
                gridMmToCanvas(snapPoint.x, snapPoint.y).x,
                gridMmToCanvas(snapPoint.x, snapPoint.y).y,
              ]}
              stroke={COLORS.beamPreview}
              strokeWidth={3}
              dash={[6, 4]}
              opacity={0.7}
            />
          )}

          {/* Beam start marker */}
          {activeTool === 'beam' && beamStart && (
            <Circle
              x={gridMmToCanvas(beamStart.x, beamStart.y).x}
              y={gridMmToCanvas(beamStart.x, beamStart.y).y}
              radius={6}
              fill={COLORS.beamPreview}
              opacity={0.8}
            />
          )}

          {/* Snap indicator */}
          {(activeTool === 'column' || activeTool === 'beam') && snapPoint && snapPoint.gridX && snapPoint.gridY && (
            <Group>
              <Circle
                x={gridMmToCanvas(snapPoint.x, snapPoint.y).x}
                y={gridMmToCanvas(snapPoint.x, snapPoint.y).y}
                radius={8}
                stroke={COLORS.snapDot}
                strokeWidth={1.5}
                fill="transparent"
                dash={[3, 3]}
              />
              <Circle
                x={gridMmToCanvas(snapPoint.x, snapPoint.y).x}
                y={gridMmToCanvas(snapPoint.x, snapPoint.y).y}
                radius={3}
                fill={COLORS.snapDot}
              />
            </Group>
          )}
        </Layer>

        {/* ── HUD Layer ── */}
        <Layer>
          {/* Scale indicator */}
          <Group x={size.width - 100} y={size.height - 30}>
            <Line points={[0, 0, 60, 0]} stroke="#1e3a5f" strokeWidth={2} />
            <Line points={[0, -4, 0, 4]} stroke="#1e3a5f" strokeWidth={1.5} />
            <Line points={[60, -4, 60, 4]} stroke="#1e3a5f" strokeWidth={1.5} />
            <Text
              x={0} y={-18}
              text={`${Math.round(60 / transform.scale / 1000)}m`}
              fontSize={9}
              fill="#334155"
              fontFamily="JetBrains Mono, monospace"
              width={60}
              align="center"
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}
