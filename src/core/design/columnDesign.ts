// ============================================================
// CivilOS Structural — Column Design Engine
// Phase 6.3: ACI 318-19 Column Design
// Axial+Uniaxial §22.4, Biaxial Bresler §22.4.4,
// P-M Interaction Diagram, Slenderness §6.6.4
// ============================================================

import { Column, ColumnDesign, PMPoint, RebarLayout } from '../../lib/types'
import { barArea, STANDARD_BAR_DIAMETERS } from '../../lib/utils'

export interface ColumnDesignInput {
  column:      Column
  Pu:          number   // kN — factored axial load
  Mux:         number   // kN·m — factored moment about X
  Muy:         number   // kN·m — factored moment about Y
  lu:          number   // mm — unsupported length
  fc:          number   // MPa
  fy:          number   // MPa
  seismicZone: 1|2|3
}

export interface ColumnDesignOutput extends ColumnDesign {
  warnings: string[]
  checks:   { name: string; passed: boolean; value: number; limit: number; unit: string }[]
  Pn_max:   number
  phiPn0:   number
}

// φ factors (ACI 318-19 Table 21.2.2)
const PHI_COMP = 0.65   // tied column
const PHI_TENS = 0.90   // tension-controlled

// ── Slenderness Check (ACI 318-19 §6.6.4) ────────────────────

function checkSlenderness(input: ColumnDesignInput): {
  isSlender: boolean; klu_r: number; limit: number
} {
  const { column, lu } = input
  let r = 0  // radius of gyration

  if (column.section.type === 'rectangular') {
    const { width: b, depth: h } = column.section
    r = 0.3 * Math.min(b, h)  // ACI 6.6.4.5 approx
  } else {
    r = 0.25 * (column.section as any).diameter
  }

  const k     = 1.0   // conservative (braced frame)
  const klu_r = k * lu / r

  // Limit: 34 - 12*(M1/M2) for braced frames (ACI 6.6.4.5.1)
  // Simplified: 34 (assume equal end moments)
  const limit = 34

  return { isSlender: klu_r > limit, klu_r: +klu_r.toFixed(1), limit }
}

// ── P-M Interaction Diagram ───────────────────────────────────
//
// Generates points from pure compression (P0) to pure tension
// using strain compatibility for rectangular section

export function generatePMDiagram(
  b: number,    // mm
  h: number,    // mm
  Ag: number,   // mm²
  Ast: number,  // mm² — total steel area
  fc: number,   // MPa
  fy: number,   // MPa
  cc: number,   // mm — cover
  nBars: number,
  barDia: number
): PMPoint[] {
  const points: PMPoint[] = []
  const Es    = 200000   // MPa
  const beta1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05*(fc-28)/7)
  const d     = h - cc - 10 - barDia / 2   // effective depth (mm)
  const d2    = cc + 10 + barDia / 2        // compression steel depth

  // Steel per row (simplified: half top, half bottom)
  const As1  = Ast / 2   // tension side
  const As2  = Ast / 2   // compression side

  // Max compression (pure axial) — ACI 22.4.2.1
  const Pn0   = 0.85 * fc * (Ag - Ast) + fy * Ast
  const phiPn0 = PHI_COMP * 0.80 * Pn0   // 0.80 factor for tied column
  points.push({ phi_Pn: +phiPn0.toFixed(1), phi_Mn: 0 })

  // Sweep c from 0.01·d to 5·h
  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const c = 0.001 * d + (i / steps) * (5 * h - 0.001 * d)

    // Strain in steel
    const eps_cu  = 0.003
    const eps_s1  = eps_cu * (d - c) / c    // tension steel
    const eps_s2  = eps_cu * (c - d2) / c   // comp steel

    const fs1 = Math.max(Math.min(eps_s1 * Es, fy), -fy)   // tension (may be –)
    const fs2 = Math.max(Math.min(eps_s2 * Es, fy), -fy)   // compression

    const a    = Math.min(beta1 * c, h)
    const Cc   = 0.85 * fc * a * b                          // concrete comp force
    const Cs   = As2 * (fs2 - 0.85 * fc)                   // comp steel
    const T    = As1 * fs1                                   // tension steel

    const Pn   = Cc + Cs - T

    // Moment about centroid
    const Mn   = Cc * (h/2 - a/2) + Cs * (h/2 - d2) + Math.abs(T) * (d - h/2)

    // φ — ACI 21.2.2: interpolate based on tension strain
    const eps_t = eps_cu * (d - c) / c
    let phi: number
    if (eps_t >= 0.005)        phi = PHI_TENS
    else if (eps_t <= 0.002)   phi = PHI_COMP
    else phi = PHI_COMP + (PHI_TENS - PHI_COMP) * (eps_t - 0.002) / 0.003

    if (Pn >= -0.1 * Ag * fc) {  // ignore extreme tension
      points.push({
        phi_Pn: +(phi * Pn / 1000).toFixed(2),    // kN
        phi_Mn: +(phi * Mn / 1e6).toFixed(2),     // kN·m
      })
    }
  }

  // Pure tension
  const phi_Pt = -(PHI_TENS * fy * Ast / 1000)
  points.push({ phi_Pn: +phi_Pt.toFixed(1), phi_Mn: 0 })

  return points
}

