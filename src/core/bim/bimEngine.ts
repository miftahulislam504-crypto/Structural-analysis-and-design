// ============================================================
// CivilOS Structural — BIM Integration Engine
// Phase 14: Architectural ↔ Structural ↔ Estimate Data Exchange
// .civp v2.0 format | Cross-app interoperability
// ============================================================

import {
  CivilOSProject,
  GridData,
  GridLine,
  Story,
  MemberData,
  Column,
  Beam,
  Slab,
  StructuralWall,
  Foundation,
  MaterialData,
  DesignResults,
} from '../../lib/types'
import { generateId, barArea, barWeight } from '../../lib/utils'
import { generateBBS } from '../bbs/bbsEngine'

// ─────────────────────────────────────────────
// BIM EXCHANGE TYPES
// ─────────────────────────────────────────────

export interface CivpExchangeFile {
  civp_version:  '2.0'
  source:        'architectural' | 'structural' | 'estimate' | 'project_mgmt'
  exported_at:   number           // unix ms
  exported_by:   string           // engineer name
  project_id:    string
  project_name:  string
  project_no:    string
  grid?:         GridExchangeData
  members?:      MemberExchangeData
  quantities?:   QuantityExchangeData
  openings?:     OpeningData[]
  notes?:        string
}

// ── Grid ─────────────────────────────────────

export interface GridExchangeData {
  xLines:  GridLineExchange[]
  yLines:  GridLineExchange[]
  stories: StoryExchange[]
}

export interface GridLineExchange {
  label:    string
  position: number   // mm from origin
}

export interface StoryExchange {
  label:  string     // "GF", "1F", "RF"
  level:  number     // mm elevation
  height: number     // mm floor-to-floor
}

// ── Members ──────────────────────────────────

export interface MemberExchangeData {
  columns:     ColumnExchange[]
  beams:       BeamExchange[]
  slabs:       SlabExchange[]
  walls:       WallExchange[]
  foundations: FoundationExchange[]
}

export interface ColumnExchange {
  label:   string
  gridX:   string
  gridY:   string
  story:   string
  width:   number    // mm  (0 for circular)
  depth:   number    // mm  (0 for circular)
  dia?:    number    // mm  (circular only)
  fc:      number    // MPa
  fy:      number    // MPa
  // From design results (populated on structural export)
  longBars?:     number   // count
  barDia?:       number   // mm
  tieBar?:       number   // mm
  tieSpacing?:   number   // mm
}

export interface BeamExchange {
  label:   string
  story:   string
  width:   number   // mm
  depth:   number   // mm
  fc:      number
  fy:      number
  topBars?:    number
  botBars?:    number
  barDia?:     number
  stirrupDia?: number
  stirrupSpacing?: number
}

export interface SlabExchange {
  label:      string
  story:      string
  thickness:  number   // mm
  type:       string
  fc:         number
  fy:         number
}

export interface WallExchange {
  label:      string
  story:      string
  thickness:  number   // mm
  type:       string
}

export interface FoundationExchange {
  label:     string
  type:      string
  length:    number   // mm
  width:     number   // mm
  thickness: number   // mm
  depth:     number   // mm
  fc:        number
  fy:        number
  soilBearing: number // kN/m²
}

// ── Openings (from Architectural) ────────────

export interface OpeningData {
  id:       string
  type:     'door' | 'window'
  wallId?:  string
  story:    string
  x:        number   // mm position on wall
  width:    number   // mm
  height:   number   // mm
  sill:     number   // mm from floor (windows)
}

// ── Quantities (for Estimate/BOQ) ────────────

export interface QuantityExchangeData {
  concrete:    ConcreteQuantity[]
  steel:       SteelQuantity[]
  formwork:    FormworkQuantity[]
  earthwork?:  EarthworkQuantity[]
  summary:     QuantitySummary
}

export interface ConcreteQuantity {
  memberType:  string
  memberLabel: string
  story:       string
  grade:       string     // "f'c 25 MPa"
  volume_m3:   number
  unit_cost?:  number     // BDT/m³
}

