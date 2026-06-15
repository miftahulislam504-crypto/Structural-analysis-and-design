// ============================================================
// CivilOS Structural — Optimization Engine
// Phase 13: Cost & Material Optimization
// Over-design detection · Section rationalization
// Steel grade trade-off · Foundation depth optimization
// ============================================================

import {
  CivilOSProject,
  BeamDesign,
  ColumnDesign,
  SlabDesign,
  FoundationDesign,
  Beam,
  Column,
  Slab,
  Foundation,
} from '../../lib/types'
import { barArea } from '../../lib/utils'

// ─────────────────────────────────────────────
// OUTPUT TYPES
// ─────────────────────────────────────────────

export type OptimizationCategory =
  | 'over_design'
  | 'section_size'
  | 'steel_grade'
  | 'foundation'
  | 'material'

export type OptimizationSeverity = 'info' | 'suggestion' | 'recommended'

export interface OptimizationItem {
  id:           string
  memberId:     string
  memberLabel:  string
  memberType:   'beam' | 'column' | 'slab' | 'foundation'
  category:     OptimizationCategory
  severity:     OptimizationSeverity
  title:        string
  titleLocal:   string  // Bengali
  current:      string
  suggested:    string
  saving:       number       // BDT ৳ (estimated)
  savingUnit:   string       // '৳/m', '৳/column', '৳/footing'
  savingDetail: string
  utilization:  number       // 0–1 ratio of demand/capacity
  code:         string       // ACI / BNBC reference
}

export interface OptimizationSummary {
  totalItems:        number
  recommendedCount:  number
  suggestionCount:   number
  infoCount:         number
  estimatedSaving:   number   // total BDT ৳
  steelSavingKg:     number
  concreteReductionM3: number
  categoryBreakdown: Record<OptimizationCategory, number>
  overallRating:     'A' | 'B' | 'C' | 'D' | 'F'  // A=Very efficient, F=Highly over-designed
}

export interface OptimizationReport {
  generatedAt:   number
  projectId:     string
  items:         OptimizationItem[]
  summary:       OptimizationSummary
  globalNotes:   string[]
}

// ─────────────────────────────────────────────
// COST CONSTANTS (BDT — approximate 2024 rates)
// ─────────────────────────────────────────────

const COST = {
  concrete_m3:    8_500,   // ৳/m³ (M20 grade)
  steel_kg:       80,      // ৳/kg (Grade 60)
  steel_kg_g40:   75,      // ৳/kg (Grade 40)
  formwork_m2:    600,     // ৳/m² (beam/column)
  rebar_labor_kg: 12,      // ৳/kg labor
}

// ─────────────────────────────────────────────
// 1. BEAM OPTIMIZATION
// ─────────────────────────────────────────────

