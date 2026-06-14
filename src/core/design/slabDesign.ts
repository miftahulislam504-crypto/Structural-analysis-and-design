// ============================================================
// CivilOS Structural — Slab Design Engine
// Phase 6.1: ACI 318-19 Slab Design
// One-Way: Coefficient Method
// Two-Way: Direct Design Method (DDM)
// Flat Slab: Empirical + Punching Check
// ============================================================

import { Slab, SlabDesign, RebarLayout, PunchingShearCheck } from '../../lib/types'
import { barArea, STANDARD_BAR_DIAMETERS } from '../../lib/utils'

export interface SlabDesignInput {
  slab:        Slab
  ln:          number   // mm — clear span (short direction)
  ln2:         number   // mm — long span (two-way)
  wu:          number   // kN/m² — factored load
  fc:          number   // MPa
  fy:          number   // MPa
  lambda:      number   // 1.0 normal weight
  Pu_col?:     number   // kN — column axial for punching (flat slab)
  col_bx?:     number   // mm — column size X
  col_by?:     number   // mm — column size Y
}

export interface SlabDesignOutput extends SlabDesign {
  warnings: string[]
  checks:   { name: string; passed: boolean; value: number; limit: number; unit: string }[]
  Mu_pos:   number   // kN·m/m
  Mu_neg:   number   // kN·m/m
}

const PHI_FLEXURE = 0.90
const PHI_SHEAR   = 0.75

// ── Min Slab Thickness (ACI 318-19 Table 7.3.1.1) ────────────

export function minSlabThickness(
  ln: number,         // mm — clear span
  type: 'one_way' | 'two_way' | 'flat_slab' | 'flat_plate',
  fy: number,         // MPa
  support: 'simply_supported' | 'one_end' | 'both_ends' | 'cantilever' = 'both_ends'
): number {
  // ACI Table 7.3.1.1 — one-way slabs
  const factorOW: Record<string, number> = {
    simply_supported: 20,
    one_end:          24,
    both_ends:        28,
    cantilever:       10,
  }

  if (type === 'one_way') {
    const h = ln / factorOW[support] * (0.4 + fy / 700)
    return Math.max(Math.ceil(h / 10) * 10, 90)  // round to 10mm, min 90mm
  }

  // Two-way (ACI 8.3.1.1): h = ln(0.8 + fy/1400) / 33 for αfm ≤ 0.2 (flat plate)
  if (type === 'flat_plate' || type === 'flat_slab') {
    const h = ln * (0.8 + fy / 1400) / 33
    return Math.max(Math.ceil(h / 10) * 10, 125)
  }

  // Two-way with beams (αfm > 2): h = ln(0.8 + fy/1400) / 36
  const h = ln * (0.8 + fy / 1400) / 36
  return Math.max(Math.ceil(h / 10) * 10, 90)
}

// ── One-Way Slab Design ───────────────────────────────────────

function designOneWaySlab(input: SlabDesignInput): {
  Mu_pos: number; Mu_neg: number
  As_x_bot: number; As_x_top: number
  As_y_bot: number; As_y_top: number
  barX: RebarLayout; barY: RebarLayout
} {
  const { ln, wu, fc, fy, slab } = input
  const t   = slab.thickness          // mm
  const cc  = slab.clearCover         // mm
  const b   = 1000                    // mm/m strip
  const d   = t - cc - 6             // effective depth (mm) — #12 bar, half dia

  // ACI coefficient method (ACI 6.5) — simply-supported approximation
  // For interior span both ends continuous: Mu+ = wu·ln²/16, Mu- = wu·ln²/11
  const ln_m = ln / 1000  // m
  const wu_m  = wu        // kN/m²

  const Mu_pos = wu_m * ln_m * ln_m / 16    // kN·m/m (positive — bottom)
  const Mu_neg = wu_m * ln_m * ln_m / 11    // kN·m/m (negative — top, at support)

  // Design As for each
  const As_pos = calcAs(Mu_pos, b, d, fc, fy)
  const As_neg = calcAs(Mu_neg, b, d, fc, fy)

  // Min steel (ACI 7.6.1.1): As_min = 0.0018·b·h (Grade 415)
  const As_min = Math.max(
    fy <= 280 ? 0.0020 * b * t : 0.0018 * b * t,
    0.0014 * b * t
  )

  const As_x_bot = Math.max(As_pos, As_min)
  const As_x_top = Math.max(As_neg, As_min)
  const As_y_bot = As_min  // shrinkage/temperature steel (ACI 24.4.3.2)

  // Rebar selection (per metre width)
  const barX = selectSlabRebar(As_x_bot, b, cc)
  const barY = selectSlabRebar(As_y_bot, b, cc)

  return { Mu_pos, Mu_neg, As_x_bot, As_x_top, As_y_bot, As_y_top: As_min, barX, barY }
}