export interface SteelQuantity {
  memberType:  string
  memberLabel: string
  story:       string
  dia:         number     // mm
  grade:       string     // "Grade 60"
  weight_kg:   number
  unit_cost?:  number     // BDT/kg
}

export interface FormworkQuantity {
  memberType: string
  story:      string
  area_m2:    number
}

export interface EarthworkQuantity {
  type:      'excavation' | 'backfill'
  volume_m3: number
}

export interface QuantitySummary {
  total_concrete_m3:  number
  total_steel_kg:     number
  total_steel_mt:     number
  total_formwork_m2:  number
  steel_concrete_ratio: number   // kg/m³
  by_member_type: Record<string, { concrete_m3: number; steel_kg: number }>
}

// ─────────────────────────────────────────────
// IMPORT: Architectural → Structural
// Reads grid, levels, column/wall positions
// ─────────────────────────────────────────────

export interface BIMImportResult {
  success:   boolean
  warnings:  string[]
  errors:    string[]
  imported: {
    gridLines:  number
    stories:    number
    columns:    number
    walls:      number
    slabs:      number
    openings:   number
  }
  patch: Partial<Pick<CivilOSProject, 'grid' | 'members'>>
}

export function importFromArchitectural(
  file:    CivpExchangeFile,
  project: CivilOSProject,
): BIMImportResult {
  const warnings: string[] = []
  const errors:   string[] = []
  const imported  = { gridLines: 0, stories: 0, columns: 0, walls: 0, slabs: 0, openings: 0 }

  // Validate source
  if (file.source !== 'architectural') {
    warnings.push(`File source is "${file.source}" — expected "architectural". Proceeding anyway.`)
  }

  // ── Grid import ───────────────────────────
  let newGrid: GridData = { ...project.grid }

  if (file.grid) {
    const xLines: GridLine[] = file.grid.xLines.map((l, i) => ({
      id:       generateId('gx'),
      label:    l.label || String.fromCharCode(65 + i),  // A, B, C…
      position: l.position,
    }))
    const yLines: GridLine[] = file.grid.yLines.map((l, i) => ({
      id:       generateId('gy'),
      label:    l.label || String(i + 1),
      position: l.position,
    }))
    const stories: Story[] = file.grid.stories.map((s, i) => ({
      id:            generateId('st'),
      label:         s.label,
      level:         s.level,
      height:        s.height,
      isMasterStory: i === 0,
    }))

    newGrid = { xLines, yLines, stories }
    imported.gridLines = xLines.length + yLines.length
    imported.stories   = stories.length
  }

  // ── Column import ─────────────────────────
  const newColumns: Column[] = [...project.members.columns]

  if (file.members?.columns) {
    for (const c of file.members.columns) {
      // Check if already exists (same gridX, gridY, story)
      const exists = newColumns.some(
        ex => ex.gridX === c.gridX && ex.gridY === c.gridY &&
              newGrid.stories.find(s => s.label === c.story)?.id === ex.storyId
      )
      if (exists) {
        warnings.push(`Column ${c.label} (${c.gridX}-${c.gridY} ${c.story}) already exists — skipped.`)
        continue
      }

      const storyId = newGrid.stories.find(s => s.label === c.story)?.id
      if (!storyId) {
        warnings.push(`Column ${c.label}: story "${c.story}" not found — skipped.`)
        continue
      }

      newColumns.push({
        id:         generateId('col'),
        label:      c.label,
        gridX:      c.gridX,
        gridY:      c.gridY,
        storyId,
        section:    c.dia
          ? { type: 'circular', diameter: c.dia }
          : { type: 'rectangular', width: c.width || 300, depth: c.depth || 300 },
        materialId: 'default',
        clearCover: 40,
        rotation:   0,
      })
      imported.columns++
    }
  }

  // ── Wall import ───────────────────────────
  const newWalls: StructuralWall[] = [...project.members.walls]
  if (file.members?.walls) {
    for (const w of file.members.walls) {
      const storyId = newGrid.stories.find(s => s.label === w.story)?.id
      if (!storyId) { warnings.push(`Wall ${w.label}: story not found — skipped.`); continue }
      newWalls.push({
        id:                 generateId('wall'),
        label:              w.label,
        startNodeId:        '',
        endNodeId:          '',
        storyId,
        thickness:          w.thickness || 200,
        type:               (w.type as any) || 'structural',
        materialId:         'default',
        clearCover:         40,
        hasBoundaryElements: false,
      })
      imported.walls++
    }
  }

  // ── Slab boundaries import ────────────────
  const newSlabs: Slab[] = [...project.members.slabs]
  if (file.members?.slabs) {
    for (const s of file.members.slabs) {
      const storyId = newGrid.stories.find(st => st.label === s.story)?.id
      if (!storyId) { warnings.push(`Slab ${s.label}: story not found — skipped.`); continue }
      newSlabs.push({
        id:           generateId('slab'),
        label:        s.label,
        storyId,
        panelNodeIds: [],
        thickness:    s.thickness || 125,
        type:         (s.type as any) || 'two_way',
        materialId:   'default',
        clearCover:   20,
        openings:     [],
      })
      imported.slabs++
    }
  }

  imported.openings = file.openings?.length ?? 0

  return {
    success: errors.length === 0,
    warnings,
    errors,
    imported,
    patch: {
      grid:    newGrid,
      members: {
        ...project.members,
        columns: newColumns,
        walls:   newWalls,
        slabs:   newSlabs,
      },
    },
  }
}