function analyzeBeam(
  beam: Beam,
  design: BeamDesign,
  fc: number,
  fy: number,
): OptimizationItem[] {
  const items: OptimizationItem[] = []

  const bw = (beam.section as any).width  ?? 250   // mm
  const h  = (beam.section as any).depth  ?? 450   // mm
  const cc = beam.clearCover

  // Steel utilization
  const As_pos_prov = design.flexure.bars_pos.noOfBars * barArea(design.flexure.bars_pos.barDiameter)
  const As_neg_prov = design.flexure.bars_neg.noOfBars * barArea(design.flexure.bars_neg.barDiameter)
  const As_pos_req  = design.flexure.As_pos_req
  const As_neg_req  = design.flexure.As_neg_req
  const As_min      = design.flexure.As_min

  // Utilization = max demand / provision
  const util_pos = As_pos_req / Math.max(As_pos_prov, 1)
  const util_neg = As_neg_req / Math.max(As_neg_prov, 1)
  const utilization = Math.max(util_pos, util_neg)

  // ── Check 1: Over-designed beam (utilization < 60%) ─────────
  if (utilization < 0.60 && design.status === 'ok') {
    // Suggest smaller depth
    const h_suggested = Math.ceil(h * utilization / 50) * 50   // round to 50mm
    const h_opt = Math.max(h_suggested, 300)
    const delta_h = h - h_opt

    if (delta_h >= 50) {
      const concreteSaved_m3 = (bw * delta_h) / 1e6  // per meter length
      const concreteCost     = concreteSaved_m3 * COST.concrete_m3  // ৳/m

      items.push({
        id:          `beam-depth-${beam.id}`,
        memberId:    beam.id,
        memberLabel: beam.label,
        memberType:  'beam',
        category:    'section_size',
        severity:    utilization < 0.45 ? 'recommended' : 'suggestion',
        title:       `Reduce Beam Depth: ${h}mm → ${h_opt}mm`,
        titleLocal:  `বিম গভীরতা কমান: ${h}মিমি → ${h_opt}মিমি`,
        current:     `${bw}×${h}mm (utilization ${(utilization*100).toFixed(0)}%)`,
        suggested:   `${bw}×${h_opt}mm`,
        saving:      Math.round(concreteCost),
        savingUnit:  '৳/m',
        savingDetail:`Concrete: ${(concreteSaved_m3*1000).toFixed(1)} L/m · ৳${Math.round(concreteCost)}/m`,
        utilization,
        code:        'ACI 318-19 §9.3',
      })
    }
  }

  // ── Check 2: Over-reinforced — reduce bar count ──────────────
  const excess_pos = As_pos_prov - Math.max(As_pos_req, As_min)
  const excess_neg = As_neg_prov - Math.max(As_neg_req, As_min)

  if (excess_pos > 200 && design.status === 'ok') {   // >200mm² excess
    const steelSaved_kg_per_m = (excess_pos / 1e6) * 7850  // ρ_steel ≈ 7850 kg/m³
    const cost = steelSaved_kg_per_m * (COST.steel_kg + COST.rebar_labor_kg)

    items.push({
      id:          `beam-steel-pos-${beam.id}`,
      memberId:    beam.id,
      memberLabel: beam.label,
      memberType:  'beam',
      category:    'over_design',
      severity:    'suggestion',
      title:       `Reduce Bottom Steel: ${design.flexure.bars_pos.noOfBars}#${design.flexure.bars_pos.barDiameter}`,
      titleLocal:  `নিচের রড কমান: ${design.flexure.bars_pos.noOfBars}টি #${design.flexure.bars_pos.barDiameter}`,
      current:     `As_prov = ${As_pos_prov.toFixed(0)} mm² (req: ${As_pos_req.toFixed(0)} mm²)`,
      suggested:   `As_req = ${As_pos_req.toFixed(0)} mm² — ${Math.ceil(As_pos_req / barArea(design.flexure.bars_pos.barDiameter))} bars`,
      saving:      Math.round(cost * 6),   // assume 6m avg span
      savingUnit:  '৳/beam',
      savingDetail: `Steel saved: ${(steelSaved_kg_per_m * 6).toFixed(1)} kg/beam`,
      utilization:  As_pos_req / As_pos_prov,
      code:         'ACI 318-19 §9.6.1',
    })
  }

  // ── Check 3: Steel grade upgrade trade-off ────────────────────
  // Using Grade 60 → Grade 75 could reduce bar count by ~20%
  if (fy === 420 && As_pos_req > 800) {
    const As_with_g75 = As_pos_req * (420 / 520)  // approximate
    const barsSaved_area = As_pos_req - As_with_g75
    const steelCost_diff_per_m = (barsSaved_area / 1e6) * 7850 * COST.steel_kg
    if (steelCost_diff_per_m > 10) {
      items.push({
        id:          `beam-grade-${beam.id}`,
        memberId:    beam.id,
        memberLabel: beam.label,
        memberType:  'beam',
        category:    'steel_grade',
        severity:    'info',
        title:       'Consider Grade 500 Steel (fy=500 MPa)',
        titleLocal:  'Grade 500 স্টিল বিবেচনা করুন (fy=500 MPa)',
        current:     `Grade 60 (fy=420 MPa), As_req = ${As_pos_req.toFixed(0)} mm²`,
        suggested:   `Grade 500, As_req ≈ ${As_with_g75.toFixed(0)} mm² — ${(20).toFixed(0)}% কম রড`,
        saving:      Math.round(steelCost_diff_per_m * 6),
        savingUnit:  '৳/beam',
        savingDetail: `Bar area reduction ~${((1-As_with_g75/As_pos_req)*100).toFixed(0)}%`,
        utilization,
        code:        'BNBC 2020 §2.6.2 — Grade 500 permissible',
      })
    }
  }

  return items
}

