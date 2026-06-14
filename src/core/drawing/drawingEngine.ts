// ============================================================
// CivilOS Structural — Drawing Generation Engine
// Phase 9: Auto-generate structural drawings
// Plan View, Elevation, Column Schedule, Beam Schedule
// ============================================================

import { CivilOSProject, GridData, Story } from '../../lib/types'

// ── Drawing Sheet Sizes ───────────────────────────────────────

export const SHEET_SIZES = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841,  height: 594 },
  A2: { width: 594,  height: 420 },
  A3: { width: 420,  height: 297 },
  A4: { width: 297,  height: 210 },
} as const

export type SheetSize = keyof typeof SHEET_SIZES

// ── Drawing Element Types ─────────────────────────────────────

export type DrawingLayer = 'grid' | 'column' | 'beam' | 'slab' | 'wall' | 'dimension' | 'text' | 'border' | 'titleblock'

export interface DrawingLine {
  type:    'line'
  layer:   DrawingLayer
  x1: number; y1: number; x2: number; y2: number
  color:   string
  width:   number
  dash?:   number[]
}

export interface DrawingRect {
  type:  'rect'
  layer: DrawingLayer
  x: number; y: number; w: number; h: number
  fill?:    string
  stroke:   string
  strokeW:  number
}

export interface DrawingCircle {
  type:   'circle'
  layer:  DrawingLayer
  cx: number; cy: number; r: number
  fill?:  string
  stroke: string
  strokeW: number
}

export interface DrawingText {
  type:    'text'
  layer:   DrawingLayer
  x: number; y: number
  text:    string
  size:    number
  color:   string
  align?:  'left' | 'center' | 'right'
  bold?:   boolean
  rotate?: number
}

export interface DrawingDimension {
  type:   'dimension'
  layer:  DrawingLayer
  x1: number; y1: number; x2: number; y2: number
  value:  string
  offset: number   // px from line
  color:  string
}

export type DrawingElement = DrawingLine | DrawingRect | DrawingCircle | DrawingText | DrawingDimension

// ── Drawing Sheet ─────────────────────────────────────────────

export interface DrawingSheet {
  id:       string
  title:    string
  drawingNo: string
  type:     'plan' | 'elevation' | 'section' | 'schedule' | 'foundation'
  sheetSize: SheetSize
  scale:    string   // e.g. "1:100"
  elements: DrawingElement[]
  storyId?: string
  meta: {
    project:  string
    client:   string
    engineer: string
    date:     string
    rev:      string
  }
}

// ── Drawing Colors ────────────────────────────────────────────

export const DC = {
  grid:     '#1e3a5f',
  gridText: '#2d4a6a',
  column:   '#3b82f6',
  beam:     '#f97316',
  slab:     '#22c55e22',
  wall:     '#8b5cf6',
  dim:      '#334155',
  dimText:  '#475569',
  text:     '#94a3b8',
  title:    '#e2e8f0',
  border:   '#1e2d4a',
  bg:       '#0a0f1e',
  hatch:    '#1a2535',
}

// ── Scale calculator ──────────────────────────────────────────

export function calcDrawingScale(
  gridW: number,  // mm — building width
  gridH: number,  // mm — building height
  paperW: number, // mm — paper width (viewport)
  paperH: number, // mm — paper height
  margin = 60     // px
): { scale: number; scaleStr: string; offsetX: number; offsetY: number } {
  const availW = paperW - margin * 2
  const availH = paperH - margin * 2

  const scaleX = availW / gridW
  const scaleY = availH / gridH
  const scale  = Math.min(scaleX, scaleY)

  // Find nearest standard scale
  const stdScales = [1/1000, 1/500, 1/200, 1/100, 1/75, 1/50, 1/25]
  const nearestScale = stdScales.reduce((prev, curr) =>
    Math.abs(curr - scale) < Math.abs(prev - scale) ? curr : prev
  )

  const drawW = gridW * nearestScale
  const drawH = gridH * nearestScale

  return {
    scale:    nearestScale,
    scaleStr: `1:${Math.round(1 / nearestScale)}`,
    offsetX:  (paperW - drawW) / 2,
    offsetY:  (paperH - drawH) / 2,
  }
}

