// ============================================================
// CivilOS Structural — BNBC 2020 Seismic Load Calculator
// Phase 5: Equivalent Lateral Force (ELF) Method
// Reference: BNBC 2020, Part 6, Chapter 2 — Seismic Design
// ============================================================

import { CivilOSProject } from '../../lib/types'

// ── BNBC 2020 Seismic Parameters ─────────────────────────────

/** Zone factor Z per BNBC 2020 Table 6.2.23 */
export const ZONE_FACTORS: Record<number, number> = {
  1: 0.12,
  2: 0.20,
  3: 0.28,
}

/** Site coefficient Ca (short period) — BNBC 2020 Table 6.2.26 */
const CA_TABLE: Record<string, Record<number, number>> = {
  SA: { 1: 0.09, 2: 0.15, 3: 0.21 },
  SB: { 1: 0.12, 2: 0.20, 3: 0.28 },
  SC: { 1: 0.16, 2: 0.24, 3: 0.33 },
  SD: { 1: 0.20, 2: 0.28, 3: 0.36 },
  SE: { 1: 0.24, 2: 0.34, 3: 0.36 },
}

/** Site coefficient Cv (1-sec period) — BNBC 2020 Table 6.2.27 */
const CV_TABLE: Record<string, Record<number, number>> = {
  SA: { 1: 0.12, 2: 0.20, 3: 0.28 },
  SB: { 1: 0.16, 2: 0.27, 3: 0.38 },
  SC: { 1: 0.24, 2: 0.36, 3: 0.45 },
  SD: { 1: 0.32, 2: 0.45, 3: 0.54 },
  SE: { 1: 0.40, 2: 0.64, 3: 0.84 },
}

export function getCa(zone: 1|2|3, siteClass: string): number {
  return CA_TABLE[siteClass]?.[zone] ?? 0.28
}

export function getCv(zone: 1|2|3, siteClass: string): number {
  return CV_TABLE[siteClass]?.[zone] ?? 0.45
}

// ── Structural Type Coefficient ───────────────────────────────

/** Ct per BNBC 2020 for period calculation T = Ct * hn^(3/4) */
export const CT_VALUES: Record<string, number> = {
  rcc_frame:    0.0731,
  dual_system:  0.0731,
  shear_wall:   0.0488,
  steel_frame:  0.0853,
  load_bearing: 0.0488,
}

/** Response Modification Factor R — BNBC 2020 Table 6.2.21 */
export const R_VALUES: Record<string, number> = {
  rcc_frame:    8.0,
  dual_system:  8.5,
  shear_wall:   6.0,
  steel_frame:  8.0,
  load_bearing: 1.5,
}

// ── Building Period Calculation ───────────────────────────────

export interface PeriodResult {
  Ta:   number  // approximate period (s)
  Ct:   number
  hn:   number  // building height (m)
  T_upper: number  // upper bound Ta = Cu * Ta
  Cu:   number  // coefficient for upper bound
}

export function calculateBuildingPeriod(
  project: CivilOSProject
): PeriodResult {
  const { grid, meta } = project
  const hn = grid.stories.reduce((sum, s) => sum + s.height, 0) / 1000  // m

  const Ct = CT_VALUES[meta.structuralSystem] ?? 0.0731
  const Ta = Ct * Math.pow(hn, 0.75)

  // Upper bound Cu — BNBC 2020 Table 6.2.24
  const zone = project.loads.seismicLoad.seismicZone
  const Cv   = getCv(zone, project.loads.seismicLoad.siteClass)
  const Cu   = Cv >= 0.4 ? 1.2 : Cv >= 0.3 ? 1.3 : Cv >= 0.2 ? 1.4 : 1.5

  return {
    Ta:      +Ta.toFixed(4),
    Ct,
    hn:      +hn.toFixed(2),
    T_upper: +(Ta * Cu).toFixed(4),
    Cu,
  }
}

// ── Design Base Shear ─────────────────────────────────────────

export interface BaseShearResult {
  V:      number   // kN — design base shear
  V_min:  number   // kN — minimum base shear
  V_max:  number   // kN — maximum base shear
  V_used: number   // kN — governing
  Cv:     number
  Ca:     number
  R:      number
  I:      number
  T:      number   // s
  W:      number   // kN — seismic weight
  Cs:     number   // seismic response coefficient
  formula: string
}

