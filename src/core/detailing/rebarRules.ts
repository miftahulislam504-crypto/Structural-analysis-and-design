// ============================================================
// CivilOS Structural — Rebar Detailing Rules Engine
// Phase 8: ACI 318-19 Development Length, Splices, Hooks
// §25.4 Development · §25.5 Splices · §25.3 Hooks
// ============================================================

// ── Development Length (ACI 318-19 §25.4.2) ──────────────────

export interface DevLengthInput {
  barDia:     number   // mm
  fy:         number   // MPa — bar yield strength
  fc:         number   // MPa — concrete strength
  lambda:     number   // 1.0 normal weight
  psi_t:      number   // 1.3 top bar, 1.0 other
  psi_e:      number   // 1.5 epoxy coated, 1.0 uncoated
  psi_s:      number   // 0.8 for ≤19mm, 1.0 for >19mm
  cb:         number   // mm — smaller of cover or half c-c spacing
  Ktr:        number   // transverse reinforcement index (0 = conservative)
}

export interface DevLengthResult {
  ld:          number   // mm — development length
  ld_min:      number   // mm — ACI minimum (300mm)
  ld_used:     number   // mm — governing
  formula:     string
  confinement: number   // (cb + Ktr) / db
}

export function calcDevLength(input: DevLengthInput): DevLengthResult {
  const { barDia: db, fy, fc, lambda, psi_t, psi_e, psi_s, cb, Ktr } = input

  // Confinement term (ACI 25.4.2.3): limit (cb + Ktr)/db ≤ 2.5
  const conf = Math.min((cb + Ktr) / db, 2.5)

  // ld = (3/40) * (fy / (λ√fc)) * (ψt·ψe·ψs / ((cb+Ktr)/db)) * db
  const ld = (3 / 40) * (fy / (lambda * Math.sqrt(fc))) *
             (psi_t * psi_e * psi_s / conf) * db

  const ld_min = 300  // mm ACI minimum

  return {
    ld:          +ld.toFixed(0),
    ld_min,
    ld_used:     +Math.max(ld, ld_min).toFixed(0),
    formula:     `ld = (3/40)·(fy/λ√fc)·(ψt·ψe·ψs/(cb+Ktr)/db)·db`,
    confinement: +conf.toFixed(2),
  }
}

// ── Standard Hook Development Length (ACI 25.4.3) ────────────

export interface HookDevLengthResult {
  ldh:      number   // mm — hook development length
  ldh_min:  number   // mm — ACI minimum
  ldh_used: number   // mm — governing
  hookExt:  number   // mm — 12db extension
  bendDia:  number   // mm — minimum bend diameter
}

export function calcHookDevLength(
  db: number,    // mm
  fy: number,    // MPa
  fc: number,    // MPa
  lambda: number,
  cover: number  // mm — side cover to hook
): HookDevLengthResult {
  // ACI 25.4.3.1: ldh = (0.24·ψe·ψr·ψo·ψc·fy / (λ·√fc)) * db
  // Simplified with ψe=1.0, ψr=1.0, ψo=1.0, ψc=1.0 (conservative)
  const ldh = (0.24 * 1.0 * 1.0 * 1.0 * 1.0 * fy / (lambda * Math.sqrt(fc))) * db

  // Min (ACI 25.4.3.1c): max(8db, 150mm)
  const ldh_min = Math.max(8 * db, 150)

  // Hook geometry
  const hookExt  = 12 * db  // mm — 90° hook extension
  const bendDia  = db <= 25 ? 6 * db : db <= 32 ? 8 * db : 10 * db  // Table 25.3.2

  return {
    ldh:      +ldh.toFixed(0),
    ldh_min,
    ldh_used: +Math.max(ldh, ldh_min).toFixed(0),
    hookExt:  +hookExt.toFixed(0),
    bendDia:  +bendDia.toFixed(0),
  }
}

// ── Lap Splice Length (ACI 318-19 §25.5) ─────────────────────

export type SpliceClass = 'A' | 'B'