// ─────────────────────────────────────────────
// 2. COLUMN OPTIMIZATION
// ─────────────────────────────────────────────

function analyzeColumn(
  col: Column,
  design: ColumnDesign,
  fc: number,
): OptimizationItem[] {
  const items: OptimizationItem[] = []

  let Ag = 0, bw = 0, h = 0
  if (col.section.type === 'rectangular') {
    bw = col.section.width
    h  = col.section.depth
    Ag = bw * h
  } else {
    const d = (col.section as any).diameter
    Ag = Math.PI * d * d / 4
    bw = d; h = d
  }

  const Ast     = design.longitudinalBars.noOfBars * barArea(design.longitudinalBars.barDiameter)
  const rho_g   = Ast / Ag
  const Pu      = design.Pu
  const phiPn0  = design.phiPn0 ?? design.Pu ?? 1000   // kN

  const axial_util = Pu / Math.max(phiPn0, 1)

  // ── Check 1: Low axial utilization ───────────────────────────
  if (axial_util < 0.55 && design.status === 'ok') {
    // Suggest smaller section
    let bw_opt = 0, h_opt = 0
    if (col.section.type === 'rectangular') {
      bw_opt = Math.ceil(bw * Math.sqrt(axial_util) / 25) * 25
      h_opt  = Math.ceil(h  * Math.sqrt(axial_util) / 25) * 25
      // Enforce min 300mm
      bw_opt = Math.max(bw_opt, 300)
      h_opt  = Math.max(h_opt,  300)
    }

    const Ag_opt = bw_opt * h_opt
    const concreteSaved_m3 = ((Ag - Ag_opt) / 1e6)  // per meter height
    const steelSaved_kg    = ((Ast * 0.2) / 1e6) * 7850   // rho reduction ~20%
    const savings = concreteSaved_m3 * COST.concrete_m3 * 3 + steelSaved_kg * COST.steel_kg

    if (bw_opt < bw || h_opt < h) {
      items.push({
        id:          `col-section-${col.id}`,
        memberId:    col.id,
        memberLabel: col.label,
        memberType:  'column',
        category:    'section_size',
        severity:    axial_util < 0.40 ? 'recommended' : 'suggestion',
        title:       `Reduce Column: ${bw}×${h}mm → ${bw_opt}×${h_opt}mm`,
        titleLocal:  `কলাম ছোট করুন: ${bw}×${h}মিমি → ${bw_opt}×${h_opt}মিমি`,
        current:     `${bw}×${h}mm — Pu/φPn = ${(axial_util*100).toFixed(0)}%`,
        suggested:   `${bw_opt}×${h_opt}mm`,
        saving:      Math.round(savings),
        savingUnit:  '৳/column',
        savingDetail: `Concrete: ${(concreteSaved_m3*3*1000).toFixed(0)}L · Steel: ~${steelSaved_kg.toFixed(1)}kg`,
        utilization: axial_util,
        code:        'ACI 318-19 §22.4',
      })
    }
  }

  // ── Check 2: High steel ratio — reduce bars or upsize section ─
  if (rho_g > 0.04 && design.status === 'ok') {
    // Increase Ag to bring rho down to 3%
    const Ag_larger    = Ast / 0.03
    const dim_larger   = Math.ceil(Math.sqrt(Ag_larger) / 25) * 25
    const concreteCost = ((Ag_larger - Ag) / 1e6) * COST.concrete_m3 * 3
    const steelSaved   = ((rho_g - 0.03) * Ag / 1e6) * 7850 * COST.steel_kg

    items.push({
      id:          `col-rho-${col.id}`,
      memberId:    col.id,
      memberLabel: col.label,
      memberType:  'column',
      category:    'material',
      severity:    'suggestion',
      title:       `ρ_g = ${(rho_g*100).toFixed(1)}% high — increase section or reduce bars`,
      titleLocal:  `ρ_g = ${(rho_g*100).toFixed(1)}% বেশি — সেকশন বাড়ান অথবা রড কমান`,
      current:     `${bw}×${h}mm, ρ_g = ${(rho_g*100).toFixed(1)}%`,
      suggested:   `${dim_larger}×${dim_larger}mm → ρ_g ≈ 3%`,
      saving:      Math.max(0, Math.round(steelSaved - concreteCost)),
      savingUnit:  '৳/column',
      savingDetail: `Steel saving offsets concrete cost when ρ>4%`,
      utilization: rho_g / 0.08,
      code:        'ACI 318-19 §10.6.1.1',
    })
  }

  // ── Check 3: fc upgrade potential ─────────────────────────────
  if (fc < 25 && axial_util > 0.80 && design.status === 'ok') {
    const fc_up    = 28    // MPa
    const Ag_new   = Pu * 1000 / (0.80 * 0.65 * (0.85 * fc_up * (1 - rho_g) + 207 * rho_g))
    const dim_new  = Math.ceil(Math.sqrt(Ag_new) / 25) * 25
    const saved_m3 = Math.max(0, (Ag - dim_new * dim_new) / 1e6)
    const net_save = saved_m3 * COST.concrete_m3 * 3

    if (dim_new < bw && net_save > 0) {
      items.push({
        id:          `col-fc-${col.id}`,
        memberId:    col.id,
        memberLabel: col.label,
        memberType:  'column',
        category:    'material',
        severity:    'info',
        title:       `Upgrade f'c: ${fc}→${fc_up} MPa to reduce column size`,
        titleLocal:  `f'c বাড়ান ${fc}→${fc_up} MPa — কলাম ছোট করুন`,
        current:     `f'c=${fc} MPa, ${bw}×${h}mm`,
        suggested:   `f'c=${fc_up} MPa, ${dim_new}×${dim_new}mm`,
        saving:      Math.round(net_save),
        savingUnit:  '৳/column',
        savingDetail: `Higher fc → smaller section → net saving`,
        utilization: axial_util,
        code:        'ACI 318-19 §26.4.2',
      })
    }
  }

  return items
}

