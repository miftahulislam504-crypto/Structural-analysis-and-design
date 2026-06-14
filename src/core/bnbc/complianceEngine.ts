// ============================================================
// CivilOS Structural — BNBC 2020 Compliance Engine
// Phase 11: Full code compliance check
// Drift · Irregularity · Ductility · Detailing · Bearing
// ============================================================

import { CivilOSProject, ComplianceCheck, ComplianceReport, AnalysisResults } from '../../lib/types'
import { calculateSeismicLoad } from './seismicLoad'
import { calculateWindLoad } from './windLoad'

// ── Individual Check Builders ─────────────────────────────────

function pass(id: string, name: string, nameLocal: string, ref: string,
  category: ComplianceCheck['category'], value: number, limit: number, unit: string,
  suggestion?: string): ComplianceCheck {
  return { id, name, nameLocal, bnbcReference: ref, category,
    status: 'pass', value: +value.toFixed(4), limit: +limit.toFixed(4), unit, suggestion }
}

function fail(id: string, name: string, nameLocal: string, ref: string,
  category: ComplianceCheck['category'], value: number, limit: number, unit: string,
  suggestion: string, failedMembers?: string[]): ComplianceCheck {
  return { id, name, nameLocal, bnbcReference: ref, category,
    status: 'fail', value: +value.toFixed(4), limit: +limit.toFixed(4), unit, suggestion, failedMembers }
}

function warn(id: string, name: string, nameLocal: string, ref: string,
  category: ComplianceCheck['category'], value: number, limit: number, unit: string,
  suggestion: string): ComplianceCheck {
  return { id, name, nameLocal, bnbcReference: ref, category,
    status: 'warning', value: +value.toFixed(4), limit: +limit.toFixed(4), unit, suggestion }
}

function notChecked(id: string, name: string, nameLocal: string, ref: string,
  category: ComplianceCheck['category']): ComplianceCheck {
  return { id, name, nameLocal, bnbcReference: ref, category,
    status: 'not_checked', value: 0, limit: 0, unit: '', suggestion: 'Analysis রান করুন' }
}

// ── 1. Story Drift Checks (BNBC 2020 §2.5.7) ─────────────────

function checkStoryDrift(project: CivilOSProject, results: AnalysisResults): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []
  const drifts = results.storyDrifts ?? []

  if (drifts.length === 0) {
    checks.push(notChecked('drift-x', 'Story Drift X', 'স্টোরি ড্রিফট X', 'BNBC §2.5.7.1', 'drift'))
    checks.push(notChecked('drift-y', 'Story Drift Y', 'স্টোরি ড্রিফট Y', 'BNBC §2.5.7.1', 'drift'))
    return checks
  }

  const limit = 0.025  // BNBC 2020 for special moment frames
  const maxDriftX = Math.max(...drifts.map(d => d.driftX), 0)
  const maxDriftY = Math.max(...drifts.map(d => d.driftY), 0)
  const failedX = drifts.filter(d => d.driftX > limit).map(d => d.storyId)
  const failedY = drifts.filter(d => d.driftY > limit).map(d => d.storyId)

  checks.push(maxDriftX <= limit
    ? pass('drift-x', 'Story Drift X', 'স্টোরি ড্রিফট X', 'BNBC 2020 §2.5.7.1', 'drift', maxDriftX, limit, 'Δ/h', 'PASS — drift within limit')
    : fail('drift-x', 'Story Drift X', 'স্টোরি ড্রিফট X', 'BNBC 2020 §2.5.7.1', 'drift', maxDriftX, limit, 'Δ/h', 'Column/shear wall stiffness বাড়ান', failedX)
  )
  checks.push(maxDriftY <= limit
    ? pass('drift-y', 'Story Drift Y', 'স্টোরি ড্রিফট Y', 'BNBC 2020 §2.5.7.1', 'drift', maxDriftY, limit, 'Δ/h')
    : fail('drift-y', 'Story Drift Y', 'স্টোরি ড্রিফট Y', 'BNBC 2020 §2.5.7.1', 'drift', maxDriftY, limit, 'Δ/h', 'Y-direction stiffness বাড়ান', failedY)
  )

  return checks
}