export interface LapSpliceResult {
  spliceClass: SpliceClass
  ls:          number   // mm — lap splice length
  ls_min:      number   // mm — ACI minimum
  ls_used:     number   // mm — governing
  ratio:       string   // splice class explanation
}

export function calcLapSplice(
  db: number,
  fy: number,
  fc: number,
  lambda: number,
  psi_t: number,
  psi_e: number,
  psi_s: number,
  cb: number,
  Ktr: number,
  As_provided: number,   // mm²
  As_required: number    // mm²
): LapSpliceResult {
  const dev = calcDevLength({ barDia: db, fy, fc, lambda, psi_t, psi_e, psi_s, cb, Ktr })
  const ld  = dev.ld_used

  // Class A: As_prov ≥ 2·As_req AND ≤ 50% of bars spliced → ls = 1.0·ld
  // Class B: otherwise → ls = 1.3·ld
  const ratio_ok = As_provided >= 2 * As_required
  const spliceClass: SpliceClass = ratio_ok ? 'A' : 'B'
  const factor = spliceClass === 'A' ? 1.0 : 1.3
  const ls = factor * ld
  const ls_min = 300

  return {
    spliceClass,
    ls:      +ls.toFixed(0),
    ls_min,
    ls_used: +Math.max(ls, ls_min).toFixed(0),
    ratio:   ratio_ok
      ? 'Class A: As_prov ≥ 2·As_req → ls = 1.0·ld'
      : 'Class B: As_prov < 2·As_req → ls = 1.3·ld',
  }
}

// ── Beam Detailing Rules ──────────────────────────────────────

export interface BeamDetailingRules {
  // Longitudinal
  ld_pos:       DevLengthResult    // bottom bar dev length (positive moment)
  ld_neg:       DevLengthResult    // top bar dev length (negative moment)
  ldh_pos:      HookDevLengthResult
  ldh_neg:      HookDevLengthResult
  lap_pos:      LapSpliceResult
  lap_neg:      LapSpliceResult

  // Cutoff points
  cutoff_pos:   number   // mm from support — bottom bars can be cut
  cutoff_neg:   number   // mm from face — top bars extend beyond

  // Stirrup zones
  zone1_length: number   // mm — seismic end zone
  zone1_spacing: number  // mm
  zone2_spacing: number  // mm — mid zone

  // Seismic hooks (ACI 18.6.3)
  stirrupHookAngle: 135 | 90
  stirrupExtension: number  // mm — 6db or 75mm min
}

export function calcBeamDetailingRules(
  span:    number,   // mm
  db_pos:  number,   // mm — bottom bar dia
  db_neg:  number,   // mm — top bar dia
  db_stir: number,   // mm — stirrup dia
  s_end:   number,   // mm — stirrup spacing at end
  s_mid:   number,   // mm — stirrup spacing mid
  fy:      number,
  fc:      number,
  cc:      number,   // mm — clear cover
  seismicZone: 1|2|3
): BeamDetailingRules {
  const lambda = 1.0
  const cb_pos = cc + db_stir + db_pos / 2
  const cb_neg = cc + db_stir + db_neg / 2

  const ld_pos = calcDevLength({ barDia: db_pos, fy, fc, lambda, psi_t: 1.0, psi_e: 1.0, psi_s: db_pos <= 19 ? 0.8 : 1.0, cb: cb_pos, Ktr: 0 })
  const ld_neg = calcDevLength({ barDia: db_neg, fy, fc, lambda, psi_t: 1.3, psi_e: 1.0, psi_s: db_neg <= 19 ? 0.8 : 1.0, cb: cb_neg, Ktr: 0 })
  const ldh_pos = calcHookDevLength(db_pos, fy, fc, lambda, cc)
  const ldh_neg = calcHookDevLength(db_neg, fy, fc, lambda, cc)

  const As_pos = Math.PI * (db_pos / 2) ** 2 * 2   // 2 bars assumed
  const As_neg = Math.PI * (db_neg / 2) ** 2 * 2

  const lap_pos = calcLapSplice(db_pos, fy, fc, lambda, 1.0, 1.0, db_pos <= 19 ? 0.8 : 1.0, cb_pos, 0, As_pos * 2, As_pos)
  const lap_neg = calcLapSplice(db_neg, fy, fc, lambda, 1.3, 1.0, db_neg <= 19 ? 0.8 : 1.0, cb_neg, 0, As_neg * 2, As_neg)

  // Cutoff: ACI 9.7.3 — extend ld beyond theoretical cutoff point
  // Bottom: cut at L/5 from support (Mu diagram crossing)
  // Top: extend ln/3 from face of support into span
  const cutoff_pos = Math.max(span / 5, ld_pos.ld_used)
  const cutoff_neg = Math.max(span / 3, ld_neg.ld_used)

  // Seismic zone — ACI 18.6.4: confinement zone = 2h from face
  // Simplified: use stirrup spacing from Phase 6
  const zone1_length = seismicZone >= 2 ? 2 * 450 : 450  // 2h
  const stirrupHookAngle: 135 | 90 = seismicZone >= 2 ? 135 : 90
  const stirrupExtension = Math.max(6 * db_stir, 75)  // ACI 25.3.4

  return {
    ld_pos, ld_neg, ldh_pos, ldh_neg, lap_pos, lap_neg,
    cutoff_pos: +cutoff_pos.toFixed(0),
    cutoff_neg: +cutoff_neg.toFixed(0),
    zone1_length: +zone1_length.toFixed(0),
    zone1_spacing: s_end,
    zone2_spacing: s_mid,
    stirrupHookAngle,
    stirrupExtension,
  }
}