// ─────────────────────────────────────────────
// 3. SLAB OPTIMIZATION
// ─────────────────────────────────────────────

function analyzeSlab(
  slab: Slab,
  design: SlabDesign,
  fc: number,
  fy: number,
): OptimizationItem[] {
  const items: OptimizationItem[] = []

  const t   = slab.thickness  // mm
  const rho_x = (design.As_x_bot + design.As_x_top) / (t * 1000)  // mm²/mm² per unit width
  const rho_min_slab = 0.0018  // ACI 318-19 §24.4.3.2 (Grade 60 shrinkage)

  // Overall utilization — how far above minimum
  const utilization = Math.max(rho_x, design.As_y_bot / (t * 1000)) / (rho_min_slab * 3)

  // ── Check 1: Slab thickness reduction ────────────────────────
  // Minimum thickness per ACI 318-19 Table 7.3.1.1 (two-way)
  // Using span/33 heuristic for two-way interior panel
  if (design.type === 'two_way' && utilization < 0.70 && t > 120) {
    const t_min   = Math.ceil(t * 0.85 / 10) * 10   // 15% reduction, round to 10mm
    const t_opt   = Math.max(t_min, 110)
    const delta_t = t - t_opt

    if (delta_t >= 10) {
      const panel_area_m2 = 20  // assumed avg panel 4×5m
      const concreteSaved = (delta_t / 1000) * panel_area_m2 * COST.concrete_m3
      const steelSaved    = (rho_min_slab * delta_t * 1000 / 1e6) * 7850 * COST.steel_kg * panel_area_m2

      items.push({
        id:          `slab-thick-${slab.id}`,
        memberId:    slab.id,
        memberLabel: slab.label,
        memberType:  'slab',
        category:    'section_size',
        severity:    delta_t >= 20 ? 'recommended' : 'suggestion',
        title:       `Reduce Slab Thickness: ${t}mm → ${t_opt}mm`,
        titleLocal:  `স্ল্যাব পুরুত্ব কমান: ${t}মিমি → ${t_opt}মিমি`,
        current:     `t = ${t}mm`,
        suggested:   `t = ${t_opt}mm (ACI min OK)`,
        saving:      Math.round(concreteSaved + steelSaved),
        savingUnit:  '৳/panel',
        savingDetail: `Concrete: ${(delta_t * panel_area_m2 / 1000).toFixed(2)} m³ · Steel: ~${((rho_min_slab*delta_t*1000/1e6)*7850*panel_area_m2).toFixed(1)}kg`,
        utilization,
        code:        'ACI 318-19 §7.3.1.1',
      })
    }
  }

  return items
}

