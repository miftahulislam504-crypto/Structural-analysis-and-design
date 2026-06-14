// ============================================================
// CivilOS Structural — Bar Bending Schedule (BBS) Engine
// Phase 10: Auto-generate BBS for all members
// IS 2502 / BNBC 2020 / ACI 318-19 detailing rules
// ============================================================

import { CivilOSProject } from '../../lib/types'
import { barArea, barWeight } from '../../lib/utils'

// ── BBS Item ──────────────────────────────────────────────────

export type BarShape =
  | 'straight'
  | 'L_shape'       // one 90° bend
  | 'U_shape'       // stirrup / link
  | 'Z_shape'       // top bar with hooks both ends
  | 'hook_one_end'  // straight + hook one end
  | 'hook_both'     // hooks both ends
  | 'spiral'

export interface BBSBar {
  id:          string
  memberId:    string
  memberLabel: string
  memberType:  'beam' | 'column' | 'slab' | 'foundation' | 'staircase'
  storyLabel:  string
  mark:        string       // bar mark e.g. "T1", "B2"
  dia:         number       // mm
  noOfBars:    number
  shape:       BarShape
  // Cut lengths
  a: number                 // mm — main length
  b?: number                // mm — bend 1
  c?: number                // mm — bend 2
  d?: number                // mm — bend 3
  totalLength: number       // mm — cutting length per bar
  totalWeight: number       // kg — all bars
  // Extras
  hookAllowance: number     // mm deducted for bends
  note?: string
}

export interface BBSSummary {
  dia:        number        // mm
  totalBars:  number
  totalLength: number      // m
  totalWeight: number      // kg
}

export interface BBSSheet {
  projectName:  string
  projectNo:    string
  preparedBy:   string
  date:         string
  bars:         BBSBar[]
  summary:      BBSSummary[]
  grandTotal: {
    bars:    number
    weight:  number        // kg
    tonnage: number        // MT
  }
}

// ── Bend Deductions (IS 2502) ─────────────────────────────────

function bendDeduction(dia: number, angle: number): number {
  // Deduction per bend:
  // 45°: 1d, 90°: 2d, 135°: 3d (approximate)
  if (angle === 45)  return dia
  if (angle === 90)  return 2 * dia
  if (angle === 135) return 3 * dia
  return 2 * dia
}

function hookAllowance(dia: number, hookType: '90' | '135' | 'semi'): number {
  // IS 2502:
  // 90° hook = 9d, 135° hook = 9d+5d=14d (seismic), semi-circle = 12d+4d=16d
  if (hookType === '90')   return 9 * dia
  if (hookType === '135')  return 14 * dia  // seismic
  return 16 * dia
}

// ── Cutting Length Calculators ────────────────────────────────

function straightBar(l: number, dia: number, hooks: number): number {
  // hooks = 0, 1, or 2 (90° hooks)
  return l + hooks * hookAllowance(dia, '90')
}

function stirrupCuttingLength(
  bw: number,   // mm — beam/column width (outside stirrup)
  h:  number,   // mm — depth (outside stirrup)
  dia: number,  // mm — stirrup dia
  seismic: boolean
): number {
  // Perimeter + hooks
  const perim = 2 * (bw + h)
  const hookType = seismic ? '135' : '90'
  const hooks = 2 * hookAllowance(dia, hookType)
  const bends = 4 * bendDeduction(dia, 90)  // 4 corners
  return perim + hooks - bends
}

function lShapeBar(a: number, b: number, dia: number): number {
  return a + b - bendDeduction(dia, 90)
}

function uShapeBar(a: number, b: number, dia: number): number {
  // U-bar: a (leg1) + b (base) + a (leg2) - 2 × 90° bend deductions
  return 2 * a + b - 2 * bendDeduction(dia, 90)
}

// ── Beam BBS ──────────────────────────────────────────────────

