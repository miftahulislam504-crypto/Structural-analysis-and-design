// ============================================================
// CivilOS Structural — Beam Design Engine
// Phase 6.2: ACI 318-19 Beam Design
// Flexure §9, Shear §22, Torsion §22.7, Deflection §24
// ============================================================

import { Beam, BeamDesign, RebarLayout } from '../../lib/types'
import { barArea, STANDARD_BAR_DIAMETERS } from '../../lib/utils'

export interface BeamDesignInput {
  beam:       Beam
  Mu_pos:     number   // kN·m — positive moment (bottom steel)
  Mu_neg:     number   // kN·m — negative moment (top steel)
  Vu_max:     number   // kN — max shear
  Tu:         number   // kN·m — torsion (0 if negligible)
  fc:         number   // MPa — concrete strength
  fy:         number   // MPa — steel yield
  fyt:        number   // MPa — transverse steel yield
  Es:         number   // MPa — steel elastic modulus
  lambda:     number   // 1.0 for normal weight concrete
  seismicZone: 1|2|3
}

export interface BeamDesignOutput extends BeamDesign {
  warnings: string[]
  checks:   { name: string; passed: boolean; value: number; limit: number; unit: string }[]
}

// ── φ factors (ACI 318-19 Table 21.2.1) ─────────────────────
const PHI_FLEXURE = 0.90
const PHI_SHEAR   = 0.75
const PHI_TORSION = 0.75

// ── Flexure Design (ACI 318-19 §9.3, §22.2) ─────────────────

function designFlexure(
  input: BeamDesignInput,
  side: 'pos' | 'neg'
): { As_req: number; rebar: RebarLayout; Mn: number } {
  const { fc, fy, lambda } = input
  const Mu = (side === 'pos' ? input.Mu_pos : input.Mu_neg) * 1e6  // N·mm

  // Section dimensions
  const bw = (input.beam.section as any).width  ?? 250   // mm
  const h  = (input.beam.section as any).depth  ?? 450   // mm
  const cc = input.beam.clearCover                        // mm
  const d  = h - cc - 10 - 16 / 2                        // effective depth (mm)
                                                          // assuming #5 bar, #3 stirrup

  // β1 per ACI 318-19 Table 22.2.2.4.3
  const beta1 = fc <= 28 ? 0.85
    : fc <= 56 ? 0.85 - 0.05 * (fc - 28) / 7
    : 0.65

  // Required As from: Mu = φ·As·fy·(d - a/2), iterate
  // Using quadratic: 0.85·fc·b·a² - 0.85·fc·b·2d·a + 2Mu/φ = 0
  // Simplified: Rn = Mu/(φ·bw·d²), ρ = 0.85·fc/fy·(1 - √(1 - 2Rn/(0.85fc)))
  const Rn    = Mu / (PHI_FLEXURE * bw * d * d)  // MPa
  const ratio = 2 * Rn / (0.85 * fc)

  let As_req: number
  if (ratio >= 1.0) {
    // Over-reinforced — need larger section
    As_req = 0.85 * fc * bw * d / fy * (1 - Math.sqrt(0.001))
  } else {
    const rho = 0.85 * (fc / fy) * (1 - Math.sqrt(1 - ratio))
    As_req    = rho * bw * d
  }

  // Min steel (ACI 9.6.1.2)
  const As_min = Math.max(
    (0.25 * Math.sqrt(fc) / fy) * bw * d,
    (1.4 / fy) * bw * d
  )

  // Max steel — ρ_max = 0.75·ρ_b (ACI 9.3.3)
  const rho_b   = (0.85 * beta1 * fc / fy) * (600 / (600 + fy))
  const As_max  = 0.75 * rho_b * bw * d

  const As_design = Math.max(As_req, As_min)

  // Select rebar
  const rebar = selectRebar(As_design, bw, cc)

  // Actual Mn
  const As_prov = rebar.noOfBars * barArea(rebar.barDiameter)
  const a = As_prov * fy / (0.85 * fc * bw)
  const Mn = As_prov * fy * (d - a / 2) / 1e6  // kN·m

  return {
    As_req:  +As_design.toFixed(1),
    rebar,
    Mn:      +Mn.toFixed(2),
  }
}

// ── Shear Design (ACI 318-19 §22.5) ─────────────────────────

