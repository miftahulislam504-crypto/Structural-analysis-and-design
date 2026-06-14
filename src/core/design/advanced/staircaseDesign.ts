// ============================================================
// CivilOS Structural — Staircase Design Engine
// Phase 7: RC Waist Slab Stair (ACI 318-19 / BNBC 2020)
// ============================================================

export interface StaircaseInput {
  id:          string
  label:       string
  riser:       number   // mm
  tread:       number   // mm
  noOfRisers:  number
  flightWidth: number   // mm
  waistThick:  number   // mm — waist slab thickness
  supportType: 'simply_supported' | 'one_end_fixed' | 'both_fixed'
  fc:          number   // MPa
  fy:          number   // MPa
  LL:          number   // kN/m² — live load (BNBC Table 2.2: 3.0 for stairs)
  finishLoad:  number   // kN/m² — finish (tiles + plaster ≈ 1.0)
}

export interface StaircaseDesignResult {
  id:         string
  label:      string
  status:     'ok' | 'fail'

  // Geometry
  flightLength:    number   // mm — horizontal
  slantLength:     number   // mm — along slope
  angle:           number   // degrees
  cosAngle:        number

  // Loads
  wu:              number   // kN/m² — factored (on horizontal plan)
  selfWeight:      number   // kN/m²

  // Design
  Mu:              number   // kN·m/m
  As_main:         number   // mm²/m — longitudinal
  As_dist:         number   // mm²/m — distribution
  barMain:         number   // mm dia
  sMain:           number   // mm spacing
  barDist:         number   // mm dia
  sDist:           number   // mm spacing

  // Shear
  Vu:              number   // kN/m
  Vc:              number   // kN/m
  shearOK:         boolean

  // Deflection
  d_eff:           number   // mm
  h_min:           number   // mm — min thickness

  checks:          { name: string; passed: boolean; value: number; limit: number; unit: string }[]
  warnings:        string[]
}

const PHI_FLEX  = 0.90
const PHI_SHEAR = 0.75
const GAMMA_CONC = 24  // kN/m³

// ── Min Waist Thickness ───────────────────────────────────────

function minWaistThickness(L: number, support: string, fy: number): number {
  // Use ACI one-way slab provisions for span length along slope
  const factor = support === 'simply_supported' ? 20
    : support === 'one_end_fixed' ? 24 : 28
  const h = L / factor * (0.4 + fy / 700)
  return Math.max(Math.ceil(h / 10) * 10, 100)  // min 100mm
}

// ── Staircase Geometry ────────────────────────────────────────

function calcGeometry(input: StaircaseInput): {
  flightLength: number; slantLength: number; angle: number; cosAngle: number
} {
  const { riser, tread, noOfRisers } = input
  const noOfTreads    = noOfRisers - 1
  const flightLength  = noOfTreads * tread  // mm horizontal
  const totalRise     = noOfRisers * riser  // mm vertical

  const angle    = Math.atan2(totalRise, flightLength) * 180 / Math.PI
  const cosAngle = Math.cos(angle * Math.PI / 180)
  const slantLength = Math.sqrt(flightLength ** 2 + totalRise ** 2)  // mm

  return { flightLength, slantLength, angle: +angle.toFixed(1), cosAngle: +cosAngle.toFixed(4) }
}

// ── Self-Weight (inclined slab + steps) ──────────────────────

function selfWeight(input: StaircaseInput, cosAngle: number): number {
  const { riser, tread, waistThick } = input
  // Waist slab weight on horizontal plan
  const w_waist = GAMMA_CONC * (waistThick / 1000) / cosAngle  // kN/m²

  // Step weight (triangular area): γ * R/2 / T * T = γ * R/2
  const w_step  = GAMMA_CONC * (riser / 1000) / 2  // kN/m²

  return +(w_waist + w_step).toFixed(2)
}

// ── Factored Load ─────────────────────────────────────────────

function factoredLoad(SW: number, finishLoad: number, LL: number): number {
  const DL = SW + finishLoad  // kN/m²
  return +(1.2 * DL + 1.6 * LL).toFixed(2)  // ACI combo
}

// ── Design Moment ─────────────────────────────────────────────

function designMoment(wu: number, L: number, support: string, width: number): number {
  const L_m = L / 1000   // m
  const w   = wu * (width / 1000)  // kN/m (per unit width → per flight width)

  // Moment per unit width
  const Mu_per_m = support === 'simply_supported' ? wu * L_m ** 2 / 8
    : support === 'one_end_fixed'    ? wu * L_m ** 2 / 10
    : wu * L_m ** 2 / 12

  return +Mu_per_m.toFixed(3)   // kN·m/m
}

// ── Rebar Design ──────────────────────────────────────────────

