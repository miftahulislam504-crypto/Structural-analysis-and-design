// ============================================================
// CivilOS Structural — Shear Wall Design Engine
// Phase 7: ACI 318-19 §11 Structural Walls
// In-plane shear, Flexure, Boundary Elements, Reinforcement
// ============================================================

export interface ShearWallInput {
  id:         string
  label:      string
  lw:         number   // mm — wall length (horizontal)
  hw:         number   // mm — wall height (total)
  tw:         number   // mm — wall thickness
  Vu:         number   // kN — in-plane shear
  Mu:         number   // kN·m — overturning moment
  Pu:         number   // kN — axial (gravity)
  fc:         number   // MPa
  fy:         number   // MPa
  fyt:        number   // MPa (horizontal/vertical rebar)
  lambda:     number   // 1.0
  seismicZone: 1|2|3
}

export interface ShearWallDesignResult {
  id:         string
  label:      string
  status:     'ok' | 'fail' | 'pending'

  // Geometry
  hw_lw:      number   // aspect ratio

  // Shear design
  Vn:         number   // kN — nominal shear capacity
  phiVn:      number   // kN — design shear capacity
  rho_h:      number   // horizontal steel ratio
  rho_v:      number   // vertical steel ratio
  s_h:        number   // mm — horizontal bar spacing
  s_v:        number   // mm — vertical bar spacing
  barH:       number   // mm — horizontal bar dia
  barV:       number   // mm — vertical bar dia

  // Flexure
  Mn:         number   // kN·m
  phiMn:      number   // kN·m

  // Boundary elements
  needsBE:    boolean
  BE_length:  number   // mm — boundary element length
  BE_width:   number   // mm
  BE_rho:     number   // steel ratio in BE

  // Checks
  checks:     { name: string; passed: boolean; value: number; limit: number; unit: string }[]
  warnings:   string[]
}

const PHI_SHEAR   = 0.75
const PHI_FLEXURE = 0.90

// ── Shear Capacity (ACI 318-19 §11.5.4) ──────────────────────

function shearCapacity(input: ShearWallInput, rho_h: number): number {
  const { fc, lambda, lw, tw } = input
  const hw_lw = input.hw / input.lw

  // acv = lw * tw (gross shear area)
  const Acv = lw * tw  // mm²

  // αc depends on hw/lw
  const alphac = hw_lw <= 1.5 ? 0.25 : hw_lw >= 2.0 ? 0.17 : 0.25 - (hw_lw - 1.5) * (0.25 - 0.17) / 0.5

  // Vn = Acv * (αc*λ*√fc + ρh*fy) — ACI 11.5.4.3
  const Vn = Acv * (alphac * lambda * Math.sqrt(fc) + rho_h * input.fyt) / 1000  // kN

  // Vn_max = 0.66*λ*√fc*Acv — ACI 11.5.4.3
  const Vn_max = 0.66 * lambda * Math.sqrt(fc) * Acv / 1000  // kN

  return Math.min(Vn, Vn_max)
}

// ── Required Horizontal Steel ─────────────────────────────────

function requiredHorizontalSteel(input: ShearWallInput): {
  rho_h: number; barH: number; s_h: number
} {
  const { Vu, fc, lambda, lw, tw, fyt } = input
  const Acv = lw * tw  // mm²
  const hw_lw = input.hw / input.lw
  const alphac = hw_lw <= 1.5 ? 0.25 : hw_lw >= 2.0 ? 0.17 : 0.25 - (hw_lw - 1.5) * 0.16

  // Required: φVn ≥ Vu → ρh ≥ (Vu/φ/Acv - αc*λ*√fc) / fyt
  const rho_h_req = Math.max(
    (Vu * 1000 / PHI_SHEAR / Acv - alphac * lambda * Math.sqrt(fc)) / fyt,
    0.0025   // ACI 11.6.1 minimum
  )

  // Select bar + spacing
  const barH = 12   // mm — typical #12
  const Av   = 2 * Math.PI * (barH / 2) ** 2  // 2-curtains
  const s_h  = Math.min(
    Math.floor(Av / (rho_h_req * tw) / 25) * 25,
    450,       // ACI 11.7.2.1 max 450mm
    3 * tw     // max 3*tw
  )

  const rho_h_prov = Av / (tw * s_h)
  return { rho_h: +rho_h_prov.toFixed(4), barH, s_h: Math.max(s_h, 150) }
}

// ── Required Vertical Steel ───────────────────────────────────

function requiredVerticalSteel(input: ShearWallInput, rho_h: number): {
  rho_v: number; barV: number; s_v: number
} {
  const hw_lw = input.hw / input.lw
  const { tw } = input

  // Min ρv depends on hw/lw (ACI 11.6.2)
  const rho_v_min = hw_lw <= 2.0
    ? Math.max(rho_h, 0.0025)
    : 0.0025

  const barV = 12   // mm
  const Av   = 2 * Math.PI * (barV / 2) ** 2
  const s_v  = Math.min(
    Math.floor(Av / (rho_v_min * tw) / 25) * 25,
    450,
    3 * tw
  )

  const rho_v_prov = Av / (tw * s_v)
  return { rho_v: +rho_v_prov.toFixed(4), barV, s_v: Math.max(s_v, 150) }
}