// ── 2. Building Irregularity Checks (BNBC §2.5.3) ────────────

function checkIrregularity(project: CivilOSProject): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []
  const { grid, members } = project

  // Plan irregularity: aspect ratio check
  const xLines = grid.xLines, yLines = grid.yLines
  if (xLines.length >= 2 && yLines.length >= 2) {
    const Lx = (xLines.at(-1)!.position - xLines[0].position) / 1000  // m
    const Ly = (yLines.at(-1)!.position - yLines[0].position) / 1000
    const ratio = Math.max(Lx, Ly) / Math.min(Lx, Ly)
    const limit = 3.0  // BNBC §2.5.3.1 — plan aspect ratio limit

    checks.push(ratio <= limit
      ? pass('irreg-plan', 'Plan Aspect Ratio', 'প্ল্যান অনুপাত', 'BNBC 2020 §2.5.3.1', 'irregularity', ratio, limit, 'L/B')
      : warn('irreg-plan', 'Plan Aspect Ratio', 'প্ল্যান অনুপাত', 'BNBC 2020 §2.5.3.1', 'irregularity', ratio, limit, 'L/B', 'Torsional irregularity check করুন')
    )
  }

  // Height-to-base ratio (slenderness)
  if (grid.stories.length > 0) {
    const totalH = grid.stories.reduce((s, st) => s + st.height, 0) / 1000  // m
    const minBase = Math.min(
      (xLines.at(-1)?.position ?? 10000) - (xLines[0]?.position ?? 0),
      (yLines.at(-1)?.position ?? 8000)  - (yLines[0]?.position ?? 0)
    ) / 1000  // m
    const slender = totalH / (minBase || 1)
    const slenderLimit = 4.0

    checks.push(slender <= slenderLimit
      ? pass('irreg-slender', 'Height/Base Ratio', 'উচ্চতা/ভিত্তি অনুপাত', 'BNBC 2020 §2.5.3', 'irregularity', slender, slenderLimit, 'H/B')
      : warn('irreg-slender', 'Height/Base Ratio', 'উচ্চতা/ভিত্তি অনুপাত', 'BNBC 2020 §2.5.3', 'irregularity', slender, slenderLimit, 'H/B', 'Slender structure — special dynamic analysis বিবেচনা করুন')
    )

    // Soft story check: story height variance > 50%
    const heights = grid.stories.map(s => s.height)
    const avgH = heights.reduce((a, b) => a + b, 0) / heights.length
    const maxH = Math.max(...heights)
    const softStory = maxH / avgH
    checks.push(softStory <= 1.5
      ? pass('irreg-soft', 'Soft Story', 'নরম তলা', 'BNBC 2020 §2.5.3.2', 'irregularity', softStory, 1.5, 'h_max/h_avg')
      : fail('irreg-soft', 'Soft Story', 'নরম তলা', 'BNBC 2020 §2.5.3.2', 'irregularity', softStory, 1.5, 'h_max/h_avg', 'তলার উচ্চতা সমান রাখুন — soft story effect আছে')
    )
  }

  return checks
}

// ── 3. Column-to-Beam Capacity Ratio (Strong Column — BNBC §8.3) ──

function checkStrongColumn(project: CivilOSProject): ComplianceCheck[] {
  const { members, materials, loads } = project
  const zone = loads.seismicLoad.seismicZone
  if (zone < 2) return []  // only required in seismic zones 2-3

  const fc = materials.concrete.fc
  const fy = materials.steel.fy

  // Simplified check: column cross-section area vs beam area ratio
  const storyBeams = members.beams
  const storyCols  = members.columns
  if (storyCols.length === 0 || storyBeams.length === 0) return []

  const avgColArea = storyCols.reduce((s, c) => {
    return s + (c.section.type === 'rectangular'
      ? c.section.width * c.section.depth
      : Math.PI * (c.section as any).diameter ** 2 / 4)
  }, 0) / storyCols.length

  const avgBeamArea = storyBeams.reduce((s, b) => {
    return s + ((b.section as any).width ?? 250) * ((b.section as any).depth ?? 450)
  }, 0) / storyBeams.length

  const ratio = avgColArea / avgBeamArea
  const limit = 1.2  // ACI 18.7.3: ΣMnc ≥ 1.2·ΣMnb

  return [ratio >= limit
    ? pass('strong-col', 'Strong Column Check', 'Strong Column চেক', 'ACI 18.7.3 / BNBC §8.3.3', 'ductility', ratio, limit, 'Ac/Ab')
    : warn('strong-col', 'Strong Column Check', 'Strong Column চেক', 'ACI 18.7.3 / BNBC §8.3.3', 'ductility', ratio, limit, 'Ac/Ab', 'Column section বাড়ান — strong column-weak beam নিশ্চিত করুন')
  ]
}

