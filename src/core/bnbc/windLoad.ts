// ============================================================
// CivilOS Structural — BNBC 2020 Wind Load Calculator
// Phase 5: Lateral Load Generation
// Reference: Bangladesh National Building Code 2020
//            Chapter 2, Part 6 — Wind Load
// ============================================================

import { CivilOSProject, Story } from '../../lib/types'

// ── BNBC 2020 Wind Pressure Coefficients ─────────────────────

/** Velocity pressure exposure coefficient Kz (BNBC 2020 Table 6.2.9) */
export function getKz(
  height: number,        // m above ground
  exposure: 'B' | 'C' | 'D'
): number {
  // Kz = 2.01 * (z/zg)^(2/α)
  const params: Record<string, { alpha: number; zg: number }> = {
    B: { alpha: 7.0,  zg: 365.76 },
    C: { alpha: 9.5,  zg: 274.32 },
    D: { alpha: 11.5, zg: 213.36 },
  }
  const { alpha, zg } = params[exposure]
  const z = Math.max(height, 4.57)  // min 15 ft = 4.57m
  const Kz = 2.01 * Math.pow(z / zg, 2 / alpha)
  return Math.max(Kz, 0.70)
}

/** Topographic factor Kzt (simplified — flat terrain = 1.0) */
export function getKzt(topographic: number): number {
  return topographic
}

/** Gust factor G (BNBC 2020 — rigid structure) */
export function getG(rigid = true): number {
  return rigid ? 0.85 : 0.85  // simplified; dynamic buildings use G_f
}

/** Velocity pressure qz (kN/m²) */
export function getVelocityPressure(
  Kz: number,
  Kzt: number,
  G: number,
  V: number,   // km/h basic wind speed
  Iw: number   // importance factor
): number {
  // qz = 0.000613 * Kz * Kzt * V² * Iw  (kN/m²) — BNBC formula
  const V_ms = V / 3.6  // km/h → m/s
  return 0.000613 * Kz * Kzt * Math.pow(V_ms, 2) * Iw
}

/** External pressure coefficient Cp for windward/leeward walls */
export function getCp(
  Lx: number, Ly: number, H: number,
  direction: 'windward' | 'leeward' | 'sidewall'
): number {
  const L = direction === 'windward' ? Lx : Ly
  const ratio = H / L
  switch (direction) {
    case 'windward':
      return ratio >= 0.5 ? 0.8 : ratio >= 0.25 ? 0.7 : 0.7
    case 'leeward':
      if (ratio >= 1.0) return -0.5
      if (ratio >= 0.5) return -0.4
      return -0.3
    case 'sidewall':
      return -0.7
  }
}

// ── Story-level Wind Force Calculation ───────────────────────

export interface WindStoryForce {
  storyId:  string
  storyLabel: string
  height:   number    // m (mid-story elevation)
  Kz:       number
  qz:       number    // kN/m²
  Fx:       number    // kN (X-direction force)
  Fy:       number    // kN (Y-direction force)
  area_x:   number    // m² (tributary area in X)
  area_y:   number    // m² (tributary area in Y)
}

export interface WindLoadResult {
  basicWindSpeed:    number   // km/h
  exposureCategory:  string
  importanceFactor:  number
  stories:           WindStoryForce[]
  totalFx:           number   // kN
  totalFy:           number   // kN
  baseShearX:        number   // kN
  baseShearY:        number   // kN
}

export function calculateWindLoad(project: CivilOSProject): WindLoadResult {
  const { loads, grid } = project
  const wl = loads.windLoad

  // Building dimensions (m)
  const xLines = grid.xLines
  const yLines = grid.yLines
  const Lx = xLines.length >= 2
    ? (xLines.at(-1)!.position - xLines[0].position) / 1000
    : 10  // m
  const Ly = yLines.length >= 2
    ? (yLines.at(-1)!.position - yLines[0].position) / 1000
    : 8   // m

  const G   = getG(true)
  const Kzt = getKzt(wl.topographicFactor)
  const Iw  = wl.importanceFactor

  const storyForces: WindStoryForce[] = []
  const stories = grid.stories

  for (let i = 0; i < stories.length; i++) {
    const story     = stories[i]
    const elevation = (story.level + story.height) / 1000  // top of story in m
    const midHeight = (story.level + story.height / 2) / 1000

    const Kz = getKz(elevation, wl.exposureCategory as 'B' | 'C' | 'D')
    const qz = getVelocityPressure(Kz, Kzt, G, wl.basicWindSpeed, Iw)

    // Tributary height (half above + half below)
    const hBelow = i === 0 ? story.height / 2 : (story.height + stories[i-1].height) / 2
    const hAbove = i === stories.length - 1 ? story.height / 2 : story.height / 2
    const tribH  = (hBelow + hAbove) / 1000  // m

    // Total building height
    const H = stories.reduce((sum, s) => sum + s.height, 0) / 1000  // m

    // Pressure coefficients
    const CpW_x = getCp(Lx, Ly, H, 'windward')
    const CpL_x = getCp(Lx, Ly, H, 'leeward')
    const CpW_y = getCp(Ly, Lx, H, 'windward')
    const CpL_y = getCp(Ly, Lx, H, 'leeward')

    // Tributary areas (m²)
    const area_x = Ly * tribH  // face perpendicular to X-wind
    const area_y = Lx * tribH  // face perpendicular to Y-wind

    // Net pressure = qz * G * (Cp_windward - Cp_leeward)
    const p_x = qz * G * (CpW_x - CpL_x)  // kN/m²
    const p_y = qz * G * (CpW_y - CpL_y)  // kN/m²

    const Fx = p_x * area_x  // kN
    const Fy = p_y * area_y  // kN

    storyForces.push({
      storyId:    story.id,
      storyLabel: story.label,
      height:     midHeight,
      Kz, qz,
      Fx: +Fx.toFixed(3),
      Fy: +Fy.toFixed(3),
      area_x: +area_x.toFixed(2),
      area_y: +area_y.toFixed(2),
    })
  }

  const totalFx = storyForces.reduce((s, f) => s + f.Fx, 0)
  const totalFy = storyForces.reduce((s, f) => s + f.Fy, 0)

  return {
    basicWindSpeed:   wl.basicWindSpeed,
    exposureCategory: wl.exposureCategory,
    importanceFactor: Iw,
    stories:          storyForces,
    totalFx:          +totalFx.toFixed(2),
    totalFy:          +totalFy.toFixed(2),
    baseShearX:       +totalFx.toFixed(2),
    baseShearY:       +totalFy.toFixed(2),
  }
}