export function calculateBaseShear(
  project: CivilOSProject,
  seismicWeight: number  // kN
): BaseShearResult {
  const sl = project.loads.seismicLoad
  const zone = sl.seismicZone as 1|2|3

  const Ca = getCa(zone, sl.siteClass)
  const Cv = getCv(zone, sl.siteClass)
  const R  = sl.responseModificationFactor
  const I  = sl.importanceFactor
  const T  = calculateBuildingPeriod(project).Ta
  const W  = seismicWeight

  // Base shear: V = (Cv * I * W) / (R * T)  — BNBC 2020 Eq. 6.2.69
  const V = (Cv * I * W) / (R * T)

  // Maximum: V_max = 2.5 * Ca * I * W / R
  const V_max = (2.5 * Ca * I * W) / R

  // Minimum: V_min = 0.11 * Ca * I * W
  const V_min = 0.11 * Ca * I * W

  // Zone 3 minimum: V_min3 = 0.8 * Z * Nv * I * W / R
  const V_min3 = zone === 3
    ? (0.8 * ZONE_FACTORS[zone] * 1.0 * I * W) / R
    : 0

  const V_used = Math.min(Math.max(V, V_min, V_min3), V_max)
  const Cs     = V_used / W

  return {
    V:      +V.toFixed(2),
    V_min:  +Math.max(V_min, V_min3).toFixed(2),
    V_max:  +V_max.toFixed(2),
    V_used: +V_used.toFixed(2),
    Cv, Ca, R, I,
    T:      +(T).toFixed(4),
    W:      +W.toFixed(2),
    Cs:     +Cs.toFixed(4),
    formula: `V = Cv·I·W / (R·T) = ${Cv}×${I}×${W.toFixed(0)} / (${R}×${T.toFixed(3)})`,
  }
}

// ── Vertical Distribution of Base Shear ──────────────────────

export interface SeismicStoryForce {
  storyId:    string
  storyLabel: string
  height:     number   // m from base (top of story)
  Wx:         number   // kN — story weight
  hx:         number   // m
  Wx_hx:      number   // kN·m
  Cvx:        number   // distribution factor
  Fx:         number   // kN — story lateral force (X)
  Fy:         number   // kN — story lateral force (Y)
  Mx_accum:   number   // kN — accumulated shear from top
}

export interface SeismicLoadResult {
  baseShear:   BaseShearResult
  period:      PeriodResult
  stories:     SeismicStoryForce[]
  totalWeight: number   // kN
  Vx_base:     number   // kN — base shear X
  Vy_base:     number   // kN — base shear Y
  Ft:          number   // kN — top force (T > 0.7s)
}