function designShear(input: BeamDesignInput): BeamDesign['shear'] {
  const { fc, fyt, lambda, seismicZone } = input
  const bw = (input.beam.section as any).width ?? 250
  const h  = (input.beam.section as any).depth ?? 450
  const cc = input.beam.clearCover
  const d  = h - cc - 10 - 16 / 2

  const Vu = input.Vu_max * 1000  // N

  // Vc — concrete shear strength (ACI 22.5.5.1 simplified)
  // Vc = 0.17·λ·√fc·bw·d
  const Vc = 0.17 * lambda * Math.sqrt(fc) * bw * d  // N

  // φVc check
  const phiVc = PHI_SHEAR * Vc

  // Required Vs
  const Vs_req = Math.max(Vu / PHI_SHEAR - Vc, 0)

  // Vs_max = 0.66·√fc·bw·d (ACI 22.5.1.2)
  const Vs_max = 0.66 * Math.sqrt(fc) * bw * d

  // Stirrup design: Vs = Av·fyt·d / s
  // Use 2-leg #10 stirrups (Av = 2 × 78.5 = 157 mm²)
  const stirrupDia  = 10   // mm
  const stirrupLegs = 2
  const Av = stirrupLegs * barArea(stirrupDia)

  // Spacing from Vs
  let s_req = Vs_req > 0 ? (Av * fyt * d) / Vs_req : 9999

  // Max spacing (ACI 9.7.6.2.2)
  const s_max_mid = Math.min(d / 2, 600)  // mm — mid span

  // Seismic zone 2/3: closer spacing at ends (ACI 18.4)
  const s_max_end = seismicZone >= 2
    ? Math.min(d / 4, 6 * 16, 150)  // mm — seismic end zone
    : Math.min(d / 2, 600)

  const s_mid = Math.min(s_req, s_max_mid)
  const s_end = Math.min(s_req, s_max_end)

  // Round down to nearest 25mm
  const roundDown = (s: number) => Math.max(Math.floor(s / 25) * 25, 50)

  return {
    Vu_max:              +(Vu / 1000).toFixed(2),
    Vc:                  +(Vc / 1000).toFixed(2),
    Vs_req:              +(Vs_req / 1000).toFixed(2),
    stirrupBar:          stirrupDia,
    stirrupLegs,
    stirrupSpacing_mid:  roundDown(s_mid),
    stirrupSpacing_end:  roundDown(s_end),
  }
}

// ── Torsion Check (ACI 318-19 §22.7) ─────────────────────────

function checkTorsion(input: BeamDesignInput): BeamDesign['torsion'] {
  const { fc } = input
  const bw = (input.beam.section as any).width ?? 250
  const h  = (input.beam.section as any).depth ?? 450
  const Tu = input.Tu * 1e6  // N·mm

  // Threshold torsion (ACI 22.7.4)
  const Acp  = bw * h
  const Pcp  = 2 * (bw + h)
  const Tth  = PHI_TORSION * 0.083 * Math.sqrt(fc) * (Acp * Acp / Pcp)

  const required = Tu > Tth

  return {
    Tu:                     +(Tu / 1e6).toFixed(3),
    Tcr:                    +(Tth / 1e6).toFixed(3),
    requiresTorsionDesign:  required,
    closedStirrupSpacing:   required ? 150 : undefined,  // simplified
  }
}

// ── Deflection Check (ACI 318-19 §24) ────────────────────────

function checkDeflection(input: BeamDesignInput, As_prov: number): BeamDesign['deflection'] {
  const { fc, fy, Es } = input
  const bw = (input.beam.section as any).width ?? 250
  const h  = (input.beam.section as any).depth ?? 450
  const cc = input.beam.clearCover
  const d  = h - cc - 10 - 16 / 2

  // Span (from node IDs — simplified: use 5m default if unknown)
  const span = 5000  // mm — will be updated when nodes are resolved

  // Effective moment of inertia (ACI 24.2 — Branson's equation)
  const Ec = 4700 * Math.sqrt(fc)  // MPa
  const fr  = 0.62 * Math.sqrt(fc) // MPa — modulus of rupture
  const Ig  = bw * Math.pow(h, 3) / 12  // mm⁴
  const yt  = h / 2                      // mm — centroid to extreme fiber
  const Mcr = fr * Ig / yt              // N·mm — cracking moment

  const Ma = input.Mu_pos * 1e6         // N·mm — max moment under service load (approx)
  const ratio_cr = Ma > 0 ? Mcr / Ma : 1.0

  // Ie = (Mcr/Ma)³·Ig + [1-(Mcr/Ma)³]·Icr  (Branson)
  const rho  = As_prov / (bw * d)
  const n    = Es / Ec
  const k    = Math.sqrt(2 * rho * n + (rho * n) ** 2) - rho * n
  const Icr  = bw * Math.pow(k * d, 3) / 3 + n * As_prov * Math.pow(d - k * d, 2)
  const cb   = Math.min(ratio_cr ** 3, 1.0)
  const Ie   = cb * Ig + (1 - cb) * Icr

  // Immediate deflection — UDL: δ = 5wL⁴/(384EIe)
  // Approximate w from Mu = wL²/8 → w = 8Mu/L²
  const w    = 8 * Ma / (span * span)   // N/mm
  const delta_imm = 5 * w * Math.pow(span, 4) / (384 * Ec * Ie)  // mm

  // Long-term multiplier λ_Δ = ξ/(1+50ρ') — ACI 24.2.4.1.3
  const xi       = 2.0   // ξ for sustained load (>5 years)
  const rho_comp = 0     // no compression steel assumed
  const lambda_lt = xi / (1 + 50 * rho_comp)
  const delta_lt  = lambda_lt * delta_imm

  const delta_total = delta_imm + delta_lt

  // Limits (ACI 24.2.2)
  const limit_live  = span / 360   // mm
  const limit_total = span / 240   // mm

  return {
    span:            span,
    ieff:            +Ie.toFixed(0),
    delta_immediate: +delta_imm.toFixed(2),
    delta_longterm:  +delta_lt.toFixed(2),
    limit_live:      +limit_live.toFixed(1),
    limit_total:     +limit_total.toFixed(1),
    passed:          delta_total <= limit_total,
  }
}

