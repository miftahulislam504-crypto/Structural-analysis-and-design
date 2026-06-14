// ============================================================
// CivilOS Structural — Footing Design Engine
// Phase 6.4: ACI 318-19 Isolated Footing Design
// Bearing Pressure, One-Way Shear, Punching, Flexure
// ============================================================

import { Foundation, FoundationDesign, BearingCheck } from '../../lib/types'
import { barArea, STANDARD_BAR_DIAMETERS, calcIRectangular } from '../../lib/utils'
import { checkPunchingShear } from './slabDesign'

export interface FootingDesignInput {
  foundation:  Foundation
  Pu:          number   // kN — factored axial load
  Mu_x:        number   // kN·m — moment about X
  Mu_y:        number   // kN·m — moment about Y
  Pa:          number   // kN — service axial (for bearing)
  col_bx:      number   // mm — column X dim
  col_by:      number   // mm — column Y dim
  fc:          number   // MPa — footing concrete
  fy:          number   // MPa — footing steel
  lambda:      number   // 1.0
}

export interface FootingDesignOutput extends FoundationDesign {
  warnings:    string[]
  checks:      { name: string; passed: boolean; value: number; limit: number; unit: string }[]
  q_net:       number   // kN/m² — net soil pressure under service load
  d_required:  number   // mm — required effective depth
  As_x:        number   // mm²/m — steel in X direction
  As_y:        number   // mm²/m — steel in Y direction
}

const PHI_FLEXURE = 0.90
const PHI_SHEAR   = 0.75

// ── Bearing Pressure ──────────────────────────────────────────

function checkBearing(input: FootingDesignInput): BearingCheck {
  const { Pa, Mu_x, Mu_y, foundation } = input
  const L = foundation.length / 1000   // m
  const B = foundation.width  / 1000   // m
  const A = L * B

  // Eccentricity
  const ex = Mu_y / Pa   // m (moment about Y → eccentricity in X)
  const ey = Mu_x / Pa   // m

  // Pressure at corners (kN/m²)
  // q = P/A ± Mx·y/Ix ± My·x/Iy
  const Ix = B * L**3 / 12   // m⁴
  const Iy = L * B**3 / 12

  const q_avg = Pa / A
  const q_max = Pa / A + (Mu_x / Ix) * (L / 2) + (Mu_y / Iy) * (B / 2)
  const q_min = Pa / A - (Mu_x / Ix) * (L / 2) - (Mu_y / Iy) * (B / 2)

  return {
    q_max:       +q_max.toFixed(2),
    q_min:       +q_min.toFixed(2),
    q_allowable: foundation.soilBearingCapacity,
    passed:      q_max <= foundation.soilBearingCapacity && q_min >= 0,
  }
}

// ── Required Effective Depth ──────────────────────────────────
// Controls: one-way shear or punching shear

function requiredDepth(input: FootingDesignInput): number {
  const { Pu, fc, foundation, col_bx, col_by, lambda } = input
  const L = foundation.length   // mm
  const B = foundation.width    // mm

  // Net upward pressure (factored)
  const qu = Pu / (L * B / 1e6)   // kN/m² — uniform assumed

  // ── Punching shear depth ───────────────────────────────────
  // At d/2 from column, φVc = φ·0.33·λ·√fc·bo·d
  // Vu = qu·(L·B - (col+d)²) / 1e6
  // Solve iteratively for d

  let d = 400  // initial guess (mm)
  for (let iter = 0; iter < 20; iter++) {
    const bo     = 2 * ((col_bx + d) + (col_by + d))  // mm
    const Vu_p   = qu * (L * B - (col_bx + d) * (col_by + d)) / 1e6  // kN
    const phiVc  = PHI_SHEAR * 0.33 * lambda * Math.sqrt(fc) * bo * d / 1000  // kN
    if (phiVc >= Vu_p) break
    d += 25
  }
  const d_punch = d

  // ── One-way shear depth ────────────────────────────────────
  // Critical section at d from column face (X direction)
  // Vu1 = qu · B · (L/2 - col_bx/2 - d) / 1e6
  let d1 = 300
  for (let iter = 0; iter < 20; iter++) {
    const cant   = (L / 2 - col_bx / 2 - d1) / 1000   // m
    if (cant <= 0) { d1 = 200; break }
    const Vu1    = qu * (B / 1000) * cant  // kN
    const phiVc1 = PHI_SHEAR * 0.17 * lambda * Math.sqrt(fc) * (B) * d1 / 1000  // kN
    if (phiVc1 >= Vu1) break
    d1 += 25
  }

  return Math.max(d_punch, d1, 250)  // min 250mm
}

// ── Flexure Design ────────────────────────────────────────────