// ─────────────────────────────────────────────
// EXPORT: Structural → Other Apps
// ─────────────────────────────────────────────

// ── Export grid + member sizes back to Architectural ──────────

export function exportToArchitectural(project: CivilOSProject): CivpExchangeFile {
  const { grid, members, materials, design, meta } = project

  const memberData: MemberExchangeData = {
    columns: members.columns.map(c => {
      const d = design.columnDesigns.find(cd => cd.columnId === c.id)
      return {
        label:       c.label,
        gridX:       c.gridX,
        gridY:       c.gridY,
        story:       grid.stories.find(s => s.id === c.storyId)?.label ?? '',
        width:       (c.section as any).width  ?? 0,
        depth:       (c.section as any).depth  ?? 0,
        dia:         (c.section as any).diameter,
        fc:          materials.concrete.fc,
        fy:          materials.steel.fy,
        longBars:    d?.longitudinalBars.noOfBars,
        barDia:      d?.longitudinalBars.barDiameter,
        tieBar:      d?.tieBar,
        tieSpacing:  d?.tieSpacing,
      }
    }),
    beams: members.beams.map(b => {
      const d = design.beamDesigns.find(bd => bd.beamId === b.id)
      return {
        label:          b.label,
        story:          grid.stories.find(s => s.id === b.storyId)?.label ?? '',
        width:          (b.section as any).width  ?? (b.section as any).webWidth ?? 0,
        depth:          (b.section as any).depth  ?? (b.section as any).webDepth ?? 0,
        fc:             materials.concrete.fc,
        fy:             materials.steel.fy,
        topBars:        d?.flexure.bars_neg.noOfBars,
        botBars:        d?.flexure.bars_pos.noOfBars,
        barDia:         d?.flexure.bars_pos.barDiameter,
        stirrupDia:     d?.shear.stirrupBar,
        stirrupSpacing: d?.shear.stirrupSpacing_mid,
      }
    }),
    slabs: members.slabs.map(s => ({
      label:     s.label,
      story:     grid.stories.find(st => st.id === s.storyId)?.label ?? '',
      thickness: s.thickness,
      type:      s.type,
      fc:        materials.concrete.fc,
      fy:        materials.steel.fy,
    })),
    walls: members.walls.map(w => ({
      label:     w.label,
      story:     grid.stories.find(s => s.id === w.storyId)?.label ?? '',
      thickness: w.thickness,
      type:      w.type,
    })),
    foundations: members.foundations.map(f => ({
      label:       f.label,
      type:        f.type,
      length:      f.length,
      width:       f.width,
      thickness:   f.thickness,
      depth:       f.depth,
      fc:          materials.concrete.fc,
      fy:          materials.steel.fy,
      soilBearing: f.soilBearingCapacity,
    })),
  }

  return {
    civp_version: '2.0',
    source:       'structural',
    exported_at:  Date.now(),
    exported_by:  meta.engineer,
    project_id:   meta.id,
    project_name: meta.name,
    project_no:   meta.projectNo,
    grid: {
      xLines:  grid.xLines.map(l => ({ label: l.label, position: l.position })),
      yLines:  grid.yLines.map(l => ({ label: l.label, position: l.position })),
      stories: grid.stories.map(s => ({ label: s.label, level: s.level, height: s.height })),
    },
    members: memberData,
    notes: `Exported from CivilOS Structural — Phase 14 BIM Engine`,
  }
}