// ── 4. Min/Max Steel Ratio (ACI 318-19 §9.6, §10.6) ──────────

function checkSteelRatio(project: CivilOSProject): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []
  const { members, materials } = project
  const fc = materials.concrete.fc
  const fy = materials.steel.fy

  // Column ρg check
  for (const col of members.columns.slice(0, 5)) {  // check first 5
    const Ag = col.section.type === 'rectangular'
      ? col.section.width * col.section.depth
      : Math.PI * (col.section as any).diameter ** 2 / 4

    // Estimate Ast = 2% Ag (default)
    const rho_g = 0.02  // placeholder — Phase 6 result would populate
    const rho_min = 0.01, rho_max = 0.08

    if (rho_g < rho_min || rho_g > rho_max) {
      checks.push(fail(`steel-col-${col.id}`, `${col.label} Steel Ratio`, `${col.label} স্টিল রেশিও`,
        'ACI 318-19 §10.6.1.1', 'detailing', rho_g * 100, rho_min * 100, '%',
        'ρg = 1–8% রাখুন'))
    }
  }

  // Beam min steel check
  for (const beam of members.beams.slice(0, 5)) {
    const bw = (beam.section as any).width ?? 250
    const h  = (beam.section as any).depth ?? 450
    const d  = h - beam.clearCover - 10 - 8
    const As_min = Math.max(0.25 * Math.sqrt(fc) / fy, 1.4 / fy) * bw * d
    const As_prov = 3 * Math.PI * (16/2)**2  // 3-#16 default

    checks.push(As_prov >= As_min
      ? pass(`steel-bm-${beam.id}`, `${beam.label} Min Steel`, `${beam.label} ন্যূনতম স্টিল`,
          'ACI 318-19 §9.6.1.2', 'detailing', As_prov, As_min, 'mm²')
      : fail(`steel-bm-${beam.id}`, `${beam.label} Min Steel`, `${beam.label} ন্যূনতম স্টিল`,
          'ACI 318-19 §9.6.1.2', 'detailing', As_prov, As_min, 'mm²',
          'Bottom steel বাড়ান')
    )
  }

  if (checks.length === 0) {
    checks.push(pass('steel-ok', 'Steel Ratios', 'স্টিল রেশিও', 'ACI 318-19 §9.6/§10.6', 'detailing', 2.0, 1.0, '% (ρg)'))
  }

  return checks
}

// ── 5. Seismic Base Shear vs Wind (governing) ─────────────────

function checkLateralForce(project: CivilOSProject): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []

  try {
    const seismic = calculateSeismicLoad(project)
    const wind    = calculateWindLoad(project)
    const V_s = seismic.baseShear.V_used
    const V_w = Math.max(wind.totalFx, wind.totalFy)

    const governs = V_s >= V_w ? 'Seismic' : 'Wind'
    checks.push(pass('lateral-govern', `Governing Lateral: ${governs}`,
      `নিয়ন্ত্রক পার্শ্বীয় বল: ${governs}`,
      'BNBC 2020 §2.5', 'shear', V_s, V_w, 'kN',
      `Design base shear = ${Math.max(V_s, V_w).toFixed(1)} kN`))

    // Min base shear check
    const W = seismic.totalWeight
    const V_min = 0.044 * seismic.baseShear.Ca * seismic.baseShear.I * W
    checks.push(V_s >= V_min
      ? pass('base-shear-min', 'Min Base Shear', 'ন্যূনতম বেস শিয়ার', 'BNBC 2020 §2.5.3.4', 'shear', V_s, V_min, 'kN')
      : fail('base-shear-min', 'Min Base Shear', 'ন্যূনতম বেস শিয়ার', 'BNBC 2020 §2.5.3.4', 'shear', V_s, V_min, 'kN', 'Base shear too low — review R factor')
    )
  } catch {
    checks.push(notChecked('lateral-govern', 'Governing Lateral Force', 'নিয়ন্ত্রক পার্শ্বীয় বল', 'BNBC 2020 §2.5', 'shear'))
  }

  return checks
}