// ── Column Detailing Rules ────────────────────────────────────

export interface ColumnDetailingRules {
  ld:             DevLengthResult
  lap:            LapSpliceResult
  lap_zone:       string   // where to splice (mid-height)
  tie_spacing_end: number  // mm — seismic confinement zone
  tie_spacing_mid: number  // mm — mid zone
  confinement_len: number  // mm — ACI 18.7.5.1
  ties_at_joint:  boolean
  joint_ties:     string
}

export function calcColumnDetailingRules(
  db:          number,   // mm — main bar dia
  db_tie:      number,   // mm — tie dia
  colDim:      number,   // mm — least column dimension
  lu:          number,   // mm — unsupported length
  fy:          number,
  fc:          number,
  cc:          number,
  seismicZone: 1|2|3
): ColumnDetailingRules {
  const lambda = 1.0
  const cb     = cc + db_tie + db / 2

  const ld  = calcDevLength({ barDia: db, fy, fc, lambda, psi_t: 1.0, psi_e: 1.0, psi_s: db <= 19 ? 0.8 : 1.0, cb, Ktr: 0 })
  const As  = Math.PI * (db / 2) ** 2 * 4
  const lap = calcLapSplice(db, fy, fc, lambda, 1.0, 1.0, db <= 19 ? 0.8 : 1.0, cb, 0, As * 1.5, As)

  // ACI 25.5.5: column compressive lap = 0.5·ld or 300mm min, in compression zone
  const lap_zone = 'Mid-height of column (away from beam-column joint) — compression zone'

  // Tie spacing (ACI 25.7.2.1)
  const s_mid = Math.min(16 * db, 48 * db_tie, colDim)

  // Seismic confinement (ACI 18.7.5.1)
  const s_end_seismic = Math.min(colDim / 4, 6 * db, 150)
  const s_end = seismicZone >= 2 ? s_end_seismic : s_mid

  // Confinement zone length (ACI 18.7.5.1): max(lu/6, max_dim, 450mm)
  const maxDim = colDim
  const conf_len = seismicZone >= 2
    ? Math.max(lu / 6, maxDim, 450)
    : colDim

  return {
    ld, lap,
    lap_zone,
    tie_spacing_end: +Math.floor(s_end / 25) * 25,
    tie_spacing_mid: +Math.floor(s_mid / 25) * 25,
    confinement_len: +conf_len.toFixed(0),
    ties_at_joint:   seismicZone >= 2,
    joint_ties:      seismicZone >= 2
      ? 'Provide ties within beam-column joint (ACI 18.8.3)'
      : 'Standard ties at joint',
  }
}