function beamBBS(project: CivilOSProject): BBSBar[] {
  const bars: BBSBar[] = []
  const { members, grid, loads } = project
  const seismic = loads.seismicLoad.seismicZone >= 2

  for (const beam of members.beams) {
    const story = grid.stories.find(s => s.id === beam.storyId)
    const storyLabel = story?.label ?? '—'

    // Span length from node positions
    const sp = parseNodeId(beam.startNodeId)
    const ep = parseNodeId(beam.endNodeId)
    let span = 5000  // default mm
    if (sp && ep) {
      const xS = grid.xLines.find(l => l.id === sp.gridX)?.position ?? 0
      const yS = grid.yLines.find(l => l.id === sp.gridY)?.position ?? 0
      const xE = grid.xLines.find(l => l.id === ep.gridX)?.position ?? 0
      const yE = grid.yLines.find(l => l.id === ep.gridY)?.position ?? 0
      span = Math.round(Math.sqrt((xE-xS)**2 + (yE-yS)**2))
    }

    const bw  = (beam.section as any).width  ?? 250   // mm
    const h   = (beam.section as any).depth  ?? 450   // mm
    const cc  = beam.clearCover                        // mm
    const db  = 16   // mm — default main bar (Phase 6 result would populate)
    const dst = 10   // mm — stirrup

    // ── Bottom bars (T1) — full span + hooks both ends ────────
    const botLen   = span + 2 * hookAllowance(db, '90')
    const botDeduct = 0  // hooks already included
    bars.push({
      id:          `${beam.id}-T1`,
      memberId:    beam.id,
      memberLabel: beam.label,
      memberType:  'beam',
      storyLabel,
      mark:        'T1',
      dia:         db,
      noOfBars:    3,
      shape:       'hook_both',
      a:           span,
      b:           hookAllowance(db, '90'),
      totalLength: botLen,
      totalWeight: +( 3 * botLen / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(db, '90'),
      note:        'Bottom bars — full length',
    })

    // ── Top bars (T2) — L-shape, extends into supports ───────
    const topExt   = Math.max(span / 4, 600 + db * 12)  // mm — top bar extension
    const topA     = span + 2 * topExt
    const topLen   = straightBar(topA, db, 2)
    bars.push({
      id:          `${beam.id}-T2`,
      memberId:    beam.id,
      memberLabel: beam.label,
      memberType:  'beam',
      storyLabel,
      mark:        'T2',
      dia:         db,
      noOfBars:    2,
      shape:       'hook_both',
      a:           topA,
      b:           hookAllowance(db, '90'),
      totalLength: topLen,
      totalWeight: +( 2 * topLen / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(db, '90'),
      note:        'Top bars — extends into support',
    })

    // ── Stirrups (T3) ─────────────────────────────────────────
    const outerBw  = bw - 2 * cc + 2 * dst   // outer dim for stirrup calc
    const outerH   = h  - 2 * cc + 2 * dst
    const stirLen  = stirrupCuttingLength(outerBw, outerH, dst, seismic)

    // Count: 2 × zone1 + mid zone
    const zone1Len    = Math.min(2 * h, 600)           // mm
    const midLen      = span - 2 * zone1Len
    const sEnd        = seismic ? Math.min(h/4, 6*db, 150) : Math.min(h/2, 300)
    const sMid        = Math.min(h/2, 300)
    const nEnd        = Math.ceil(zone1Len / sEnd) + 1
    const nMid        = Math.ceil(midLen / sMid) + 1
    const nStirTotal  = 2 * nEnd + nMid

    bars.push({
      id:          `${beam.id}-T3`,
      memberId:    beam.id,
      memberLabel: beam.label,
      memberType:  'beam',
      storyLabel,
      mark:        'T3',
      dia:         dst,
      noOfBars:    nStirTotal,
      shape:       'U_shape',
      a:           outerH,
      b:           outerBw,
      totalLength: stirLen,
      totalWeight: +( nStirTotal * stirLen / 1000 * barWeight(dst) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(dst, seismic ? '135' : '90'),
      note:        `Stirrups: ${nEnd}@${Math.round(sEnd)}mm (end) + ${nMid}@${Math.round(sMid)}mm (mid)`,
    })
  }
  return bars
}

// ── Column BBS ────────────────────────────────────────────────

function columnBBS(project: CivilOSProject): BBSBar[] {
  const bars: BBSBar[] = []
  const { members, grid, loads } = project
  const seismic = loads.seismicLoad.seismicZone >= 2

  // Group columns by label (same column different stories)
  const colGroups = new Map<string, typeof members.columns>()
  for (const col of members.columns) {
    const g = colGroups.get(col.label) ?? []
    g.push(col)
    colGroups.set(col.label, g)
  }

  for (const [label, colList] of colGroups) {
    const col = colList[0]
    const story = grid.stories.find(s => s.id === col.storyId)
    const storyLabel = story?.label ?? '—'

    const bw   = col.section.type === 'rectangular' ? col.section.width : (col.section as any).diameter
    const h    = col.section.type === 'rectangular' ? col.section.depth : bw
    const cc   = col.clearCover
    const db   = 20   // mm — default main bar
    const dtie = 10   // mm — tie
    const colH = story?.height ?? 3000  // mm — one story

    // ── Main bars — with lap splice at each floor ─────────────
    const lapLen  = 1.3 * (3 / 40) * (project.materials.steel.fy /
                    (1.0 * Math.sqrt(project.materials.concrete.fc))) * db
    const barLen  = colH + Math.max(Math.ceil(lapLen / 25) * 25, 600)  // mm
    const nBars   = 8  // default

    bars.push({
      id:          `${col.id}-M1`,
      memberId:    col.id,
      memberLabel: label,
      memberType:  'column',
      storyLabel,
      mark:        'M1',
      dia:         db,
      noOfBars:    nBars * colList.length,
      shape:       'straight',
      a:           barLen,
      totalLength: barLen,
      totalWeight: +( nBars * colList.length * barLen / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 0,
      note:        `Main bars — ${nBars}/col × ${colList.length} stories, lap = ${Math.round(lapLen)}mm`,
    })

    // ── Ties ──────────────────────────────────────────────────
    const outerBw  = bw - 2 * cc + 2 * dtie
    const outerH   = h  - 2 * cc + 2 * dtie
    const tieLen   = stirrupCuttingLength(outerBw, outerH, dtie, seismic)

    const sConf   = seismic ? Math.min(bw/4, 6*db, 150) : Math.min(16*db, 48*dtie, bw)
    const sMid    = Math.min(16*db, 48*dtie, bw)
    const confLen = seismic ? Math.max(colH/6, bw, 450) : 0
    const nConf   = seismic ? 2 * Math.ceil(confLen / sConf) : 0
    const nMid    = Math.ceil((colH - 2*confLen) / sMid)
    const nTies   = Math.max(nConf + nMid, 3)

    bars.push({
      id:          `${col.id}-L1`,
      memberId:    col.id,
      memberLabel: label,
      memberType:  'column',
      storyLabel,
      mark:        'L1',
      dia:         dtie,
      noOfBars:    nTies * colList.length,
      shape:       'U_shape',
      a:           outerH,
      b:           outerBw,
      totalLength: tieLen,
      totalWeight: +( nTies * colList.length * tieLen / 1000 * barWeight(dtie) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(dtie, seismic ? '135' : '90'),
      note:        `Ties: ${nConf}@${Math.round(sConf)}mm (conf) + ${nMid}@${Math.round(sMid)}mm (mid)`,
    })
  }
  return bars
}

// ── Slab BBS ──────────────────────────────────────────────────

function slabBBS(project: CivilOSProject): BBSBar[] {
  const bars: BBSBar[] = []
  const { members, grid } = project

  for (const slab of members.slabs) {
    const story = grid.stories.find(s => s.id === slab.storyId)
    const storyLabel = story?.label ?? '—'

    // Span from grid
    const Lx = grid.xLines.length >= 2
      ? grid.xLines.at(-1)!.position - grid.xLines[0].position : 4000   // mm
    const Ly = grid.yLines.length >= 2
      ? grid.yLines.at(-1)!.position - grid.yLines[0].position : 5000

    const t  = slab.thickness
    const cc = slab.clearCover
    const db = 12   // mm
    const spacing = 150  // mm

    // ── X-direction bottom bars ────────────────────────────────
    const nX    = Math.ceil(Ly / spacing)
    const lenX  = Lx + 2 * hookAllowance(db, '90')
    bars.push({
      id:          `${slab.id}-SX`,
      memberId:    slab.id,
      memberLabel: slab.label,
      memberType:  'slab',
      storyLabel,
      mark:        'SX',
      dia:         db,
      noOfBars:    nX,
      shape:       'hook_both',
      a:           Lx,
      b:           hookAllowance(db, '90'),
      totalLength: lenX,
      totalWeight: +( nX * lenX / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(db, '90'),
      note:        `X-Bottom @${spacing}mm c/c`,
    })

    // ── Y-direction bottom bars ────────────────────────────────
    const nY    = Math.ceil(Lx / spacing)
    const lenY  = Ly + 2 * hookAllowance(db, '90')
    bars.push({
      id:          `${slab.id}-SY`,
      memberId:    slab.id,
      memberLabel: slab.label,
      memberType:  'slab',
      storyLabel,
      mark:        'SY',
      dia:         db,
      noOfBars:    nY,
      shape:       'hook_both',
      a:           Ly,
      b:           hookAllowance(db, '90'),
      totalLength: lenY,
      totalWeight: +( nY * lenY / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(db, '90'),
      note:        `Y-Bottom @${spacing}mm c/c`,
    })

    // ── Top bars at supports (extra bars) ─────────────────────
    const topLen  = Math.max(Lx / 4, 600) * 2  // mm — both sides
    const nXTop   = Math.ceil(Ly / (spacing * 1.5))
    bars.push({
      id:          `${slab.id}-ST`,
      memberId:    slab.id,
      memberLabel: slab.label,
      memberType:  'slab',
      storyLabel,
      mark:        'ST',
      dia:         db,
      noOfBars:    nXTop,
      shape:       'straight',
      a:           topLen,
      totalLength: topLen,
      totalWeight: +( nXTop * topLen / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 0,
      note:        `Top bars at support @${Math.round(spacing*1.5)}mm c/c`,
    })
  }
  return bars
}

// ── Foundation BBS ────────────────────────────────────────────

function foundationBBS(project: CivilOSProject): BBSBar[] {
  const bars: BBSBar[] = []
  const { members } = project

  for (const fdn of members.foundations) {
    if (fdn.type !== 'isolated') continue
    const db      = 16   // mm
    const cc      = 75   // mm cover for footing
    const L       = fdn.length   // mm
    const B       = fdn.width    // mm

    const nX = Math.ceil(B / 150)
    const nY = Math.ceil(L / 150)
    const lenX = L - 2*cc + 2 * hookAllowance(db, '90')
    const lenY = B - 2*cc + 2 * hookAllowance(db, '90')

    bars.push({
      id: `${fdn.id}-FX`, memberId: fdn.id, memberLabel: fdn.label,
      memberType: 'foundation', storyLabel: 'Foundation',
      mark: 'FX', dia: db, noOfBars: nX, shape: 'hook_both',
      a: L - 2*cc, b: hookAllowance(db, '90'),
      totalLength: lenX,
      totalWeight: +( nX * lenX / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(db, '90'),
      note: `X-direction @150mm c/c`,
    })

    bars.push({
      id: `${fdn.id}-FY`, memberId: fdn.id, memberLabel: fdn.label,
      memberType: 'foundation', storyLabel: 'Foundation',
      mark: 'FY', dia: db, noOfBars: nY, shape: 'hook_both',
      a: B - 2*cc, b: hookAllowance(db, '90'),
      totalLength: lenY,
      totalWeight: +( nY * lenY / 1000 * barWeight(db) ).toFixed(2),
      hookAllowance: 2 * hookAllowance(db, '90'),
      note: `Y-direction @150mm c/c`,
    })
  }
  return bars
}

// ── Summary calculation ───────────────────────────────────────

function calcSummary(bars: BBSBar[]): BBSSummary[] {
  const map = new Map<number, BBSSummary>()
  for (const bar of bars) {
    const s = map.get(bar.dia) ?? { dia: bar.dia, totalBars: 0, totalLength: 0, totalWeight: 0 }
    s.totalBars   += bar.noOfBars
    s.totalLength += bar.noOfBars * bar.totalLength / 1000  // m
    s.totalWeight += bar.totalWeight
    map.set(bar.dia, s)
  }
  return [...map.values()]
    .map(s => ({
      ...s,
      totalLength: +s.totalLength.toFixed(2),
      totalWeight: +s.totalWeight.toFixed(2),
    }))
    .sort((a, b) => a.dia - b.dia)
}

// ── Main BBS Generator ────────────────────────────────────────

export function generateBBS(project: CivilOSProject): BBSSheet {
  const beamBars   = beamBBS(project)
  const colBars    = columnBBS(project)
  const slabBars   = slabBBS(project)
  const fdnBars    = foundationBBS(project)

  const allBars    = [...beamBars, ...colBars, ...slabBars, ...fdnBars]
  const summary    = calcSummary(allBars)
  const totalWeight = +allBars.reduce((s, b) => s + b.totalWeight, 0).toFixed(2)

  return {
    projectName:  project.meta.name,
    projectNo:    project.meta.projectNo,
    preparedBy:   project.meta.engineer,
    date:         new Date().toLocaleDateString('en-GB'),
    bars:         allBars,
    summary,
    grandTotal: {
      bars:    allBars.reduce((s, b) => s + b.noOfBars, 0),
      weight:  totalWeight,
      tonnage: +(totalWeight / 1000).toFixed(3),
    },
  }
}

// ── Shape diagram SVG (mini inline) ──────────────────────────

export function barShapeSVG(bar: BBSBar): string {
  const W = 90, H = 50
  switch (bar.shape) {
    case 'straight':
      return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="25" x2="${W-8}" y2="25" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
        <text x="${W/2}" y="42" font-size="8" fill="#64748b" text-anchor="middle" font-family="monospace">a=${bar.a}mm</text>
      </svg>`

    case 'hook_both':
      return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <line x1="18" y1="25" x2="${W-18}" y2="25" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
        <line x1="18" y1="25" x2="8" y2="15" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
        <line x1="${W-18}" y1="25" x2="${W-8}" y2="15" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
        <text x="${W/2}" y="44" font-size="8" fill="#64748b" text-anchor="middle" font-family="monospace">a=${Math.round(bar.a/100)*100}+2h</text>
      </svg>`

    case 'U_shape':
      return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <line x1="15" y1="12" x2="15" y2="38" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
        <line x1="15" y1="38" x2="${W-15}" y2="38" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
        <line x1="${W-15}" y1="38" x2="${W-15}" y2="12" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
        <line x1="${W-15}" y1="12" x2="${W-5}" y2="6" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
        <line x1="15" y1="12" x2="5" y2="6" stroke="#f97316" stroke-width="3" stroke-linecap="round"/>
        <text x="${W/2}" y="48" font-size="7" fill="#64748b" text-anchor="middle" font-family="monospace">a=${bar.a} b=${bar.b}</text>
      </svg>`

    default:
      return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="25" x2="${W-8}" y2="25" stroke="#94a3b8" stroke-width="2"/>
      </svg>`
  }
}

// ── Helper ────────────────────────────────────────────────────

function parseNodeId(nodeId: string): { gridX: string; gridY: string } | null {
  const parts = nodeId.split('_')
  if (nodeId.startsWith('node_') && parts.length >= 3) return { gridX: parts[1], gridY: parts[2] }
  if (nodeId.startsWith('N_') && parts.length >= 4)    return { gridX: parts[1], gridY: parts[2] }
  return null
}