// ── Plan View Generator ───────────────────────────────────────

export function generatePlanDrawing(
  project: CivilOSProject,
  storyIndex: number,
  paperW = 800,
  paperH = 600
): DrawingSheet {
  const elements: DrawingElement[] = []
  const { grid, members, meta } = project
  const story = grid.stories[storyIndex]
  if (!story) return emptySheet('plan', project, paperW, paperH)

  // Building bounds
  const xPositions = grid.xLines.map(l => l.position)
  const yPositions = grid.yLines.map(l => l.position)
  const minX = Math.min(...xPositions), maxX = Math.max(...xPositions)
  const minY = Math.min(...yPositions), maxY = Math.max(...yPositions)
  const gridW = maxX - minX || 10000
  const gridH = maxY - minY || 8000

  const margin = 80
  const { scale, scaleStr, offsetX, offsetY } = calcDrawingScale(gridW, gridH, paperW, paperH - 100, margin)

  const toX = (mm: number) => offsetX + (mm - minX) * scale
  const toY = (mm: number) => offsetY + (mm - minY) * scale

  // ── Title block (bottom strip) ────────────────────────────
  elements.push(...titleBlock(paperW, paperH, {
    project:  meta.name,
    drawingTitle: `STRUCTURAL PLAN — ${story.label} (EL.+${(story.level/1000).toFixed(2)}m)`,
    drawingNo: `S-P-${String(storyIndex+1).padStart(2,'0')}`,
    scale: scaleStr,
    client:   meta.client,
    engineer: meta.engineer,
    date:     new Date().toLocaleDateString('en-GB'),
    rev:      'A',
  }))

  // ── Grid lines (dashed) ───────────────────────────────────
  const xExt = 500 * scale   // extension beyond grid (mm→px)
  const yExt = 500 * scale

  for (const xLine of grid.xLines) {
    const x = toX(xLine.position)
    const y1 = toY(minY) - yExt, y2 = toY(maxY) + yExt
    elements.push({ type: 'line', layer: 'grid', x1: x, y1, x2: x, y2,
      color: DC.grid, width: 0.5, dash: [6, 4] })

    // Grid label circles top and bottom
    ;[y1 - 14, y2 + 14].forEach(cy => {
      elements.push({ type: 'circle', layer: 'grid', cx: x, cy, r: 12,
        fill: DC.bg, stroke: DC.gridText, strokeW: 1 })
      elements.push({ type: 'text', layer: 'grid', x, y: cy,
        text: xLine.label, size: 9, color: DC.gridText, align: 'center' })
    })
  }

  for (const yLine of grid.yLines) {
    const y = toY(yLine.position)
    const x1 = toX(minX) - xExt, x2 = toX(maxX) + xExt
    elements.push({ type: 'line', layer: 'grid', x1, y1: y, x2, y2: y,
      color: DC.grid, width: 0.5, dash: [6, 4] })

    ;[x1 - 14, x2 + 14].forEach(cx => {
      elements.push({ type: 'circle', layer: 'grid', cx, cy: y, r: 12,
        fill: DC.bg, stroke: DC.gridText, strokeW: 1 })
      elements.push({ type: 'text', layer: 'grid', x: cx, y,
        text: yLine.label, size: 9, color: DC.gridText, align: 'center' })
    })
  }

  // ── Dimension lines (grid spacing) ────────────────────────
  if (grid.xLines.length >= 2) {
    const dimY = toY(minY) - yExt - 35
    for (let i = 0; i < grid.xLines.length - 1; i++) {
      const x1 = toX(grid.xLines[i].position)
      const x2 = toX(grid.xLines[i+1].position)
      const span = (grid.xLines[i+1].position - grid.xLines[i].position) / 1000
      elements.push({ type: 'dimension', layer: 'dimension',
        x1, y1: dimY, x2, y2: dimY,
        value: `${span.toFixed(2)}m`, offset: 8, color: DC.dim })
    }
  }

  if (grid.yLines.length >= 2) {
    const dimX = toX(minX) - xExt - 35
    for (let i = 0; i < grid.yLines.length - 1; i++) {
      const y1 = toY(grid.yLines[i].position)
      const y2 = toY(grid.yLines[i+1].position)
      const span = (grid.yLines[i+1].position - grid.yLines[i].position) / 1000
      elements.push({ type: 'dimension', layer: 'dimension',
        x1: dimX, y1, x2: dimX, y2,
        value: `${span.toFixed(2)}m`, offset: 8, color: DC.dim })
    }
  }

  // ── Beams ─────────────────────────────────────────────────
  const storyBeams = members.beams.filter(b => b.storyId === story.id)
  for (const beam of storyBeams) {
    const sp = parseNodeIdForDrawing(beam.startNodeId)
    const ep = parseNodeIdForDrawing(beam.endNodeId)
    if (!sp || !ep) continue

    const xLs = grid.xLines.find(l => l.id === sp.gridX)
    const yLs = grid.yLines.find(l => l.id === sp.gridY)
    const xLe = grid.xLines.find(l => l.id === ep.gridX)
    const yLe = grid.yLines.find(l => l.id === ep.gridY)
    if (!xLs || !yLs || !xLe || !yLe) continue

    const bw  = Math.max((beam.section as any).width ?? 250, 100)
    const bwPx = bw * scale / 2

    const x1 = toX(xLs.position), y1 = toY(yLs.position)
    const x2 = toX(xLe.position), y2 = toY(yLe.position)

    // Beam as thick line with parallel offset lines
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.sqrt(dx*dx + dy*dy) || 1
    const nx = -dy / len * bwPx, ny = dx / len * bwPx

    elements.push({ type: 'line', layer: 'beam', x1, y1, x2, y2,
      color: DC.beam, width: Math.max(bwPx * 2, 2) })
    elements.push({ type: 'line', layer: 'beam', x1: x1+nx, y1: y1+ny, x2: x2+nx, y2: y2+ny,
      color: DC.beam + '80', width: 0.5 })
    elements.push({ type: 'line', layer: 'beam', x1: x1-nx, y1: y1-ny, x2: x2-nx, y2: y2-ny,
      color: DC.beam + '80', width: 0.5 })

    // Beam label at midpoint
    const mx = (x1+x2)/2, my = (y1+y2)/2
    elements.push({ type: 'text', layer: 'text', x: mx, y: my - 8,
      text: beam.label, size: 8, color: DC.beam, align: 'center' })
    elements.push({ type: 'text', layer: 'text', x: mx, y: my + 2,
      text: `${(beam.section as any).width??250}×${(beam.section as any).depth??450}`,
      size: 7, color: DC.beam + 'aa', align: 'center' })
  }

  // ── Columns ───────────────────────────────────────────────
  const storyCols = members.columns.filter(c => c.storyId === story.id)
  for (const col of storyCols) {
    const xLine = grid.xLines.find(l => l.id === col.gridX)
    const yLine = grid.yLines.find(l => l.id === col.gridY)
    if (!xLine || !yLine) continue

    const cx = toX(xLine.position)
    const cy = toY(yLine.position)

    if (col.section.type === 'circular') {
      const r = Math.max(col.section.diameter * scale / 2, 4)
      elements.push({ type: 'circle', layer: 'column', cx, cy, r,
        fill: DC.column + '30', stroke: DC.column, strokeW: 1.5 })
      // Cross hatch
      elements.push({ type: 'line', layer: 'column', x1: cx-r, y1: cy, x2: cx+r, y2: cy,
        color: DC.column, width: 0.5 })
      elements.push({ type: 'line', layer: 'column', x1: cx, y1: cy-r, x2: cx, y2: cy+r,
        color: DC.column, width: 0.5 })
    } else {
      const w = Math.max(col.section.width  * scale, 6)
      const h = Math.max(col.section.depth  * scale, 6)
      elements.push({ type: 'rect', layer: 'column',
        x: cx - w/2, y: cy - h/2, w, h,
        fill: DC.column + '25', stroke: DC.column, strokeW: 1.5 })
      elements.push({ type: 'line', layer: 'column', x1: cx-w/2, y1: cy-h/2, x2: cx+w/2, y2: cy+h/2,
        color: DC.column, width: 0.4 })
      elements.push({ type: 'line', layer: 'column', x1: cx+w/2, y1: cy-h/2, x2: cx-w/2, y2: cy+h/2,
        color: DC.column, width: 0.4 })
    }

    // Column label below
    if (scale > 0.04) {
      elements.push({ type: 'text', layer: 'text', x: cx, y: cy + 12,
        text: col.label, size: 7, color: DC.column + 'cc', align: 'center' })
    }
  }

  // ── North arrow ───────────────────────────────────────────
  elements.push(...northArrow(paperW - 50, 50, 25))

  return {
    id:        `plan-${storyIndex}`,
    title:     `Plan — ${story.label}`,
    drawingNo: `S-P-${String(storyIndex+1).padStart(2,'0')}`,
    type:      'plan',
    sheetSize: 'A2',
    scale:     scaleStr,
    elements,
    storyId:   story.id,
    meta: {
      project:  meta.name,
      client:   meta.client,
      engineer: meta.engineer,
      date:     new Date().toLocaleDateString('en-GB'),
      rev:      'A',
    },
  }
}

