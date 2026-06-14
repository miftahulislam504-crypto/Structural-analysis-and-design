// ============================================================
// CivilOS Structural — Pile Foundation Design
// Phase 7: IS 2911 / Tomlinson Method
// Bored Cast-in-situ Piles — Skin Friction + End Bearing
// ============================================================

export interface SoilLayer {
  id:         string
  name:       string
  thickness:  number   // m
  type:       'clay' | 'sand' | 'gravel' | 'silt' | 'rock'
  cu:         number   // kPa — undrained shear strength (clay)
  phi:        number   // degrees — friction angle (sand)
  gamma:      number   // kN/m³ — unit weight
  N_spt:      number   // SPT N-value
}

export interface PileInput {
  id:         string
  label:      string
  diameter:   number   // mm
  length:     number   // mm
  pileType:   'bored' | 'driven' | 'precast'
  soilLayers: SoilLayer[]
  Pu:         number   // kN — factored column load
  fc:         number   // MPa — pile concrete
  fy:         number   // MPa — pile steel
  noOfPiles:  number   // per cap
}

export interface PileCapacityResult {
  id:         string
  label:      string
  status:     'ok' | 'fail' | 'pending'

  // Capacity
  Qs:         number   // kN — total skin friction
  Qb:         number   // kN — end bearing
  Qu:         number   // kN — ultimate capacity
  Qa:         number   // kN — allowable (Qu/FOS)
  FOS:        number
  Qa_group:   number   // kN — group capacity

  // Structural capacity
  Pn_struct:  number   // kN — structural axial capacity
  phiPn:      number   // kN

  // Settlement
  settlement: number   // mm — estimated

  // Layer breakdown
  layers:     { name: string; depth: number; qs: number; fs: number }[]

  // Pile cap
  capL:       number   // mm
  capB:       number   // mm
  capT:       number   // mm

  checks:     { name: string; passed: boolean; value: number; limit: number; unit: string }[]
  warnings:   string[]
}

const FOS_PILE = 2.5   // Factor of safety for pile capacity

// ── Skin Friction ─────────────────────────────────────────────

function skinFriction(
  layer: SoilLayer,
  depth_top: number,   // m
  D: number,           // m pile diameter
  pileType: string
): number {
  const dz   = layer.thickness   // m
  const fs   = unitSkinFriction(layer, depth_top + dz / 2, pileType)  // kPa
  const As   = Math.PI * D * dz  // m²
  return fs * As  // kN
}

function unitSkinFriction(
  layer: SoilLayer,
  z: number,           // m — depth to mid-layer
  pileType: string
): number {
  if (layer.type === 'clay' || layer.type === 'silt') {
    // α method: fs = α * cu
    const alpha = layer.cu <= 25 ? 1.0
      : layer.cu <= 70 ? 0.5 + 0.5 * (70 - layer.cu) / 45
      : 0.5
    return alpha * layer.cu
  }

  if (layer.type === 'sand' || layer.type === 'gravel') {
    // β method: fs = Ks * σv' * tan(δ)
    const K_s    = pileType === 'driven' ? 1.0 : 0.7   // earth pressure coeff
    const delta  = layer.phi * 0.8 * Math.PI / 180       // interface friction rad
    const sigma_v = layer.gamma * z  // kPa (effective — simplified)
    const fs     = Math.min(K_s * sigma_v * Math.tan(delta), 120)  // kPa cap
    return fs
  }

  if (layer.type === 'rock') return 0  // no skin friction in rock for bored piles
  return 0
}

// ── End Bearing ───────────────────────────────────────────────

function endBearing(
  layer: SoilLayer,
  D: number,           // m pile diameter
  depth: number,       // m — pile tip depth
  pileType: string
): number {
  const Ab = Math.PI * (D / 2) ** 2  // m²

  if (layer.type === 'rock') {
    // Bearing on rock: qb = qu (unconfined compressive strength)
    // Simplified: qu = 10 * cu for rock
    const qu = layer.cu * 10  // kPa
    return Math.min(qu * Ab, 5000 * Ab)  // kN (cap at 5000 kPa)
  }

  if (layer.type === 'clay') {
    // qb = 9 * cu (Skempton)
    return 9 * layer.cu * Ab  // kN
  }

  // Sand/gravel: qb = Nq * σv'
  const phi_rad = layer.phi * Math.PI / 180
  const Nq = Math.exp(Math.PI * Math.tan(phi_rad)) * Math.tan(Math.PI / 4 + phi_rad / 2) ** 2
  const sigma_v = layer.gamma * depth  // kPa
  const qb = Math.min(Nq * sigma_v, 15000)  // kPa cap
  return qb * Ab  // kN
}

// ── Structural Capacity (ACI 318 §22.8) ──────────────────────

function structuralCapacity(input: PileInput): { Pn: number; phiPn: number } {
  const D  = input.diameter / 1000  // m
  const Ag = Math.PI * (D / 2) ** 2 * 1e6  // mm²
  const rho_st = 0.02  // 2% steel (typical for piles)
  const Ast    = rho_st * Ag
  const Pn0    = 0.85 * input.fc * (Ag - Ast) + input.fy * Ast  // N
  const phiPn0 = 0.65 * 0.80 * Pn0 / 1000  // kN (tied pile)
  return { Pn: Pn0 / 1000, phiPn: phiPn0 }
}

// ── Pile Cap Sizing ───────────────────────────────────────────