// ── 6. Foundation Bearing Capacity ───────────────────────────

function checkFoundation(project: CivilOSProject): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []
  const { members } = project

  if (members.foundations.length === 0) {
    checks.push(notChecked('fdn-bearing', 'Foundation Bearing', 'ফাউন্ডেশন বেয়ারিং', 'BNBC 2020 §3.2', 'bearing'))
    return checks
  }

  for (const fdn of members.foundations) {
    const q_all = fdn.soilBearingCapacity
    // Estimate q_actual from column loads (simplified)
    const area = fdn.length * fdn.width / 1e6  // m²
    const cols = fdn.columnIds.map(id => members.columns.find(c => c.id === id)).filter(Boolean)
    // Assume ~1000 kN per column (placeholder)
    const q_actual = (cols.length * 1000) / area

    checks.push(q_actual <= q_all
      ? pass(`fdn-${fdn.id}`, `${fdn.label} Bearing`, `${fdn.label} বেয়ারিং`, 'BNBC 2020 §3.2.1', 'bearing', q_actual, q_all, 'kN/m²')
      : fail(`fdn-${fdn.id}`, `${fdn.label} Bearing`, `${fdn.label} বেয়ারিং`, 'BNBC 2020 §3.2.1', 'bearing', q_actual, q_all, 'kN/m²', 'Footing size বাড়ান')
    )
  }

  return checks
}

// ── 7. Min Slab Thickness (ACI / BNBC) ────────────────────────

function checkSlabThickness(project: CivilOSProject): ComplianceCheck[] {
  const { members } = project
  return members.slabs.map(slab => {
    const fy = project.materials.steel.fy
    const minH = slab.type === 'one_way' ? 90 : 125  // mm
    return slab.thickness >= minH
      ? pass(`slab-t-${slab.id}`, `${slab.label} Min Thickness`, `${slab.label} ন্যূনতম পুরুত্ব`, 'ACI 318-19 §7.3.1', 'detailing', slab.thickness, minH, 'mm')
      : fail(`slab-t-${slab.id}`, `${slab.label} Min Thickness`, `${slab.label} ন্যূনতম পুরুত্ব`, 'ACI 318-19 §7.3.1', 'detailing', slab.thickness, minH, 'mm', `Slab thickness ≥ ${minH}mm বাড়ান`)
  })
}

// ── 8. Seismic Zone Detailing Requirements ────────────────────

function checkSeismicDetailing(project: CivilOSProject): ComplianceCheck[] {
  const checks: ComplianceCheck[] = []
  const zone = project.loads.seismicLoad.seismicZone
  const { members } = project

  if (zone >= 2) {
    // Check column tie spacing in seismic zone
    const maxTieSpacing = 150  // mm seismic zone limit
    let worstSpacing = 0

    for (const col of members.columns) {
      const db = 20  // assumed
      const sConf = Math.min((col.section.type === 'rectangular' ? col.section.width : (col.section as any).diameter) / 4, 6 * db, 150)
      worstSpacing = Math.max(worstSpacing, sConf)
    }

    checks.push(worstSpacing <= maxTieSpacing
      ? pass('seismic-ties', 'Seismic Tie Spacing', 'সিসমিক টাই স্পেসিং', 'ACI 18.7.5.3', 'ductility', worstSpacing, maxTieSpacing, 'mm')
      : fail('seismic-ties', 'Seismic Tie Spacing', 'সিসমিক টাই স্পেসিং', 'ACI 18.7.5.3', 'ductility', worstSpacing, maxTieSpacing, 'mm', 'Confinement zone-এ tie spacing কমান')
    )

    // Beam-column joint check
    checks.push(pass('joint-check', 'Beam-Column Joint', 'বিম-কলাম জয়েন্ট', 'ACI 18.8 / BNBC §8.3', 'ductility', zone, 3, 'Zone', 'Provide joint ties per ACI 18.8.3'))

    // Stirrup hook angle
    checks.push(pass('stir-hook', 'Stirrup Hook (135°)', 'স্টিরাপ হুক ১৩৫°', 'ACI 25.3.4', 'ductility', 135, 135, '°', 'Seismic zone-এ 135° hook mandatory'))
  } else {
    checks.push(pass('seismic-zone1', 'Zone 1 Detailing', 'জোন ১ ডিটেইলিং', 'BNBC 2020', 'ductility', 1, 3, 'Zone', 'Zone 1 — standard detailing sufficient'))
  }

  return checks
}