export function calculateSeismicLoad(project: CivilOSProject): SeismicLoadResult {
  const { grid, members, materials, loads } = project

  // ── Seismic weight per story ─────────────────────────────────
  // W = DL + fraction of LL (BNBC: 25% for storage, 0% for others)
  const storyWeights: Record<string, number> = {}
  let totalWeight = 0

  for (const story of grid.stories) {
    const DL_SDL  = loads.deadLoad.superimposedDL   // kN/m²
    const wallLoad = loads.deadLoad.wallLoad ?? 10  // kN/m (per beam)

    // Floor area (m²)
    const Lx = grid.xLines.length >= 2
      ? (grid.xLines.at(-1)!.position - grid.xLines[0].position) / 1000 : 10
    const Ly = grid.yLines.length >= 2
      ? (grid.yLines.at(-1)!.position - grid.yLines[0].position) / 1000 : 8
    const floorArea = Lx * Ly

    // Column self-weight in this story
    const storyCols = members.columns.filter(c => c.storyId === story.id)
    const colWeight = storyCols.reduce((sum, col) => {
      let area = 0
      if (col.section.type === 'rectangular') {
        area = (col.section.width / 1000) * (col.section.depth / 1000)
      } else {
        area = Math.PI * Math.pow(col.section.diameter / 2000, 2)
      }
      return sum + materials.concrete.unitWeight * area * (story.height / 1000)
    }, 0)

    // Beam self-weight in this story
    const storyBeams = members.beams.filter(b => b.storyId === story.id)
    const beamWeight = storyBeams.reduce((sum, beam) => {
      const bw = (beam.section as any).width  ?? 250
      const bh = (beam.section as any).depth  ?? 450
      const bArea = (bw / 1000) * (bh / 1000)

      // Beam length from node ids
      const sp = parseNodeId(beam.startNodeId)
      const ep = parseNodeId(beam.endNodeId)
      if (!sp || !ep) return sum
      const xS = grid.xLines.find(l => l.id === sp.gridX)?.position ?? 0
      const yS = grid.yLines.find(l => l.id === sp.gridY)?.position ?? 0
      const xE = grid.xLines.find(l => l.id === ep.gridX)?.position ?? 0
      const yE = grid.yLines.find(l => l.id === ep.gridY)?.position ?? 0
      const L  = Math.sqrt((xE-xS)**2 + (yE-yS)**2) / 1000  // m

      return sum + materials.concrete.unitWeight * bArea * L
    }, 0)

    // Slab weight (150mm default if no slab modeled)
    const slabThick = 0.150  // m
    const slabWeight = materials.concrete.unitWeight * slabThick * floorArea

    // Total story weight
    const Wx = slabWeight + DL_SDL * floorArea + wallLoad * storyBeams.length * 5 +
               colWeight + beamWeight

    storyWeights[story.id] = Wx
    totalWeight += Wx
  }

  // ── Period & Base Shear ──────────────────────────────────────
  const period    = calculateBuildingPeriod(project)
  const baseShear = calculateBaseShear(project, totalWeight)
  const V         = baseShear.V_used

  // Top force Ft (BNBC: if T > 0.7s)
  const Ft = period.Ta > 0.7 ? Math.min(0.07 * period.Ta * V, 0.25 * V) : 0
  const V_reduced = V - Ft

  // ── Vertical distribution: Cvx = Wx*hx / Σ(Wi*hi) ──────────
  const stories = grid.stories
  const sumWxHx = stories.reduce((sum, s) => {
    const hx = (s.level + s.height) / 1000  // m from base (top of story)
    const Wx = storyWeights[s.id] ?? 0
    return sum + Wx * hx
  }, 0)

  const storyForces: SeismicStoryForce[] = []
  let accShear = Ft  // accumulated from top (start with Ft)

  const reversedStories = [...stories].reverse()

  for (const story of reversedStories) {
    const hx    = (story.level + story.height) / 1000  // m
    const Wx    = storyWeights[story.id] ?? 0
    const Wx_hx = Wx * hx
    const Cvx   = sumWxHx > 0 ? Wx_hx / sumWxHx : 0
    const Fx    = V_reduced * Cvx + (story === reversedStories[0] ? Ft : 0)

    accShear += Fx

    storyForces.push({
      storyId:    story.id,
      storyLabel: story.label,
      height:     +hx.toFixed(2),
      Wx:         +Wx.toFixed(2),
      hx:         +hx.toFixed(2),
      Wx_hx:      +Wx_hx.toFixed(1),
      Cvx:        +Cvx.toFixed(4),
      Fx:         +Fx.toFixed(2),
      Fy:         +Fx.toFixed(2),   // symmetric assumption for now
      Mx_accum:   +accShear.toFixed(2),
    })
  }

  // Reverse back to bottom-to-top order
  storyForces.reverse()

  return {
    baseShear,
    period,
    stories:     storyForces,
    totalWeight: +totalWeight.toFixed(2),
    Vx_base:     +V.toFixed(2),
    Vy_base:     +V.toFixed(2),
    Ft:          +Ft.toFixed(2),
  }
}

// ── Helpers ───────────────────────────────────────────────────

function parseNodeId(nodeId: string): { gridX: string; gridY: string } | null {
  const parts = nodeId.split('_')
  if (nodeId.startsWith('node_') && parts.length >= 3)
    return { gridX: parts[1], gridY: parts[2] }
  if (nodeId.startsWith('N_') && parts.length >= 4)
    return { gridX: parts[1], gridY: parts[2] }
  return null
}