function footingFlexure(
  Pu: number,      // kN
  L: number,       // mm — footing length
  B: number,       // mm — footing width
  col_bx: number,  // mm
  col_by: number,  // mm
  d: number,       // mm — effective depth
  fc: number,
  fy: number
): { As_x: number; As_y: number; Mu_x: number; Mu_y: number } {
  const qu = Pu / (L * B / 1e6)   // kN/m²

  // Critical section at face of column (ACI 13.2.7.1)
  const crit_x = (L / 2 - col_bx / 2) / 1000   // m
  const crit_y = (B / 2 - col_by / 2) / 1000

  const Mu_x = qu * (B / 1000) * crit_x**2 / 2   // kN·m (full width B)
  const Mu_y = qu * (L / 1000) * crit_y**2 / 2

  // As per unit width then scale
  const Mn_x = Mu_x * 1e6 / (B)    // N·mm per mm width → N
  const Mn_y = Mu_y * 1e6 / (L)

  // As = Mu / (φ·fy·(d - a/2)) — iterative simplified
  const calcAsFooting = (Mu_nm: number, b_mm: number): number => {
    const Rn  = Mu_nm * 1e6 / (PHI_FLEXURE * b_mm * d * d)
    const rat = 2 * Rn / (0.85 * fc)
    if (rat >= 1) return 0.85 * fc * b_mm * d / fy
    const rho = 0.85 * (fc / fy) * (1 - Math.sqrt(1 - rat))
    return rho * b_mm * d
  }

  const As_x_total = calcAsFooting(Mu_x, B)   // mm² (total across B)
  const As_y_total = calcAsFooting(Mu_y, L)   // mm² (total across L)

  const As_min_x = Math.max(0.0018 * B * (d + 50), 0.0014 * B * (d + 50))
  const As_min_y = Math.max(0.0018 * L * (d + 50), 0.0014 * L * (d + 50))

  return {
    As_x: Math.max(As_x_total, As_min_x),
    As_y: Math.max(As_y_total, As_min_y),
    Mu_x: +Mu_x.toFixed(2),
    Mu_y: +Mu_y.toFixed(2),
  }
}

// ── Main Design Function ──────────────────────────────────────

export function designFooting(input: FootingDesignInput): FootingDesignOutput {
  const warnings: string[] = []
  const { foundation, Pu, fc, fy, lambda } = input

  // Bearing check
  const bearing = checkBearing(input)
  if (!bearing.passed) {
    if (bearing.q_min < 0) warnings.push(`Uplift: q_min = ${bearing.q_min} kN/m² — footing size বাড়ান`)
    else warnings.push(`Bearing FAIL: q_max = ${bearing.q_max} > ${bearing.q_allowable} kN/m² — footing size বাড়ান`)
  }

  // Required depth
  const d_req = requiredDepth(input)
  const t     = foundation.thickness
  const cc    = 75  // cover for footings (ACI 20.6.1.3 — exposed to earth)
  const d     = t - cc - 16 / 2   // effective depth

  if (d < d_req) {
    warnings.push(`Footing thickness ${t}mm insufficient — d_req = ${d_req}mm → h ≥ ${d_req + cc + 8}mm`)
  }

  const d_use = Math.max(d, d_req)

  // Flexure
  const flex = footingFlexure(
    Pu, foundation.length, foundation.width,
    input.col_bx, input.col_by, d_use, fc, fy
  )

  // Punching check with actual d
  const punching = checkPunchingShear(
    Pu, fc, t, cc, input.col_bx, input.col_by, lambda
  )
  if (!punching.passed) {
    warnings.push(`Punching FAIL: Vu/φVc = ${punching.ratio.toFixed(2)} — thickness বাড়ান`)
  }

  // Net soil pressure (service)
  const q_net = input.Pa / (foundation.length * foundation.width / 1e6)

  // Rebar count
  const nX   = Math.ceil(flex.As_x / barArea(16))
  const nY   = Math.ceil(flex.As_y / barArea(16))
  const sX   = Math.floor((foundation.width - 150) / (nX - 1) / 25) * 25
  const sY   = Math.floor((foundation.length - 150) / (nY - 1) / 25) * 25

  const checks = [
    { name: 'Bearing Pressure',  passed: bearing.passed,    value: bearing.q_max,   limit: bearing.q_allowable, unit: 'kN/m²' },
    { name: 'No Uplift',         passed: bearing.q_min >= 0, value: bearing.q_min,  limit: 0,                   unit: 'kN/m²' },
    { name: 'Punching Shear',    passed: punching.passed,   value: punching.ratio,  limit: 1.0,                 unit: 'Vu/φVc' },
    { name: 'Effective Depth',   passed: d >= d_req,        value: d,               limit: d_req,               unit: 'mm' },
  ]

  const status = checks.every(c => c.passed) ? 'ok' : 'fail'

  return {
    foundationId: foundation.id,
    status:       status as 'ok' | 'fail',
    bearingPressure: bearing,
    flexure: {
      Mu_pos:     flex.Mu_x,
      Mu_neg:     0,
      As_pos_req: +flex.As_x.toFixed(0),
      As_neg_req: 0,
      As_min:     +(0.0018 * foundation.width * t).toFixed(0),
      As_max:     +(0.04 * foundation.width * d_use).toFixed(0),
      bars_pos:   { barDiameter: 16, noOfBars: nX, layers: 1, clearSpacing: sX },
      bars_neg:   { barDiameter: 16, noOfBars: 0,  layers: 1, clearSpacing: 0  },
    },
    shear: {
      Vu_max:             +(Pu * 0.3).toFixed(2),
      Vc:                 +(PHI_SHEAR * 0.17 * lambda * Math.sqrt(fc) * foundation.width * d_use / 1000).toFixed(2),
      Vs_req:             0,
      stirrupBar:         0,
      stirrupLegs:        0,
      stirrupSpacing_mid: 0,
      stirrupSpacing_end: 0,
    },
    punching,
    warnings,
    checks,
    q_net:        +q_net.toFixed(2),
    d_required:   d_req,
    As_x:         +(flex.As_x / (foundation.width / 1000)).toFixed(1),
    As_y:         +(flex.As_y / (foundation.length / 1000)).toFixed(1),
  }
}