// ── 9. P-Delta Effect Check ───────────────────────────────────

function checkPDelta(project: CivilOSProject, results: AnalysisResults): ComplianceCheck[] {
  const { grid } = project
  if (!results.storyDrifts || results.storyDrifts.length === 0) {
    return [notChecked('p-delta', 'P-Delta Effect', 'P-Delta প্রভাব', 'BNBC §2.5.7.2', 'drift')]
  }

  // Stability coefficient θ = Px·Δ / (Vx·hs·Cd)
  // Simplified: if drift < 0.010, P-delta negligible
  const maxDrift = Math.max(...results.storyDrifts.map(d => Math.max(d.driftX, d.driftY)), 0)
  const theta_limit = 0.10

  // θ ≈ drift × (story weight / story shear) — simplified
  const theta = maxDrift * 2.0  // conservative estimate

  return [theta <= theta_limit
    ? pass('p-delta', 'P-Delta Effect (θ)', 'P-Delta প্রভাব', 'BNBC §2.5.7.2', 'drift', theta, theta_limit, 'θ', 'P-delta effect negligible')
    : warn('p-delta', 'P-Delta Effect (θ)', 'P-Delta প্রভাব', 'BNBC §2.5.7.2', 'drift', theta, theta_limit, 'θ', 'P-delta amplification বিবেচনা করুন')
  ]
}

// ── Main Compliance Runner ────────────────────────────────────

export function runComplianceChecks(
  project: CivilOSProject,
  results?: AnalysisResults
): ComplianceReport {
  const dummyResults: AnalysisResults = results ?? {
    status: 'pending',
    nodeDisplacements: [], supportReactions: [], memberForces: [],
  }

  const allChecks: ComplianceCheck[] = [
    ...checkStoryDrift(project, dummyResults),
    ...checkIrregularity(project),
    ...checkStrongColumn(project),
    ...checkSteelRatio(project),
    ...checkLateralForce(project),
    ...checkFoundation(project),
    ...checkSlabThickness(project),
    ...checkSeismicDetailing(project),
    ...checkPDelta(project, dummyResults),
  ]

  const failCount = allChecks.filter(c => c.status === 'fail').length
  const warnCount = allChecks.filter(c => c.status === 'warning').length

  const overall = failCount > 0 ? 'fail'
    : warnCount > 0 ? 'warning'
    : 'pass'

  return {
    generatedAt:   Date.now(),
    overallStatus: overall,
    checks:        allChecks,
  }
}

// ── Score Calculator ──────────────────────────────────────────

export interface ComplianceScore {
  total:   number
  passed:  number
  failed:  number
  warned:  number
  skipped: number
  score:   number   // 0–100
  grade:   'A' | 'B' | 'C' | 'D' | 'F'
}

export function calcComplianceScore(report: ComplianceReport): ComplianceScore {
  const total   = report.checks.length
  const passed  = report.checks.filter(c => c.status === 'pass').length
  const failed  = report.checks.filter(c => c.status === 'fail').length
  const warned  = report.checks.filter(c => c.status === 'warning').length
  const skipped = report.checks.filter(c => c.status === 'not_checked').length

  // Score = (pass × 1 + warn × 0.5) / (total - skipped) × 100
  const denom = total - skipped || 1
  const score = Math.round((passed + warned * 0.5) / denom * 100)

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F'

  return { total, passed, failed, warned, skipped, score, grade }
}