// ── Check if (Pu, Mu) inside P-M diagram ─────────────────────

function isInsidePMDiagram(
  Pu: number,   // kN
  Mu: number,   // kN·m
  diagram: PMPoint[]
): boolean {
  if (diagram.length < 3) return false

  // Simple check: find envelope
  // For each Pu, find max φMn from diagram
  const above = diagram.filter(p => p.phi_Pn >= Pu)
  const below = diagram.filter(p => p.phi_Pn < Pu)

  if (above.length === 0 || below.length === 0) {
    return Pu <= Math.max(...diagram.map(p => p.phi_Pn)) && Pu >= Math.min(...diagram.map(p => p.phi_Pn))
  }

  const p1 = above.reduce((a, b) => (a.phi_Pn < b.phi_Pn ? a : b))
  const p2 = below.reduce((a, b) => (a.phi_Pn > b.phi_Pn ? a : b))

  if (p1.phi_Pn === p2.phi_Pn) return Mu <= p1.phi_Mn

  const t   = (Pu - p2.phi_Pn) / (p1.phi_Pn - p2.phi_Pn)
  const Mn_interp = p2.phi_Mn + t * (p1.phi_Mn - p2.phi_Mn)

  return Mu <= Mn_interp
}

// ── Bresler Method (Biaxial bending) ─────────────────────────
//
// 1/φPn_biaxial = 1/φPnx + 1/φPny - 1/φPn0

function checkBiaxial(
  Pu: number,   // kN
  Mux: number,
  Muy: number,
  phiPnx: number,   // kN — uniaxial capacity about X
  phiPny: number,   // kN — uniaxial capacity about Y
  phiPn0: number    // kN — pure axial
): boolean {
  if (phiPnx <= 0 || phiPny <= 0 || phiPn0 <= 0) return false
  const inv = 1 / phiPnx + 1 / phiPny - 1 / phiPn0
  if (inv <= 0) return true
  return Pu <= 1 / inv
}

// ── Longitudinal Bar Selection ────────────────────────────────

function selectLongitudinalBars(
  Ag: number,
  fc: number,
  fy: number,
  bw: number,
  h: number,
  cc: number
): { rebar: RebarLayout; Ast: number } {
  // ρ_g = 0.01 to 0.08 (ACI 10.6.1.1)
  // Start with ρ = 0.02 (2% → practical starting point)
  const rho_target = 0.02
  const As_target  = rho_target * Ag

  for (const dia of [...STANDARD_BAR_DIAMETERS]) {
    const n = Math.ceil(As_target / barArea(dia))
    const nActual = Math.max(n, 4)  // min 4 bars ACI 10.7.3.1

    // Check fit in perimeter
    const perimeter = 2 * (bw + h) - 4 * (cc + 10 + dia / 2)
    const clearSpacing = (perimeter - nActual * dia) / nActual

    if (clearSpacing >= Math.max(1.5 * dia, 40)) {
      const Ast = nActual * barArea(dia)
      return {
        rebar: {
          barDiameter:  dia,
          noOfBars:     nActual,
          layers:       1,
          clearSpacing: +clearSpacing.toFixed(1),
        },
        Ast,
      }
    }
  }

  // Fallback
  const Ast = 4 * barArea(20)
  return { rebar: { barDiameter: 20, noOfBars: 4, layers: 1, clearSpacing: 60 }, Ast }
}

// ── Tie Bar Spacing ───────────────────────────────────────────