function sizePileCap(D: number, n: number): { capL: number; capB: number; capT: number } {
  // Pile spacing: 3D (ACI 13.5.4 / IS 2911)
  const s = 3 * D   // mm
  const edge = 1.5 * D  // mm

  let capL = 0, capB = 0
  if (n === 1) { capL = D + 2 * edge; capB = capL }
  else if (n === 2) { capL = s + 2 * edge; capB = D + 2 * edge }
  else if (n === 3) { capL = s + 2 * edge; capB = 0.866 * s + 2 * edge }
  else if (n === 4) { capL = s + 2 * edge; capB = capL }
  else { capL = (Math.ceil(Math.sqrt(n)) - 1) * s + 2 * edge; capB = capL }

  // Cap thickness: max(D, 600mm) + 100mm cover
  const capT = Math.max(D, 600) + 200

  return { capL: Math.round(capL), capB: Math.round(capB), capT: Math.round(capT) }
}

// ── Settlement Estimate (Elastic method simplified) ───────────

function estimateSettlement(Qu: number, D: number, L: number, soilLayers: SoilLayer[]): number {
  // Vesic elastic method: s = Qwp/(D*qp*Cp) + Qws*Cs/(L*qs)
  // Simplified elastic: s ≈ 0.5 * q / (Es * D) for typical soil
  const avgEs = soilLayers.reduce((sum, l) => {
    const Es_layer = l.type === 'rock' ? 500000
      : l.type === 'gravel' ? 80000
      : l.type === 'sand' ? l.N_spt * 1000
      : l.type === 'clay' ? l.cu * 200
      : 5000  // silt
    return sum + Es_layer * l.thickness
  }, 0) / soilLayers.reduce((s, l) => s + l.thickness, 0)  // kPa

  const Qa    = Qu / FOS_PILE  // kN allowable
  const q_avg = Qa / (Math.PI * (D / 2) ** 2) * 1e6  // kPa → Pa
  const settlement = (q_avg * D / 1000) / avgEs * 1000  // mm

  return Math.min(+settlement.toFixed(1), 50)  // cap at 50mm
}

// ── Main Design ───────────────────────────────────────────────

export function designPile(input: PileInput): PileCapacityResult {
  const warnings: string[] = []
  const D  = input.diameter / 1000  // m
  const L  = input.length  / 1000  // m
  const n  = input.noOfPiles

  let Qs = 0, depth = 0
  const layerResults: PileCapacityResult['layers'] = []

  // Accumulate skin friction through layers up to pile length
  for (const layer of input.soilLayers) {
    if (depth >= L) break
    const effectiveThick = Math.min(layer.thickness, L - depth)
    const layerWithActualThick = { ...layer, thickness: effectiveThick }
    const qs_layer = skinFriction(layerWithActualThick, depth, D, input.pileType)
    const fs_unit  = unitSkinFriction(layer, depth + effectiveThick / 2, input.pileType)
    Qs += qs_layer
    layerResults.push({
      name:  layer.name,
      depth: depth + effectiveThick,
      qs:    +qs_layer.toFixed(1),
      fs:    +fs_unit.toFixed(1),
    })
    depth += effectiveThick
  }

  // End bearing at pile tip
  const tipLayer = input.soilLayers.find((_, i) => {
    let d = 0
    for (let j = 0; j <= i; j++) d += input.soilLayers[j].thickness
    return d >= L
  }) ?? input.soilLayers.at(-1)!
  const Qb = endBearing(tipLayer, D, L, input.pileType)

  const Qu = Qs + Qb
  const Qa = Qu / FOS_PILE

  // Group capacity (simplified — Qs efficiency for >4 piles)
  const eff     = n > 4 ? 0.85 : 1.0
  const Qa_group = Qa * n * eff

  // Structural capacity
  const struct = structuralCapacity(input)

  // Settlement
  const settlement = estimateSettlement(Qu, D * 1000, L * 1000, input.soilLayers)
  if (settlement > 25) warnings.push(`Settlement = ${settlement}mm > 25mm — settle check needed`)

  // Pile cap
  const cap = sizePileCap(input.diameter, n)

  // Checks
  const Pu_per_pile = input.Pu / n
  const checks = [
    { name: 'Qa ≥ Pu/pile',    passed: Qa >= Pu_per_pile,   value: Qa,          limit: Pu_per_pile, unit: 'kN' },
    { name: 'Group capacity',  passed: Qa_group >= input.Pu, value: Qa_group,    limit: input.Pu,    unit: 'kN' },
    { name: 'φPn_struct ≥ Pu', passed: struct.phiPn >= Pu_per_pile, value: struct.phiPn, limit: Pu_per_pile, unit: 'kN' },
    { name: 'Settlement ≤ 25mm', passed: settlement <= 25,  value: settlement,  limit: 25,          unit: 'mm' },
    { name: 'Min pile dia',    passed: input.diameter >= 300, value: input.diameter, limit: 300,     unit: 'mm' },
  ]

  if (Qa < Pu_per_pile) warnings.push(`Pile capacity Qa=${Qa.toFixed(0)} kN < Pu/pile=${Pu_per_pile.toFixed(0)} kN — pile length বাড়ান`)

  return {
    id: input.id, label: input.label,
    status: checks.every(c => c.passed) ? 'ok' : 'fail',
    Qs: +Qs.toFixed(1), Qb: +Qb.toFixed(1),
    Qu: +Qu.toFixed(1), Qa: +Qa.toFixed(1),
    FOS: FOS_PILE,
    Qa_group: +Qa_group.toFixed(1),
    Pn_struct: +struct.Pn.toFixed(1),
    phiPn:     +struct.phiPn.toFixed(1),
    settlement,
    layers: layerResults,
    capL: cap.capL, capB: cap.capB, capT: cap.capT,
    checks, warnings,
  }
}