// ─────────────────────────────────────────────
// 4. FOUNDATION OPTIMIZATION
// ─────────────────────────────────────────────

function analyzeFoundation(
  foundation: Foundation,
  design: FoundationDesign,
  fc: number,
): OptimizationItem[] {
  const items: OptimizationItem[] = []

  const L   = foundation.length   // mm
  const W   = foundation.width    // mm
  const t   = foundation.thickness
  const qa  = foundation.soilBearingCapacity   // kN/m²

  // Bearing utilization
  const q_max    = design.bearingPressure.q_max
  const bear_util = q_max / qa

  // ── Check 1: Oversized footing ────────────────────────────────
  if (bear_util < 0.60 && design.status === 'ok') {
    const scale    = Math.sqrt(bear_util)
    const L_opt    = Math.ceil(L * scale / 100) * 100  // round to 100mm
    const W_opt    = Math.ceil(W * scale / 100) * 100
    const L_f      = Math.max(L_opt, 900)
    const W_f      = Math.max(W_opt, 900)

    const concreteSaved = ((L * W - L_f * W_f) / 1e6) * (t / 1000) * COST.concrete_m3
    const formworkSaved = ((L * W - L_f * W_f) / 1e6) * COST.formwork_m2

    if (L_f < L && W_f < W && concreteSaved > 0) {
      items.push({
        id:          `fdn-size-${foundation.id}`,
        memberId:    foundation.id,
        memberLabel: foundation.label,
        memberType:  'foundation',
        category:    'foundation',
        severity:    bear_util < 0.45 ? 'recommended' : 'suggestion',
        title:       `Reduce Footing: ${L/1000}×${W/1000}m → ${L_f/1000}×${W_f/1000}m`,
        titleLocal:  `ফুটিং ছোট করুন: ${L/1000}×${W/1000}মি → ${L_f/1000}×${W_f/1000}মি`,
        current:     `${L/1000}×${W/1000}m — q_max/qa = ${(bear_util*100).toFixed(0)}%`,
        suggested:   `${L_f/1000}×${W_f/1000}m`,
        saving:      Math.round(concreteSaved + formworkSaved),
        savingUnit:  '৳/footing',
        savingDetail: `Concrete: ${(concreteSaved/COST.concrete_m3).toFixed(2)} m³ · Formwork saved`,
        utilization: bear_util,
        code:        'Soil-structure optimization',
      })
    }
  }

  // ── Check 2: Foundation depth optimization ─────────────────────
  if (foundation.depth > 1800 && bear_util < 0.70 && design.status === 'ok') {
    items.push({
      id:          `fdn-depth-${foundation.id}`,
      memberId:    foundation.id,
      memberLabel: foundation.label,
      memberType:  'foundation',
      category:    'foundation',
      severity:    'info',
      title:       `Foundation depth ${foundation.depth/1000}m — consider reducing`,
      titleLocal:  `ফাউন্ডেশন গভীরতা ${foundation.depth/1000}মি — কমানোর সুযোগ`,
      current:     `Depth = ${foundation.depth/1000}m`,
      suggested:   `Depth = ${Math.max(1.2, foundation.depth/1000 - 0.3)}m (verify with geotechnical report)`,
      saving:      Math.round(0.3 * (L / 1000) * (W / 1000) * COST.concrete_m3 * 0.5),
      savingUnit:  '৳/footing',
      savingDetail: 'Earthwork + concrete saving — confirm soil stratum',
      utilization: bear_util,
      code:        'Geotechnical + BNBC §2.7',
    })
  }

  return items
}

// ─────────────────────────────────────────────
// 5. GLOBAL PROJECT CHECKS
// ─────────────────────────────────────────────