// ── Elevation View Generator ──────────────────────────────────

export function generateElevationDrawing(
  project: CivilOSProject,
  gridLineId: string,
  direction: 'x' | 'y',
  paperW = 800,
  paperH = 550
): DrawingSheet {
  const elements: DrawingElement[] = []
  const { grid, members, meta } = project

  const stories = grid.stories
  const totalH = stories.reduce((s, st) => s + st.height, 0)  // mm

  // Grid lines perpendicular to elevation
  const perpLines = direction === 'x' ? grid.xLines : grid.yLines
  const totalSpan = perpLines.length >= 2
    ? perpLines.at(-1)!.position - perpLines[0].position : 10000  // mm

  const margin = 80
  const { scale, scaleStr, offsetX, offsetY } =
    calcDrawingScale(totalSpan, totalH, paperW, paperH - 100, margin)

  const minPos  = perpLines[0]?.position ?? 0
  const toX = (pos: number) => offsetX + (pos - minPos) * scale
  const toY = (elev: number) => offsetY + (totalH - elev) * scale

  // Ground line
  elements.push({ type: 'line', layer: 'grid',
    x1: toX(minPos) - 20, y1: toY(0),
    x2: toX(perpLines.at(-1)?.position ?? totalSpan) + 20, y2: toY(0),
    color: '#475569', width: 2 })
  elements.push({ type: 'text', layer: 'text',
    x: toX(minPos) - 30, y: toY(0),
    text: 'GL', size: 9, color: '#64748b', align: 'right' })

  // Story levels + labels
  for (const story of stories) {
    const elev = story.level
    const y    = toY(elev)
    elements.push({ type: 'line', layer: 'grid',
      x1: toX(minPos) - 20, y1: y,
      x2: toX(perpLines.at(-1)?.position ?? totalSpan) + 20, y2: y,
      color: DC.grid, width: 0.5, dash: [8, 4] })
    elements.push({ type: 'text', layer: 'text',
      x: toX(minPos) - 8, y,
      text: `${story.label} +${(elev/1000).toFixed(2)}m`,
      size: 8, color: DC.dimText, align: 'right' })
  }

  // Roof level
  const roofElev = totalH
  elements.push({ type: 'line', layer: 'grid',
    x1: toX(minPos) - 20, y1: toY(roofElev),
    x2: toX(perpLines.at(-1)?.position ?? totalSpan) + 20, y2: toY(roofElev),
    color: DC.grid, width: 1 })
  elements.push({ type: 'text', layer: 'text',
    x: toX(minPos) - 8, y: toY(roofElev),
    text: `RF +${(roofElev/1000).toFixed(2)}m`,
    size: 8, color: DC.dimText, align: 'right' })

  // Grid lines vertical (columns grid)
  for (const line of perpLines) {
    const x = toX(line.position)
    elements.push({ type: 'line', layer: 'grid',
      x1: x, y1: toY(roofElev) - 20,
      x2: x, y2: toY(0) + 20,
      color: DC.grid, width: 0.5, dash: [6, 4] })

    // Circle labels
    ;[toY(roofElev) - 32, toY(0) + 32].forEach(cy => {
      elements.push({ type: 'circle', layer: 'grid', cx: x, cy, r: 12,
        fill: DC.bg, stroke: DC.gridText, strokeW: 1 })
      elements.push({ type: 'text', layer: 'grid', x, y: cy,
        text: line.label, size: 9, color: DC.gridText, align: 'center' })
    })
  }

  // Columns as rectangles for each story
  for (const story of stories) {
    const y1 = toY(story.level + story.height)
    const y2 = toY(story.level)
    const storyCols = members.columns.filter(c => c.storyId === story.id)

    for (const col of storyCols) {
      const posLine = direction === 'x'
        ? grid.xLines.find(l => l.id === col.gridX)
        : grid.yLines.find(l => l.id === col.gridY)
      if (!posLine) continue

      const cx = toX(posLine.position)
      const w  = Math.max(
        ((direction === 'x' ? (col.section as any).width : (col.section as any).depth) ?? 300) * scale,
        4
      )
      elements.push({ type: 'rect', layer: 'column',
        x: cx - w/2, y: y1, w, h: y2 - y1,
        fill: DC.column + '20', stroke: DC.column, strokeW: 1.2 })
    }

    // Beams
    const storyBeams = members.beams.filter(b => b.storyId === story.id)
    const beamY = toY(story.level + story.height)

    for (const beam of storyBeams) {
      const sp = parseNodeIdForDrawing(beam.startNodeId)
      const ep = parseNodeIdForDrawing(beam.endNodeId)
      if (!sp || !ep) continue

      const startLine = direction === 'x'
        ? grid.xLines.find(l => l.id === sp.gridX)
        : grid.yLines.find(l => l.id === sp.gridY)
      const endLine = direction === 'x'
        ? grid.xLines.find(l => l.id === ep.gridX)
        : grid.yLines.find(l => l.id === ep.gridY)
      if (!startLine || !endLine) continue

      const bh  = Math.max(((beam.section as any).depth ?? 450) * scale, 3)
      const bw  = Math.max(((beam.section as any).width ?? 250) * scale, 2)
      const x1  = toX(startLine.position)
      const x2  = toX(endLine.position)

      elements.push({ type: 'rect', layer: 'beam',
        x: Math.min(x1, x2), y: beamY,
        w: Math.abs(x2 - x1), h: bh,
        fill: DC.beam + '25', stroke: DC.beam, strokeW: 1 })

      elements.push({ type: 'text', layer: 'text',
        x: (x1+x2)/2, y: beamY + bh/2,
        text: beam.label, size: 7, color: DC.beam, align: 'center' })
    }
  }

  // Dimension — total height
  elements.push({ type: 'dimension', layer: 'dimension',
    x1: toX(perpLines.at(-1)?.position ?? totalSpan) + 35, y1: toY(0),
    x2: toX(perpLines.at(-1)?.position ?? totalSpan) + 35, y2: toY(roofElev),
    value: `${(roofElev/1000).toFixed(2)}m`, offset: 8, color: DC.dim })

  elements.push(...titleBlock(paperW, paperH, {
    project:      meta.name,
    drawingTitle: `STRUCTURAL ELEVATION — ${direction.toUpperCase()}-DIRECTION`,
    drawingNo:    `S-E-01`,
    scale:        scaleStr,
    client:       meta.client,
    engineer:     meta.engineer,
    date:         new Date().toLocaleDateString('en-GB'),
    rev:          'A',
  }))

  return {
    id:        'elevation-x',
    title:     `Elevation — ${direction.toUpperCase()}`,
    drawingNo: 'S-E-01',
    type:      'elevation',
    sheetSize: 'A2',
    scale:     scaleStr,
    elements,
    meta: { project: meta.name, client: meta.client, engineer: meta.engineer,
            date: new Date().toLocaleDateString('en-GB'), rev: 'A' },
  }
}