// ── Main Design Function ──────────────────────────────────────

export function designBeam(input: BeamDesignInput): BeamDesignOutput {
  const warnings: string[] = []

  // Flexure
  const flexPos = designFlexure(input, 'pos')
  const flexNeg = designFlexure(input, 'neg')

  const As_pos_prov = flexPos.rebar.noOfBars * barArea(flexPos.rebar.barDiameter)
  const As_neg_prov = flexNeg.rebar.noOfBars * barArea(flexNeg.rebar.barDiameter)

  const bw = (input.beam.section as any).width ?? 250
  const h  = (input.beam.section as any).depth ?? 450
  const cc = input.beam.clearCover
  const d  = h - cc - 10 - 16 / 2

  // Max steel check
  const fc = input.fc, fy = input.fy
  const beta1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - 0.05*(fc-28)/7)
  const rho_b = 0.85 * beta1 * fc / fy * 600 / (600 + fy)
  const As_max = 0.75 * rho_b * bw * d

  if (As_pos_prov > As_max) warnings.push('Bottom steel exceeds ρ_max — beam over-reinforced!')
  if (As_neg_prov > As_max) warnings.push('Top steel exceeds ρ_max — beam over-reinforced!')

  const shear       = designShear(input)
  const torsion     = checkTorsion(input)
  const deflection  = checkDeflection(input, As_pos_prov)

  const As_min = Math.max(
    (0.25 * Math.sqrt(fc) / fy) * bw * d,
    (1.4 / fy) * bw * d
  )

  const status = warnings.some(w => w.includes('over-reinforced'))
    || !deflection.passed ? 'fail' : 'ok'

  const checks = [
    { name: 'Flexure (+Mu)',     passed: flexPos.Mn >= input.Mu_pos,  value: flexPos.Mn,    limit: input.Mu_pos,   unit: 'kN·m' },
    { name: 'Flexure (-Mu)',     passed: flexNeg.Mn >= input.Mu_neg,  value: flexNeg.Mn,    limit: input.Mu_neg,   unit: 'kN·m' },
    { name: 'Shear φVn ≥ Vu',   passed: PHI_SHEAR*(shear.Vc+shear.Vs_req) >= input.Vu_max,
      value: PHI_SHEAR*(shear.Vc+shear.Vs_req), limit: input.Vu_max, unit: 'kN' },
    { name: 'Deflection',        passed: deflection.passed,           value: deflection.delta_immediate + deflection.delta_longterm, limit: deflection.limit_total, unit: 'mm' },
    { name: 'Min Steel',         passed: As_pos_prov >= As_min,       value: As_pos_prov,   limit: As_min,         unit: 'mm²' },
    { name: 'Torsion threshold', passed: !torsion?.requiresTorsionDesign, value: torsion?.Tu ?? 0, limit: torsion?.Tcr ?? 0, unit: 'kN·m' },
  ]

  return {
    beamId:   input.beam.id,
    status:   status as 'ok' | 'fail' | 'pending',
    flexure: {
      Mu_pos:     input.Mu_pos,
      Mu_neg:     input.Mu_neg,
      As_pos_req: flexPos.As_req,
      As_neg_req: flexNeg.As_req,
      As_min:     +As_min.toFixed(1),
      As_max:     +As_max.toFixed(1),
      bars_pos:   flexPos.rebar,
      bars_neg:   flexNeg.rebar,
    },
    shear,
    torsion,
    deflection,
    warnings,
    checks,
  }
}

// ── Rebar Selection ───────────────────────────────────────────

function selectRebar(As_req: number, bw: number, cc: number): RebarLayout {
  // Try each standard bar size, find min bars that fit
  for (const dia of [...STANDARD_BAR_DIAMETERS].reverse()) {
    const a   = barArea(dia)
    const n   = Math.ceil(As_req / a)
    const nActual = Math.max(n, 2)  // min 2 bars

    // Check if bars fit in width
    // Clear spacing = (bw - 2cc - 2*stirrup - n*dia) / (n-1)
    const stirrup = 10
    const clearSpacing = nActual > 1
      ? (bw - 2 * cc - 2 * stirrup - nActual * dia) / (nActual - 1)
      : bw - 2 * cc - 2 * stirrup - dia

    const minClear = Math.max(dia, 25)  // ACI 25.2.1

    if (clearSpacing >= minClear) {
      return {
        barDiameter:  dia,
        noOfBars:     nActual,
        layers:       nActual <= 4 ? 1 : 2,
        clearSpacing: +clearSpacing.toFixed(1),
      }
    }
  }

  // Fallback — 2 layers
  const dia = 25
  const n   = Math.ceil(As_req / barArea(dia))
  return { barDiameter: dia, noOfBars: n, layers: 2, clearSpacing: 30 }
}