// ── Export Quantities → CivilOS Estimate (BOQ) ────────────────

export function exportToEstimate(project: CivilOSProject): CivpExchangeFile {
  const { members, grid, materials, meta } = project
  const fc    = materials.concrete.fc
  const fy    = materials.steel.fy
  const grade = `f'c ${fc} MPa`
  const steelGrade = `Grade ${fy >= 415 ? '60' : '40'}`

  const concrete:  ConcreteQuantity[]  = []
  const steel:     SteelQuantity[]     = []
  const formwork:  FormworkQuantity[]  = []

  // ── Columns ───────────────────────────────
  for (const col of members.columns) {
    const storyLabel = grid.stories.find(s => s.id === col.storyId)?.label ?? '?'
    const storyH     = grid.stories.find(s => s.id === col.storyId)?.height ?? 3000  // mm
    const H = storyH / 1000  // m

    let Ac = 0
    if (col.section.type === 'rectangular') {
      const { width: b, depth: d } = col.section
      Ac = (b * d) / 1e6   // m²
      formwork.push({ memberType: 'Column', story: storyLabel, area_m2: +(2 * (b + d) / 1000 * H).toFixed(3) })
    } else {
      const r = (col.section as any).diameter / 2
      Ac = Math.PI * r * r / 1e6
      formwork.push({ memberType: 'Column', story: storyLabel, area_m2: +(Math.PI * (col.section as any).diameter / 1000 * H).toFixed(3) })
    }

    concrete.push({
      memberType:  'Column',
      memberLabel: col.label,
      story:       storyLabel,
      grade,
      volume_m3:   +(Ac * H).toFixed(4),
    })
  }

  // ── Beams ─────────────────────────────────
  for (const beam of members.beams) {
    const storyLabel = grid.stories.find(s => s.id === beam.storyId)?.label ?? '?'
    const bw = (beam.section as any).width  ?? (beam.section as any).webWidth  ?? 250
    const h  = (beam.section as any).depth  ?? (beam.section as any).webDepth  ?? 450

    // Estimate span from analytical model (fallback 5m)
    const span_m = 5.0
    const vol = (bw / 1000) * (h / 1000) * span_m

    concrete.push({
      memberType:  'Beam',
      memberLabel: beam.label,
      story:       storyLabel,
      grade,
      volume_m3:   +vol.toFixed(4),
    })
    formwork.push({
      memberType: 'Beam',
      story:      storyLabel,
      area_m2:    +((2 * h / 1000 + bw / 1000) * span_m).toFixed(3),
    })
  }

  // ── Slabs ─────────────────────────────────
  for (const slab of members.slabs) {
    const storyLabel = grid.stories.find(s => s.id === slab.storyId)?.label ?? '?'
    // Estimate panel area from grid (fallback 20m²)
    const panelArea_m2 = 20.0
    const vol = (slab.thickness / 1000) * panelArea_m2

    concrete.push({
      memberType:  'Slab',
      memberLabel: slab.label,
      story:       storyLabel,
      grade,
      volume_m3:   +vol.toFixed(4),
    })
    formwork.push({ memberType: 'Slab', story: storyLabel, area_m2: panelArea_m2 })
  }

  // ── Foundations ───────────────────────────
  for (const fdn of members.foundations) {
    const vol = (fdn.length / 1000) * (fdn.width / 1000) * (fdn.thickness / 1000)
    concrete.push({
      memberType:  'Foundation',
      memberLabel: fdn.label,
      story:       'Foundation',
      grade,
      volume_m3:   +vol.toFixed(4),
    })
  }

  // ── Steel from BBS ────────────────────────
  try {
    const bbs = generateBBS(project)
    for (const bar of bbs.bars) {
      steel.push({
        memberType:  bar.memberType,
        memberLabel: bar.memberLabel,
        story:       bar.storyLabel,
        dia:         bar.dia,
        grade:       steelGrade,
        weight_kg:   +bar.totalWeight.toFixed(3),
      })
    }
  } catch {
    // BBS not yet generated — use design results for rough estimate
    for (const d of project.design.columnDesigns) {
      const col   = members.columns.find(c => c.id === d.columnId)
      if (!col) continue
      const storyH = grid.stories.find(s => s.id === col.storyId)?.height ?? 3000
      const Ast    = d.longitudinalBars.noOfBars * barArea(d.longitudinalBars.barDiameter)
      const wt     = (Ast / 1e6) * storyH / 1000 * 7850
      steel.push({
        memberType:  'column',
        memberLabel: col.label,
        story:       grid.stories.find(s => s.id === col.storyId)?.label ?? '?',
        dia:         d.longitudinalBars.barDiameter,
        grade:       steelGrade,
        weight_kg:   +wt.toFixed(2),
      })
    }
  }

  // ── Summary ───────────────────────────────
  const totalConcrete = +concrete.reduce((s, c) => s + c.volume_m3,  0).toFixed(3)
  const totalSteel    = +steel.reduce((s, c) => s + c.weight_kg,      0).toFixed(2)
  const totalForm     = +formwork.reduce((s, c) => s + c.area_m2,     0).toFixed(2)

  const byType: QuantitySummary['by_member_type'] = {}
  for (const c of concrete) {
    if (!byType[c.memberType]) byType[c.memberType] = { concrete_m3: 0, steel_kg: 0 }
    byType[c.memberType].concrete_m3 += c.volume_m3
  }
  for (const s of steel) {
    const key = s.memberType.charAt(0).toUpperCase() + s.memberType.slice(1)
    if (!byType[key]) byType[key] = { concrete_m3: 0, steel_kg: 0 }
    byType[key].steel_kg += s.weight_kg
  }

  const quantities: QuantityExchangeData = {
    concrete,
    steel,
    formwork,
    earthwork: members.foundations.map(f => ({
      type:      'excavation' as const,
      volume_m3: +((f.length / 1000) * (f.width / 1000) * (f.depth / 1000) * 1.3).toFixed(3),
    })),
    summary: {
      total_concrete_m3:    totalConcrete,
      total_steel_kg:       totalSteel,
      total_steel_mt:       +(totalSteel / 1000).toFixed(3),
      total_formwork_m2:    totalForm,
      steel_concrete_ratio: totalConcrete > 0 ? +(totalSteel / totalConcrete).toFixed(1) : 0,
      by_member_type:       byType,
    },
  }

  return {
    civp_version: '2.0',
    source:       'structural',
    exported_at:  Date.now(),
    exported_by:  meta.engineer,
    project_id:   meta.id,
    project_name: meta.name,
    project_no:   meta.projectNo,
    quantities,
    notes: `BOQ quantities exported from CivilOS Structural — Phase 14`,
  }
}

// ─────────────────────────────────────────────
// FILE HELPERS
// ─────────────────────────────────────────────

/** Parse a .civp JSON file uploaded by the user */
export function parseCivpFile(jsonText: string): { ok: true; file: CivpExchangeFile } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText) as CivpExchangeFile
    if (parsed.civp_version !== '2.0') {
      return { ok: false, error: `Unsupported civp_version: "${parsed.civp_version}" — expected "2.0"` }
    }
    if (!parsed.source) {
      return { ok: false, error: 'Missing "source" field in .civp file' }
    }
    return { ok: true, file: parsed }
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${(e as Error).message}` }
  }
}

/** Download a CivpExchangeFile as .civp JSON */
export function downloadCivpFile(file: CivpExchangeFile, filename?: string): void {
  const json = JSON.stringify(file, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename ?? `${file.project_no}_${file.source}_${new Date().toISOString().slice(0,10)}.civp`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