// ── Column Schedule Generator ─────────────────────────────────

export function generateColumnSchedule(project: CivilOSProject, paperW = 700, paperH = 500): DrawingSheet {
  const elements: DrawingElement[] = []
  const cols = project.members.columns

  // Table setup
  const startX = 40, startY = 60
  const rowH = 28
  const cols_ = [
    { label: 'Mark',    w: 60  },
    { label: 'b (mm)',  w: 70  },
    { label: 'h (mm)',  w: 70  },
    { label: 'Bars',    w: 100 },
    { label: 'Ties',    w: 80  },
    { label: 'Story',   w: 80  },
    { label: 'Cover',   w: 60  },
  ]

  // Title
  elements.push({ type: 'text', layer: 'text', x: paperW/2, y: 30,
    text: 'COLUMN SCHEDULE', size: 13, color: DC.title, align: 'center', bold: true })

  // Header row
  let cx = startX
  for (const col of cols_) {
    elements.push({ type: 'rect', layer: 'text', x: cx, y: startY, w: col.w, h: rowH,
      fill: DC.column + '20', stroke: DC.border, strokeW: 1 })
    elements.push({ type: 'text', layer: 'text', x: cx + col.w/2, y: startY + rowH/2,
      text: col.label, size: 8, color: DC.column, align: 'center', bold: true })
    cx += col.w
  }

  // Unique columns by label
  const uniqueLabels = [...new Set(cols.map(c => c.label))]
  uniqueLabels.slice(0, 15).forEach((lbl, i) => {
    const col = cols.find(c => c.label === lbl)!
    const rowY = startY + (i + 1) * rowH
    const story = project.grid.stories.find(s => s.id === col.storyId)

    const bw = col.section.type === 'rectangular' ? col.section.width  : (col.section as any).diameter
    const bh = col.section.type === 'rectangular' ? col.section.depth  : (col.section as any).diameter

    const vals = [
      col.label,
      bw.toString(),
      bh.toString(),
      '8-#16mm',       // placeholder — Phase 6 result would populate
      '#10@150mm',     // placeholder
      story?.label ?? '—',
      col.clearCover.toString(),
    ]

    let cx2 = startX
    vals.forEach((v, j) => {
      const cw = cols_[j].w
      elements.push({ type: 'rect', layer: 'text', x: cx2, y: rowY, w: cw, h: rowH,
        stroke: DC.border, strokeW: 0.5 })
      elements.push({ type: 'text', layer: 'text', x: cx2 + cw/2, y: rowY + rowH/2,
        text: v, size: 8, color: DC.text, align: 'center' })
      cx2 += cw
    })
  })

  elements.push(...titleBlock(paperW, paperH, {
    project: project.meta.name, drawingTitle: 'COLUMN SCHEDULE',
    drawingNo: 'S-CS-01', scale: 'NTS',
    client: project.meta.client, engineer: project.meta.engineer,
    date: new Date().toLocaleDateString('en-GB'), rev: 'A',
  }))

  return {
    id: 'col-schedule', title: 'Column Schedule', drawingNo: 'S-CS-01',
    type: 'schedule', sheetSize: 'A3', scale: 'NTS', elements,
    meta: { project: project.meta.name, client: project.meta.client,
            engineer: project.meta.engineer, date: new Date().toLocaleDateString('en-GB'), rev: 'A' },
  }
}