function analyzeGlobal(project: CivilOSProject): string[] {
  const notes: string[] = []
  const { members, materials, loads } = project

  // Uniform column sizes
  const colSizes = new Set(
    members.columns.map(c =>
      c.section.type === 'rectangular'
        ? `${(c.section as any).width}x${(c.section as any).depth}`
        : `D${(c.section as any).diameter}`
    )
  )
  if (colSizes.size > 5) {
    notes.push(
      `Column sections (${colSizes.size} unique sizes) — standardize to 2–3 sizes for cost efficiency and formwork reuse.`
    )
  }

  // Concrete grade consistency
  if (materials.concrete.fc < 21) {
    notes.push(
      `f'c = ${materials.concrete.fc} MPa is low for high-rise work — consider f'c ≥ 25 MPa for columns (reduces section sizes, improves durability per BNBC §3.1.2).`
    )
  }

  // Live load — check if using conservative values
  const ll = loads.liveLoad.liveLoad
  if (ll > 4.0) {
    notes.push(
      `Live load ${ll} kN/m² — verify BNBC 2020 Table 6.2.2 for occupancy type; over-specification increases all member sizes.`
    )
  }

  // Check seismic R factor
  const R = loads.seismicLoad.responseModificationFactor
  if (R < 5) {
    notes.push(
      `Seismic R = ${R} — SMRF system allows R = 8. Higher R reduces seismic forces by ${((1 - 5/8)*100).toFixed(0)}%, reducing lateral design loads.`
    )
  }

  return notes
}

// ─────────────────────────────────────────────
// MAIN ENGINE FUNCTION
// ─────────────────────────────────────────────

export function runOptimization(project: CivilOSProject): OptimizationReport {
  const { members, design, materials } = project
  const fc = materials.concrete.fc
  const fy = materials.steel.fy

  const allItems: OptimizationItem[] = []

  // Beams
  for (const d of design.beamDesigns) {
    const beam = members.beams.find(b => b.id === d.beamId)
    if (beam && d.status !== 'pending') {
      allItems.push(...analyzeBeam(beam, d, fc, fy))
    }
  }

  // Columns
  for (const d of design.columnDesigns) {
    const col = members.columns.find(c => c.id === d.columnId)
    if (col && d.status !== 'pending') {
      allItems.push(...analyzeColumn(col, d, fc))
    }
  }

  // Slabs
  for (const d of design.slabDesigns) {
    const slab = members.slabs.find(s => s.id === d.slabId)
    if (slab && d.status !== 'pending') {
      allItems.push(...analyzeSlab(slab, d, fc, fy))
    }
  }

  // Foundations
  for (const d of design.foundationDesigns) {
    const fdn = members.foundations.find(f => f.id === d.foundationId)
    if (fdn && d.status !== 'pending') {
      allItems.push(...analyzeFoundation(fdn, d, fc))
    }
  }

  const globalNotes = analyzeGlobal(project)

  // Summary
  const recommended  = allItems.filter(i => i.severity === 'recommended').length
  const suggestions  = allItems.filter(i => i.severity === 'suggestion').length
  const infoCount    = allItems.filter(i => i.severity === 'info').length
  const totalSaving  = allItems.reduce((s, i) => s + i.saving, 0)

  // Rough material quantities
  const steelSavingKg = allItems
    .filter(i => i.category === 'over_design' || i.category === 'steel_grade')
    .reduce((s, i) => s + i.saving / COST.steel_kg, 0)

  const concreteM3 = allItems
    .filter(i => i.category === 'section_size' || i.category === 'foundation')
    .reduce((s, i) => s + i.saving / COST.concrete_m3 * 0.5, 0)

  // Category breakdown
  const categoryBreakdown: Record<OptimizationCategory, number> = {
    over_design: 0, section_size: 0, steel_grade: 0, foundation: 0, material: 0
  }
  for (const item of allItems) {
    categoryBreakdown[item.category] = (categoryBreakdown[item.category] ?? 0) + 1
  }

  // Rating
  const totalMembers = members.beams.length + members.columns.length + members.slabs.length + members.foundations.length
  const issueRatio   = totalMembers > 0 ? allItems.length / totalMembers : 0

  const overallRating: OptimizationReport['summary']['overallRating'] =
    issueRatio < 0.10 ? 'A' :
    issueRatio < 0.25 ? 'B' :
    issueRatio < 0.45 ? 'C' :
    issueRatio < 0.65 ? 'D' : 'F'

  return {
    generatedAt: Date.now(),
    projectId:   project.id,
    items:       allItems,
    globalNotes,
    summary: {
      totalItems:          allItems.length,
      recommendedCount:    recommended,
      suggestionCount:     suggestions,
      infoCount,
      estimatedSaving:     totalSaving,
      steelSavingKg:       +steelSavingKg.toFixed(1),
      concreteReductionM3: +concreteM3.toFixed(2),
      categoryBreakdown,
      overallRating,
    },
  }
}