// ── Boundary Element Check (ACI 318-19 §11.7.6) ──────────────

function checkBoundaryElement(input: ShearWallInput): {
  needsBE: boolean; BE_length: number; BE_width: number; BE_rho: number
} {
  const { lw, tw, hw, Pu, Mu, Vu, fc } = input
  const Ag = lw * tw

  // Displacement-based approach (ACI 11.7.6.2):
  // BE required if: c ≥ lw / (600 * δu/hw)
  // Simplified: check stress at boundary
  const c_simplified = lw / 2  // neutral axis at mid for preliminary

  // Force-based (ACI 11.7.6.3): BE if σ_c > 0.2*fc
  const e  = Mu / Pu       // m eccentricity
  const I  = (tw * lw ** 3) / 12
  const y  = lw / 2

  const sigma_c = Pu * 1000 / Ag + Mu * 1e6 * y / I  // MPa

  const needsBE = sigma_c > 0.2 * fc

  // BE dimensions (ACI 11.7.6.2b):
  // length ≥ max(c-0.1lw, c/2)
  const c = c_simplified
  const BE_length = Math.max(
    Math.ceil(Math.max(c - 0.1 * lw, c / 2) / 50) * 50,
    Math.ceil(0.15 * lw / 50) * 50,   // min 15% of lw
    200                                // absolute minimum
  )
  const BE_width  = tw
  const BE_rho    = 0.01  // min 1% for boundary element

  return { needsBE, BE_length, BE_width, BE_rho }
}

// ── Flexural Capacity (simplified) ───────────────────────────

function flexuralCapacity(input: ShearWallInput, rho_v: number): number {
  const { lw, tw, fc, fy, Pu } = input
  const Ast  = rho_v * tw * lw
  const d    = 0.8 * lw  // effective depth for wall
  const a    = Ast * fy / (0.85 * fc * tw)
  const Mn   = Ast * fy * (d - a / 2) + Pu * 1000 * lw / 2  // N·mm
  return Mn / 1e6  // kN·m
}

// ── Main Design ───────────────────────────────────────────────

export function designShearWall(input: ShearWallInput): ShearWallDesignResult {
  const warnings: string[] = []
  const hw_lw = +(input.hw / input.lw).toFixed(2)

  // Horizontal steel
  const hSteel = requiredHorizontalSteel(input)

  // Shear capacity with provided steel
  const Vn    = shearCapacity(input, hSteel.rho_h)
  const phiVn = PHI_SHEAR * Vn

  if (phiVn < input.Vu) {
    warnings.push(`Shear capacity insufficient: φVn=${phiVn.toFixed(1)} < Vu=${input.Vu} kN — tw বাড়ান`)
  }

  // Vertical steel
  const vSteel = requiredVerticalSteel(input, hSteel.rho_h)

  // Flexure
  const Mn    = flexuralCapacity(input, vSteel.rho_v)
  const phiMn = PHI_FLEXURE * Mn

  if (phiMn < input.Mu) {
    warnings.push(`Flexural capacity: φMn=${phiMn.toFixed(1)} < Mu=${input.Mu} kN·m — lw বাড়ান`)
  }

  // Boundary elements
  const be = checkBoundaryElement(input)
  if (be.needsBE && input.seismicZone >= 2) {
    warnings.push(`Boundary elements required (ACI 11.7.6) — length = ${be.BE_length}mm each end`)
  }

  // Min thickness checks (ACI 11.3.1.1)
  const tw_min = input.hw / 25
  if (input.tw < tw_min) {
    warnings.push(`Wall thickness ${input.tw}mm < min ${tw_min.toFixed(0)}mm (hw/25)`)
  }

  const checks = [
    { name: 'φVn ≥ Vu',        passed: phiVn >= input.Vu,  value: phiVn,       limit: input.Vu,  unit: 'kN' },
    { name: 'φMn ≥ Mu',        passed: phiMn >= input.Mu,  value: phiMn,       limit: input.Mu,  unit: 'kN·m' },
    { name: 'ρh_min = 0.0025', passed: hSteel.rho_h >= 0.0025, value: hSteel.rho_h, limit: 0.0025, unit: '' },
    { name: 'ρv_min = 0.0025', passed: vSteel.rho_v >= 0.0025, value: vSteel.rho_v, limit: 0.0025, unit: '' },
    { name: 'tw ≥ hw/25',      passed: input.tw >= tw_min, value: input.tw,    limit: tw_min,    unit: 'mm' },
  ]

  return {
    id: input.id, label: input.label,
    status: checks.every(c => c.passed) && warnings.filter(w => w.includes('insufficient') || w.includes('kN·m')).length === 0 ? 'ok' : 'fail',
    hw_lw,
    Vn: +Vn.toFixed(2), phiVn: +phiVn.toFixed(2),
    rho_h: hSteel.rho_h, barH: hSteel.barH, s_h: hSteel.s_h,
    rho_v: vSteel.rho_v, barV: vSteel.barV, s_v: vSteel.s_v,
    Mn: +Mn.toFixed(2), phiMn: +phiMn.toFixed(2),
    needsBE: be.needsBE, BE_length: be.BE_length, BE_width: be.BE_width, BE_rho: be.BE_rho,
    checks, warnings,
  }
}