// ── Helper: Title Block ───────────────────────────────────────

function titleBlock(W: number, H: number, info: {
  project: string; drawingTitle: string; drawingNo: string; scale: string
  client: string; engineer: string; date: string; rev: string
}): DrawingElement[] {
  const tbH = 60, tbY = H - tbH
  const elements: DrawingElement[] = []

  // Background
  elements.push({ type: 'rect', layer: 'titleblock', x: 0, y: tbY, w: W, h: tbH,
    fill: '#080d1a', stroke: DC.border, strokeW: 1 })

  // Dividers
  elements.push({ type: 'line', layer: 'titleblock', x1: W*0.45, y1: tbY, x2: W*0.45, y2: H,
    color: DC.border, width: 1 })
  elements.push({ type: 'line', layer: 'titleblock', x1: W*0.65, y1: tbY, x2: W*0.65, y2: H,
    color: DC.border, width: 1 })
  elements.push({ type: 'line', layer: 'titleblock', x1: W*0.82, y1: tbY, x2: W*0.82, y2: H,
    color: DC.border, width: 1 })

  // Text entries
  const entries = [
    { x: W*0.01, y: tbY+14, text: `PROJECT: ${info.project}`, bold: true },
    { x: W*0.01, y: tbY+28, text: `CLIENT: ${info.client}` },
    { x: W*0.01, y: tbY+42, text: `ENGINEER: ${info.engineer}` },
    { x: W*0.46, y: tbY+18, text: info.drawingTitle, bold: true },
    { x: W*0.46, y: tbY+40, text: `SCALE: ${info.scale}` },
    { x: W*0.66, y: tbY+18, text: `DWG NO: ${info.drawingNo}`, bold: true },
    { x: W*0.66, y: tbY+36, text: `DATE: ${info.date}` },
    { x: W*0.83, y: tbY+18, text: `REV: ${info.rev}` },
    { x: W*0.83, y: tbY+36, text: 'BNBC 2020' },
  ]

  entries.forEach(e => elements.push({
    type: 'text', layer: 'titleblock',
    x: e.x, y: e.y, text: e.text,
    size: e.bold ? 9 : 8, color: e.bold ? DC.title : DC.text,
    bold: e.bold,
  }))

  // Outer border
  elements.push({ type: 'rect', layer: 'border', x: 4, y: 4, w: W-8, h: H-8,
    stroke: DC.border, strokeW: 1.5 })

  return elements
}