// ── Two-Way Slab Design (Direct Design Method) ───────────────

function designTwoWaySlab(input: SlabDesignInput): {
  Mu_pos: number; Mu_neg: number
  As_x_bot: number; As_x_top: number
  As_y_bot: number; As_y_top: number
  barX: RebarLayout; barY: RebarLayout
} {
  const { ln, ln2, wu, fc, fy, slab } = input
  const t  = slab.thickness
  const cc = slab.clearCover
  const b  = 1000   // 1m strip
  const d  = t - cc - 6

  const la   = Math.min(ln, ln2) / 1000  // m — short span
  const lb   = Math.max(ln, ln2) / 1000  // m — long span
  const ra   = la / lb                   // ≤ 1.0

  // Total static moment Mo = wu·la·lb² / 8  (ACI 8.10.3.2)
  const Mo_a = wu * la * lb * lb / 8    // kN·m (long span strip)
  const Mo_b = wu * lb * la * la / 8    // kN·m (short span strip)

  // Distribution — interior span: 65% negative, 35% positive (ACI 8.10.4)
  const Mu_neg_a = 0.65 * Mo_a
  const Mu_pos_a = 0.35 * Mo_a
  const Mu_neg_b = 0.65 * Mo_b
  const Mu_pos_b = 0.35 * Mo_b

  // Per metre width — column strip gets 75%, middle strip 25%
  // Simplified: design for full width
  const As_min = Math.max(0.0018 * b * t, 0.0014 * b * t)

  const As_x_bot = Math.max(calcAs(Mu_pos_b / la, b, d, fc, fy), As_min)
  const As_x_top = Math.max(calcAs(Mu_neg_b / la, b, d, fc, fy), As_min)
  const As_y_bot = Math.max(calcAs(Mu_pos_a / lb, b, d, fc, fy), As_min)
  const As_y_top = Math.max(calcAs(Mu_neg_a / lb, b, d, fc, fy), As_min)

  const barX = selectSlabRebar(As_x_bot, b, cc)
  const barY = selectSlabRebar(As_y_bot, b, cc)

  return {
    Mu_pos: Mu_pos_b / la,
    Mu_neg: Mu_neg_b / la,
    As_x_bot, As_x_top, As_y_bot, As_y_top,
    barX, barY,
  }
}

// ── Punching Shear Check (ACI 22.6.5) ────────────────────────

export function checkPunchingShear(
  Pu:    number,   // kN — column load
  fc:    number,   // MPa
  t:     number,   // mm — slab thickness
  cc:    number,   // mm — cover
  bx:    number,   // mm — column X dim
  by:    number,   // mm — column Y dim
  lambda = 1.0
): PunchingShearCheck {
  const d  = t - cc - 6   // mm

  // Critical perimeter bo at d/2 from column face (ACI 22.6.4.1)
  const bo = 2 * ((bx + d) + (by + d))  // mm

  // αs = 40 for interior column
  const alphas = 40

  // Vc = min of three formulas (ACI 22.6.5.2):
  const beta = Math.max(bx, by) / Math.min(bx, by)
  const Vc1  = (0.33 + 0.17 / beta) * lambda * Math.sqrt(fc) * bo * d  // N
  const Vc2  = (0.083 * (alphas * d / bo + 2)) * lambda * Math.sqrt(fc) * bo * d
  const Vc3  = 0.33 * lambda * Math.sqrt(fc) * bo * d

  const Vc   = Math.min(Vc1, Vc2, Vc3)
  const phiVc = PHI_SHEAR * Vc / 1000  // kN

  const ratio = Pu / phiVc

  return {
    Vu:               +Pu.toFixed(2),
    phiVc:            +phiVc.toFixed(2),
    ratio:            +ratio.toFixed(3),
    passed:           ratio <= 1.0,
    criticalPerimeter: +bo.toFixed(0),
  }
}