function calcMainSteel(Mu_per_m: number, tw: number, cc: number, fc: number, fy: number): {
  As: number; bar: number; spacing: number
} {
  const d    = tw - cc - 6    // mm effective depth (#12 bar, half dia)
  const b    = 1000           // mm/m strip
  const Mu   = Mu_per_m * 1e6 // N·mm/m

  const Rn   = Mu / (PHI_FLEX * b * d ** 2)
  const rat  = 2 * Rn / (0.85 * fc)
  const rho  = 0.85 * (fc / fy) * (1 - Math.sqrt(Math.max(1 - rat, 0.001)))
  let As_req = rho * b * d

  // Min steel (ACI 7.6.1.1)
  const As_min = Math.max(0.0018 * b * tw, 0.0014 * b * tw)
  As_req = Math.max(As_req, As_min)

  // Select bar
  for (const dia of [10, 12, 16, 20]) {
    const a = Math.PI * (dia / 2) ** 2
    const s = Math.min(Math.floor(a / As_req * 1000 / 25) * 25, 300, 3 * tw)
    const n = Math.ceil(1000 / s)
    if (n * a >= As_req) {
      return { As: +(n * a).toFixed(0), bar: dia, spacing: s }
    }
  }
  return { As: As_req, bar: 16, spacing: 150 }
}

// ── Shear Check ───────────────────────────────────────────────

function checkShear(wu: number, L: number, support: string, tw: number, fc: number): {
  Vu: number; Vc: number; ok: boolean
} {
  const L_m = L / 1000
  const Vu  = support === 'simply_supported' ? wu * L_m / 2
    : wu * L_m / 2  // simplified
  const cc  = 25, bar = 12
  const d   = tw - cc - bar / 2
  const Vc  = PHI_SHEAR * 0.17 * Math.sqrt(fc) * 1000 * d / 1000  // kN/m
  return { Vu: +Vu.toFixed(2), Vc: +Vc.toFixed(2), ok: Vc >= Vu }
}

// ── Main Design ───────────────────────────────────────────────

export function designStaircase(input: StaircaseInput): StaircaseDesignResult {
  const warnings: string[] = []
  const geo     = calcGeometry(input)
  const cc      = 25   // mm — cover for interior stair

  // Min thickness check
  const h_min = minWaistThickness(geo.slantLength, input.supportType, input.fy)
  if (input.waistThick < h_min) {
    warnings.push(`Waist thickness ${input.waistThick}mm < min ${h_min}mm — increase`)
  }

  const SW   = selfWeight(input, geo.cosAngle)
  const wu   = factoredLoad(SW, input.finishLoad, input.LL)

  const Mu   = designMoment(wu, geo.slantLength, input.supportType, input.flightWidth)
  const main = calcMainSteel(Mu, input.waistThick, cc, input.fc, input.fy)

  // Distribution steel: As_dist = 0.0020 * tw * 1000 (T&S)
  const As_dist = 0.0020 * input.waistThick * 1000   // mm²/m
  const barDist = 10   // mm
  const sDist   = Math.min(Math.floor(Math.PI * (barDist / 2) ** 2 / As_dist * 1000 / 25) * 25, 300)

  const shear = checkShear(wu, geo.slantLength, input.supportType, input.waistThick, input.fc)
  if (!shear.ok) {
    warnings.push(`Shear FAIL: Vu=${shear.Vu} > φVc=${shear.Vc} kN/m — waist thickness বাড়ান`)
  }

  // Riser/tread checks (BNBC 2020)
  const riserOK = input.riser >= 100 && input.riser <= 180
  const treadOK = input.tread >= 250 && input.tread <= 350
  if (!riserOK) warnings.push(`Riser = ${input.riser}mm — BNBC: 100–180mm`)
  if (!treadOK) warnings.push(`Tread = ${input.tread}mm — BNBC: 250–350mm`)

  // 2R + T rule: 550–700mm
  const twoRT = 2 * input.riser + input.tread
  const twoRTOK = twoRT >= 550 && twoRT <= 700
  if (!twoRTOK) warnings.push(`2R+T = ${twoRT}mm — should be 550–700mm`)

  const d_eff = input.waistThick - cc - main.bar / 2

  const checks = [
    { name: 'Min waist h',     passed: input.waistThick >= h_min, value: input.waistThick, limit: h_min,   unit: 'mm' },
    { name: 'Shear φVc ≥ Vu', passed: shear.ok,  value: shear.Vc,  limit: shear.Vu,  unit: 'kN/m' },
    { name: 'Riser (100–180)', passed: riserOK,  value: input.riser, limit: 180,      unit: 'mm' },
    { name: 'Tread (250–350)', passed: treadOK,  value: input.tread, limit: 350,      unit: 'mm' },
    { name: '2R+T (550–700)',  passed: twoRTOK,  value: twoRT,       limit: 700,      unit: 'mm' },
  ]

  return {
    id: input.id, label: input.label,
    status: checks.every(c => c.passed) && shear.ok ? 'ok' : 'fail',
    flightLength: geo.flightLength,
    slantLength:  geo.slantLength,
    angle:        geo.angle,
    cosAngle:     geo.cosAngle,
    wu, selfWeight: SW,
    Mu,
    As_main:  main.As,  barMain: main.bar,  sMain:  main.spacing,
    As_dist:  +As_dist.toFixed(0), barDist, sDist,
    Vu: shear.Vu, Vc: shear.Vc, shearOK: shear.ok,
    d_eff, h_min,
    checks, warnings,
  }
}