// ── Helper: North Arrow ───────────────────────────────────────

function northArrow(cx: number, cy: number, r: number): DrawingElement[] {
  return [
    { type: 'circle', layer: 'text', cx, cy, r, fill: 'transparent', stroke: DC.dimText, strokeW: 1 } as DrawingCircle,
    { type: 'line', layer: 'text', x1: cx, y1: cy+r-2, x2: cx, y2: cy-r+2, color: DC.dimText, width: 1 } as DrawingLine,
    { type: 'text', layer: 'text', x: cx, y: cy-r-8, text: 'N', size: 9, color: DC.dimText, align: 'center' } as DrawingText,
  ]
}

// ── Helper: Parse node id ─────────────────────────────────────

function parseNodeIdForDrawing(nodeId: string): { gridX: string; gridY: string } | null {
  const parts = nodeId.split('_')
  if (nodeId.startsWith('node_') && parts.length >= 3)
    return { gridX: parts[1], gridY: parts[2] }
  if (nodeId.startsWith('N_') && parts.length >= 4)
    return { gridX: parts[1], gridY: parts[2] }
  return null
}

function emptySheet(type: DrawingSheet['type'], project: CivilOSProject, W: number, H: number): DrawingSheet {
  return {
    id: type, title: type, drawingNo: 'S-00', type, sheetSize: 'A3', scale: '1:100', elements: [],
    meta: { project: project.meta.name, client: project.meta.client,
            engineer: project.meta.engineer, date: '', rev: 'A' }
  }
}