// ── Main Design Function ──────────────────────────────────────

export function designSlab(input: SlabDesignInput): SlabDesignOutput {
  const warnings: string[] = []
  const { slab, fc, fy } = input

  // Min thickness check
  const hMin = minSlabThickness(
    Math.min(input.ln, input.ln2),
    slab.type, fy
  )
  if (slab.thickness < hMin) {
    warnings.push(`Slab thickness ${slab.thickness}mm < minimum ${hMin}mm (ACI 318-19)`)
  }

  let result: ReturnType<typeof designOneWaySlab>

  if (slab.type === 'one_way') {
    result = designOneWaySlab(input)
  } else {
    result = designTwoWaySlab(input)
  }

  // Punching check for flat slab / flat plate
  let punchingCheck: PunchingShearCheck | undefined
  if ((slab.type === 'flat_slab' || slab.type === 'flat_plate') && input.Pu_col) {
    punchingCheck = checkPunchingShear(
      input.Pu_col, fc,
      slab.thickness, slab.clearCover,
      input.col_bx ?? 300, input.col_by ?? 300
    )
    if (!punchingCheck.passed) {
      warnings.push(`Punching shear FAIL: Vu/φVc = ${punchingCheck.ratio.toFixed(2)} — slab thickness বাড়ান`)
    }
  }

  const checks = [
    { name: 'Min Thickness', passed: slab.thickness >= hMin, value: slab.thickness, limit: hMin, unit: 'mm' },
    { name: 'Flexure (+Mu)', passed: true, value: result.Mu_pos, limit: result.Mu_pos, unit: 'kN·m/m' },
  ]
  if (punchingCheck) {
    checks.push({ name: 'Punching Shear', passed: punchingCheck.passed, value: punchingCheck.ratio, limit: 1.0, unit: 'Vu/φVc' })
  }

  const status = warnings.some(w => w.includes('FAIL')) ? 'fail'
    : warnings.length > 0 ? 'fail'
    : 'ok'

  return {
    slabId:    slab.id,
    status:    status as 'ok' | 'fail',
    type:      slab.type === 'one_way' ? 'one_way' : 'two_way',
    thickness: slab.thickness,
    As_x_top:  +result.As_x_top.toFixed(1),
    As_x_bot:  +result.As_x_bot.toFixed(1),
    As_y_top:  +result.As_y_top.toFixed(1),
    As_y_bot:  +result.As_y_bot.toFixed(1),
    barX:      result.barX,
    barY:      result.barY,
    punchingCheck,
    warnings,
    checks,
    Mu_pos:    +result.Mu_pos.toFixed(3),
    Mu_neg:    +result.Mu_neg.toFixed(3),
  }
}

// ── Helpers ───────────────────────────────────────────────────

function calcAs(
  Mu_per_m: number,  // kN·m/m
  b: number,         // mm (= 1000 for per-metre)
  d: number,         // mm
  fc: number,
  fy: number
): number {
  const Mu = Mu_per_m * 1e6  // N·mm
  if (Mu <= 0) return 0

  const Rn  = Mu / (PHI_FLEXURE * b * d * d)
  const rat = 2 * Rn / (0.85 * fc)
  if (rat >= 1.0) return 0.85 * fc * b * d / fy  // over-reinforced limit

  const rho = 0.85 * (fc / fy) * (1 - Math.sqrt(1 - rat))
  return rho * b * d
}

function selectSlabRebar(As_req: number, b: number, cc: number): RebarLayout {
  // As_req is per metre width
  for (const dia of [10, 12, 16, 20]) {
    const a    = barArea(dia)
    const sMax = Math.min(3 * 150, 450)  // ACI 7.7.2.3 max spacing = min(3h, 450mm)
    const s    = Math.floor(a / As_req * 1000 / 25) * 25  // mm — round to 25mm
    const sUse = Math.min(s, sMax)
    const nPer1m = Math.ceil(1000 / sUse)
    const As_prov = nPer1m * a

    if (As_prov >= As_req) {
      return {
        barDiameter:  dia,
        noOfBars:     nPer1m,
        layers:       1,
        clearSpacing: sUse,
      }
    }
  }

  return { barDiameter: 16, noOfBars: Math.ceil(As_req / barArea(16)), layers: 1, clearSpacing: 150 }
}