function tieSpacing(barDia: number, colDim: number, seismicZone: 1|2|3): {
  tieBar: number; tieSpacing: number
} {
  const tieDia = barDia >= 32 ? 12 : 10

  // ACI 25.7.2.1: s ≤ min(16·main bar dia, 48·tie dia, least col dim)
  let s = Math.min(16 * barDia, 48 * tieDia, colDim)

  // Seismic: ACI 18.7.5.3 — closer spacing in confinement zones
  if (seismicZone >= 2) {
    s = Math.min(s, barDia * 6, 150)
  }

  return {
    tieBar:     tieDia,
    tieSpacing: Math.floor(s / 25) * 25,  // round to 25mm
  }
}

// ── Main Design Function ──────────────────────────────────────

export function designColumn(input: ColumnDesignInput): ColumnDesignOutput {
  const warnings: string[] = []
  const { column, Pu, Mux, Muy, fc, fy, seismicZone } = input

  // Section geometry
  let Ag = 0, bw = 0, h = 0, colDim = 0
  if (column.section.type === 'rectangular') {
    bw = column.section.width
    h  = column.section.depth
    Ag = bw * h
    colDim = Math.min(bw, h)
  } else {
    const d = (column.section as any).diameter
    Ag  = Math.PI * d * d / 4
    bw  = d
    h   = d
    colDim = d
  }

  const cc = column.clearCover

  // Slenderness
  const slender = checkSlenderness(input)
  if (slender.isSlender) {
    warnings.push(`Slender column: klu/r = ${slender.klu_r} > ${slender.limit} — moment magnification needed (Phase 7)`)
  }

  // Longitudinal bars
  const { rebar, Ast } = selectLongitudinalBars(Ag, fc, fy, bw, h, cc)

  // ρ_g check
  const rho_g = Ast / Ag
  if (rho_g < 0.01) warnings.push(`ρ_g = ${(rho_g*100).toFixed(2)}% < 1% — increase steel`)
  if (rho_g > 0.08) warnings.push(`ρ_g = ${(rho_g*100).toFixed(2)}% > 8% — reduce steel or increase section`)

  // P-M Diagram
  const pmDiagram = generatePMDiagram(bw, h, Ag, Ast, fc, fy, cc, rebar.noOfBars, rebar.barDiameter)

  // Max axial capacity
  const Pn0   = 0.85 * fc * (Ag - Ast) + fy * Ast
  const phiPn0 = PHI_COMP * 0.80 * Pn0 / 1000  // kN

  // Capacity check
  const inside = isInsidePMDiagram(Pu, Math.sqrt(Mux**2 + Muy**2), pmDiagram)
  if (!inside) warnings.push('(Pu, Mu) — P-M curve-এর বাইরে! Section বাড়ান।')

  // Tie design
  const ties = tieSpacing(rebar.barDiameter, colDim, seismicZone)

  // Min Pu check: φPn_max ≥ Pu
  const puOk = Pu <= phiPn0

  const checks = [
    { name: 'φPn_max ≥ Pu',    passed: puOk,    value: phiPn0,     limit: Pu,     unit: 'kN' },
    { name: 'P-M Interaction', passed: inside,   value: Pu,         limit: phiPn0, unit: 'kN' },
    { name: 'ρ_min = 1%',      passed: rho_g >= 0.01, value: rho_g*100, limit: 1.0, unit: '%' },
    { name: 'ρ_max = 8%',      passed: rho_g <= 0.08, value: rho_g*100, limit: 8.0, unit: '%' },
    { name: 'Slenderness',     passed: !slender.isSlender, value: slender.klu_r, limit: slender.limit, unit: '' },
  ]

  const status = checks.every(c => c.passed) && warnings.every(w => !w.includes('curve-এর বাইরে'))
    ? 'ok' : 'fail'

  return {
    columnId:         column.id,
    status:           status as 'ok' | 'fail',
    isSlender:        slender.isSlender,
    Pu:               +Pu.toFixed(2),
    Mux:              +Mux.toFixed(2),
    Muy:              +Muy.toFixed(2),
    longitudinalBars: rebar,
    tieBar:           ties.tieBar,
    tieSpacing:       ties.tieSpacing,
    pmDiagram,
    warnings,
    checks,
    Pn_max:           +(Pn0 / 1000).toFixed(2),
    phiPn0:           +phiPn0.toFixed(2),
  }
}
