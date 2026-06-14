// ============================================================
// CivilOS Structural — Report Engine
// Phase 12: Professional Engineering Report Generation
// Assembles data for PDF / DOCX / Excel export
// ============================================================

import { CivilOSProject, ComplianceReport } from '../../lib/types'
import { runComplianceChecks, calcComplianceScore } from '../bnbc/complianceEngine'
import { calculateSeismicLoad } from '../bnbc/seismicLoad'
import { calculateWindLoad } from '../bnbc/windLoad'
import { generateBBS } from '../bbs/bbsEngine'

// ── Report Section Types ──────────────────────────────────────

export interface ReportSection {
  id:      string
  title:   string
  content: ReportContent[]
}

export type ReportContent =
  | { type: 'heading';   text: string; level: 1|2|3 }
  | { type: 'paragraph'; text: string }
  | { type: 'table';     headers: string[]; rows: (string|number)[][] }
  | { type: 'keyvalue';  items: { key: string; value: string; unit?: string }[] }
  | { type: 'checklist'; items: { label: string; status: 'pass'|'fail'|'warning'|'not_checked'; value: string }[] }
  | { type: 'formula';   latex: string; description: string }
  | { type: 'spacer' }
  | { type: 'pagebreak' }

export interface ReportDocument {
  title:      string
  subtitle:   string
  type:       ReportType
  projectMeta: {
    name:       string
    projectNo:  string
    client:     string
    engineer:   string
    address:    string
    date:       string
    code:       string
  }
  sections:   ReportSection[]
  generatedAt: number
}

export type ReportType =
  | 'design_basis'
  | 'analysis'
  | 'member_design'
  | 'compliance'
  | 'bbs'
  | 'full'

// ── Helper: format number ────────────────────────────────────

const f2  = (n: number) => n.toFixed(2)
const f3  = (n: number) => n.toFixed(3)
const f0  = (n: number) => Math.round(n).toString()

// ── Section: Cover Page Meta ──────────────────────────────────

function coverSection(project: CivilOSProject): ReportSection {
  const { meta, loads } = project
  return {
    id: 'cover',
    title: 'Project Information',
    content: [
      { type: 'heading', text: 'PROJECT INFORMATION', level: 1 },
      { type: 'keyvalue', items: [
        { key: 'Project Name',       value: meta.name },
        { key: 'Project No.',        value: meta.projectNo },
        { key: 'Client',             value: meta.client || '—' },
        { key: 'Engineer',           value: meta.engineer || '—' },
        { key: 'Checked By',         value: meta.checkedBy || '—' },
        { key: 'Address',            value: meta.address },
        { key: 'Structural System',  value: meta.structuralSystem.replace('_', ' ').toUpperCase() },
        { key: 'Building Use',       value: meta.buildingUse.replace('_', ' ').toUpperCase() },
        { key: 'Importance Category',value: `Category ${meta.importanceCategory}` },
        { key: 'Date',               value: new Date().toLocaleDateString('en-GB') },
        { key: 'Revision',           value: 'A' },
      ]},
      { type: 'spacer' },
      { type: 'heading', text: 'Design Codes & Standards', level: 2 },
      { type: 'table',
        headers: ['Code', 'Title', 'Year'],
        rows: [
          ['BNBC 2020', 'Bangladesh National Building Code', '2020'],
          ['ACI 318-19', 'Building Code Requirements for Structural Concrete', '2019'],
          ['IS 2502', 'Code of Practice for Bending & Fixing of Bars', '1963 (R2006)'],
          ['ASCE 7-16', 'Minimum Design Loads for Buildings and Other Structures', '2016'],
        ],
      },
    ],
  }
}

// ── Section: Structural Parameters ───────────────────────────

function parametersSection(project: CivilOSProject): ReportSection {
  const { grid, materials, loads } = project
  const totalH  = grid.stories.reduce((s, st) => s + st.height, 0) / 1000
  const Lx = grid.xLines.length >= 2 ? (grid.xLines.at(-1)!.position - grid.xLines[0].position) / 1000 : 0
  const Ly = grid.yLines.length >= 2 ? (grid.yLines.at(-1)!.position - grid.yLines[0].position) / 1000 : 0

  return {
    id: 'parameters',
    title: 'Structural Parameters',
    content: [
      { type: 'heading', text: '1. STRUCTURAL PARAMETERS', level: 1 },

      { type: 'heading', text: '1.1 Building Geometry', level: 2 },
      { type: 'keyvalue', items: [
        { key: 'No. of Stories',     value: grid.stories.length.toString(),     unit: '' },
        { key: 'Total Height',       value: f2(totalH),                          unit: 'm' },
        { key: 'Building Width (X)', value: f2(Lx),                              unit: 'm' },
        { key: 'Building Width (Y)', value: f2(Ly),                              unit: 'm' },
        { key: 'No. of X-Bays',      value: Math.max(grid.xLines.length - 1, 0).toString() },
        { key: 'No. of Y-Bays',      value: Math.max(grid.yLines.length - 1, 0).toString() },
      ]},

      { type: 'heading', text: '1.2 Story Heights', level: 2 },
      { type: 'table',
        headers: ['Story', 'Height (mm)', 'Elevation (m)', 'Type'],
        rows: grid.stories.map(s => [
          s.label, s.height, f2(s.level / 1000), s.isMasterStory ? 'Master' : 'Typical',
        ]),
      },

      { type: 'heading', text: '1.3 Materials', level: 2 },
      { type: 'keyvalue', items: [
        { key: "Concrete Grade (f'c)", value: f2(materials.concrete.fc), unit: 'MPa' },
        { key: 'Elastic Modulus (Ec)', value: materials.concrete.Ec.toLocaleString(), unit: 'MPa' },
        { key: 'Unit Weight (γc)',     value: f2(materials.concrete.unitWeight), unit: 'kN/m³' },
        { key: 'Poisson Ratio (ν)',    value: materials.concrete.poissonRatio.toString() },
        { key: 'Steel Grade (fy)',     value: f2(materials.steel.fy), unit: 'MPa' },
        { key: 'Es',                   value: '200,000', unit: 'MPa' },
        { key: 'fyt (transverse)',     value: f2(materials.steel.fyt), unit: 'MPa' },
        { key: 'Global Clear Cover',   value: materials.globalClearCover.toString(), unit: 'mm' },
      ]},

      { type: 'heading', text: '1.4 Gravity Loads', level: 2 },
      { type: 'table',
        headers: ['Load Type', 'Value', 'Unit', 'Note'],
        rows: [
          ['Dead Load (SDL — Floor)',  loads.deadLoad.superimposedDL, 'kN/m²', 'Floor finish + partition'],
          ['Live Load (Floor)',        loads.liveLoad.liveLoad,       'kN/m²', 'BNBC Table 2.2'],
          ['SDL (Roof)',               loads.roofLoad.superimposedDL, 'kN/m²', 'Waterproofing + screed'],
          ['Live Load (Roof)',         loads.roofLoad.liveLoad,       'kN/m²', 'BNBC'],
          ['Wall Load',               loads.deadLoad.wallLoad ?? 0,  'kN/m',  'Per beam'],
        ],
      },
    ],
  }
}

// ── Section: Seismic Analysis ─────────────────────────────────

function seismicSection(project: CivilOSProject): ReportSection {
  let seismicData: any = null
  try { seismicData = calculateSeismicLoad(project) } catch {}

  const sl = project.loads.seismicLoad
  const content: ReportContent[] = [
    { type: 'heading', text: '2. SEISMIC ANALYSIS (BNBC 2020)', level: 1 },
    { type: 'heading', text: '2.1 Seismic Parameters', level: 2 },
    { type: 'keyvalue', items: [
      { key: 'Seismic Zone',                   value: `Zone ${sl.seismicZone}` },
      { key: 'Zone Factor (Z)',                 value: sl.Z.toString() },
      { key: 'Site Class',                      value: sl.siteClass },
      { key: 'Ca',                              value: sl.Ca.toString() },
      { key: 'Cv',                              value: sl.Cv.toString() },
      { key: 'Importance Factor (I)',           value: sl.importanceFactor.toString() },
      { key: 'Response Modification (R)',       value: sl.responseModificationFactor.toString() },
      { key: 'Period Coefficient (Ct)',         value: sl.Ct.toString() },
      { key: 'Analysis Method',                 value: sl.analysisMethod.replace('_', ' ').toUpperCase() },
    ]},
  ]

  if (seismicData) {
    const bs = seismicData.baseShear
    const per = seismicData.period

    content.push(
      { type: 'heading', text: '2.2 Building Period', level: 2 },
      { type: 'formula',
        latex: 'T_a = C_t \\cdot h_n^{0.75}',
        description: `Ta = ${per.Ct} × ${per.hn}^0.75 = ${per.Ta} s`,
      },
      { type: 'keyvalue', items: [
        { key: 'Approximate Period (Ta)', value: per.Ta.toString(), unit: 's' },
        { key: 'Building Height (hn)',    value: per.hn.toString(), unit: 'm' },
        { key: 'Upper Bound T',          value: per.T_upper.toString(), unit: 's' },
      ]},

      { type: 'heading', text: '2.3 Design Base Shear', level: 2 },
      { type: 'formula',
        latex: 'V = \\frac{C_v \\cdot I \\cdot W}{R \\cdot T}',
        description: bs.formula,
      },
      { type: 'keyvalue', items: [
        { key: 'Seismic Weight (W)',      value: f2(bs.W), unit: 'kN' },
        { key: 'V (computed)',            value: f2(bs.V), unit: 'kN' },
        { key: 'V_min',                   value: f2(bs.V_min), unit: 'kN' },
        { key: 'V_max',                   value: f2(bs.V_max), unit: 'kN' },
        { key: 'V_design (governing)',    value: f2(bs.V_used), unit: 'kN' },
        { key: 'Cs = V/W',               value: bs.Cs.toString() },
      ]},

      { type: 'heading', text: '2.4 Story Force Distribution', level: 2 },
      { type: 'table',
        headers: ['Story', 'hx (m)', 'Wx (kN)', 'Wx·hx', 'Cvx', 'Fx (kN)', 'Acc. Shear (kN)'],
        rows: [...seismicData.stories].reverse().map((s: any) => [
          s.storyLabel, f2(s.hx), f2(s.Wx), f0(s.Wx_hx), f3(s.Cvx), f2(s.Fx), f2(s.Mx_accum),
        ]),
      },
    )
  }

  return { id: 'seismic', title: 'Seismic Analysis', content }
}

// ── Section: Wind Analysis ────────────────────────────────────

function windSection(project: CivilOSProject): ReportSection {
  let windData: any = null
  try { windData = calculateWindLoad(project) } catch {}

  const wl = project.loads.windLoad
  const content: ReportContent[] = [
    { type: 'heading', text: '3. WIND LOAD ANALYSIS (BNBC 2020)', level: 1 },
    { type: 'keyvalue', items: [
      { key: 'Basic Wind Speed (V)',  value: wl.basicWindSpeed.toString(), unit: 'km/h' },
      { key: 'Exposure Category',    value: wl.exposureCategory },
      { key: 'Topographic Factor',   value: wl.topographicFactor.toString() },
      { key: 'Gust Factor (G)',       value: wl.gustFactor.toString() },
      { key: 'Importance Factor',    value: wl.importanceFactor.toString() },
    ]},
  ]

  if (windData) {
    content.push(
      { type: 'table',
        headers: ['Story', 'Height (m)', 'Kz', 'qz (kN/m²)', 'Fx (kN)', 'Fy (kN)'],
        rows: [...windData.stories].reverse().map((s: any) => [
          s.storyLabel, f2(s.height), f3(s.Kz), f3(s.qz), f2(s.Fx), f2(s.Fy),
        ]),
      },
      { type: 'keyvalue', items: [
        { key: 'Total Fx (Wind X)', value: f2(windData.totalFx), unit: 'kN' },
        { key: 'Total Fy (Wind Y)', value: f2(windData.totalFy), unit: 'kN' },
      ]},
    )
  }

  return { id: 'wind', title: 'Wind Analysis', content }
}

// ── Section: Load Combinations ────────────────────────────────

function loadCombosSection(project: CivilOSProject): ReportSection {
  return {
    id: 'loadcombos',
    title: 'Load Combinations',
    content: [
      { type: 'heading', text: '4. LOAD COMBINATIONS (ACI 318-19 §5.3)', level: 1 },
      { type: 'table',
        headers: ['No.', 'Combination', 'Code Reference'],
        rows: project.loads.loadCombinations.map((lc, i) => [
          i + 1, lc.label, lc.code,
        ]),
      },
    ],
  }
}

// ── Section: Member Summary ───────────────────────────────────

function memberSummarySection(project: CivilOSProject): ReportSection {
  const { members } = project
  return {
    id: 'members',
    title: 'Member Summary',
    content: [
      { type: 'heading', text: '5. STRUCTURAL MEMBER SUMMARY', level: 1 },
      { type: 'keyvalue', items: [
        { key: 'Total Columns',     value: members.columns.length.toString() },
        { key: 'Total Beams',       value: members.beams.length.toString() },
        { key: 'Total Slabs',       value: members.slabs.length.toString() },
        { key: 'Total Walls',       value: members.walls.length.toString() },
        { key: 'Total Foundations', value: members.foundations.length.toString() },
        { key: 'Total Staircases',  value: members.stairs.length.toString() },
      ]},

      { type: 'heading', text: '5.1 Column Sections', level: 2 },
      { type: 'table',
        headers: ['Mark', 'Section', 'b (mm)', 'h (mm)', 'Cover (mm)', 'Story'],
        rows: [...new Map(members.columns.map(c => [c.label, c])).values()].map(c => {
          const story = project.grid.stories.find(s => s.id === c.storyId)
          const bw = c.section.type === 'rectangular' ? c.section.width  : (c.section as any).diameter
          const h  = c.section.type === 'rectangular' ? c.section.depth  : (c.section as any).diameter
          return [c.label, c.section.type === 'rectangular' ? 'Rect.' : 'Circ.', bw, h, c.clearCover, story?.label ?? '—']
        }),
      },

      { type: 'heading', text: '5.2 Beam Sections', level: 2 },
      { type: 'table',
        headers: ['Mark', 'bw (mm)', 'h (mm)', 'Cover (mm)', 'Story'],
        rows: members.beams.map(b => {
          const story = project.grid.stories.find(s => s.id === b.storyId)
          return [b.label, (b.section as any).width ?? 250, (b.section as any).depth ?? 450, b.clearCover, story?.label ?? '—']
        }),
      },
    ],
  }
}

// ── Section: BNBC Compliance ──────────────────────────────────

function complianceSection(project: CivilOSProject): ReportSection {
  const report = runComplianceChecks(project,
    project.results.status === 'complete' ? project.results : undefined)
  const score  = calcComplianceScore(report)

  return {
    id: 'compliance',
    title: 'BNBC Compliance',
    content: [
      { type: 'heading', text: '6. BNBC 2020 COMPLIANCE CHECKS', level: 1 },
      { type: 'keyvalue', items: [
        { key: 'Overall Status',  value: report.overallStatus.toUpperCase() },
        { key: 'Compliance Grade',value: score.grade },
        { key: 'Score',           value: `${score.score}/100` },
        { key: 'Pass',            value: score.passed.toString() },
        { key: 'Fail',            value: score.failed.toString() },
        { key: 'Warning',         value: score.warned.toString() },
        { key: 'Not Checked',     value: score.skipped.toString() },
      ]},
      { type: 'checklist',
        items: report.checks.map(c => ({
          label:  `${c.nameLocal} (${c.bnbcReference})`,
          status: c.status,
          value:  `${c.value.toFixed(3)} / ${c.limit.toFixed(3)} ${c.unit}`,
        })),
      },
    ],
  }
}

// ── Section: BBS Summary ──────────────────────────────────────

function bbsSection(project: CivilOSProject): ReportSection {
  const sheet = generateBBS(project)
  return {
    id: 'bbs',
    title: 'Bar Bending Schedule',
    content: [
      { type: 'heading', text: '7. BAR BENDING SCHEDULE SUMMARY', level: 1 },
      { type: 'keyvalue', items: [
        { key: 'Total Bars',    value: sheet.grandTotal.bars.toLocaleString(), unit: 'nos' },
        { key: 'Total Weight',  value: sheet.grandTotal.weight.toLocaleString(), unit: 'kg' },
        { key: 'Total Tonnage', value: sheet.grandTotal.tonnage.toFixed(3), unit: 'MT' },
      ]},
      { type: 'heading', text: '7.1 Steel by Diameter', level: 2 },
      { type: 'table',
        headers: ['Bar ⌀ (mm)', 'No. of Bars', 'Total Length (m)', 'Weight (kg)', '% of Total'],
        rows: sheet.summary.map(s => [
          `⌀${s.dia}`,
          s.totalBars,
          s.totalLength.toFixed(1),
          s.totalWeight.toFixed(1),
          sheet.grandTotal.weight > 0
            ? `${(s.totalWeight / sheet.grandTotal.weight * 100).toFixed(1)}%`
            : '0%',
        ]),
      },
      { type: 'heading', text: '7.2 Steel by Member Type', level: 2 },
      { type: 'table',
        headers: ['Member Type', 'No. of Items', 'Total Weight (kg)'],
        rows: (['beam', 'column', 'slab', 'foundation'] as const).map(type => {
          const bars   = sheet.bars.filter(b => b.memberType === type)
          const weight = bars.reduce((s, b) => s + b.totalWeight, 0)
          return [type.charAt(0).toUpperCase() + type.slice(1), bars.length, weight.toFixed(1)]
        }),
      },
    ],
  }
}

// ── Section: Analysis Results Summary ────────────────────────

function analysisSection(project: CivilOSProject): ReportSection {
  const results = project.results
  const content: ReportContent[] = [
    { type: 'heading', text: '8. STRUCTURAL ANALYSIS RESULTS', level: 1 },
    { type: 'keyvalue', items: [
      { key: 'Analysis Status', value: results.status.toUpperCase() },
      { key: 'Load Cases',      value: project.loads.loadCombinations.filter(l => l.isDefault).length.toString() },
      { key: 'Total Nodes',     value: project.analyticalModel.nodes.length.toString() },
      { key: 'Total Elements',  value: project.analyticalModel.elements.length.toString() },
    ]},
  ]

  if (results.status === 'complete') {
    const maxUz = results.nodeDisplacements.reduce((m, d) => Math.max(m, Math.abs(d.uz)), 0)
    const maxFz = results.supportReactions.reduce((m, r) => Math.max(m, Math.abs(r.Fz)), 0)
    const maxMz = results.memberForces.reduce((m, mf) =>
      Math.max(m, ...mf.stations.map(s => Math.abs(s.Mz))), 0)
    const maxVy = results.memberForces.reduce((m, mf) =>
      Math.max(m, ...mf.stations.map(s => Math.abs(s.Vy))), 0)

    content.push({ type: 'keyvalue', items: [
      { key: 'Max Vertical Displacement', value: f3(maxUz), unit: 'mm' },
      { key: 'Max Support Reaction (Fz)', value: f2(maxFz), unit: 'kN' },
      { key: 'Max Bending Moment (Mz)',   value: f2(maxMz), unit: 'kN·m' },
      { key: 'Max Shear Force (Vy)',      value: f2(maxVy), unit: 'kN' },
    ]})

    if (results.storyDrifts && results.storyDrifts.length > 0) {
      content.push(
        { type: 'heading', text: '8.1 Story Drifts', level: 2 },
        { type: 'table',
          headers: ['Story', 'Load Case', 'Drift X', 'Drift Y', 'Limit', 'Status'],
          rows: results.storyDrifts.map(d => [
            d.storyId, d.loadCaseId,
            d.driftX > 0 ? `1/${Math.round(1/d.driftX)}` : '—',
            d.driftY > 0 ? `1/${Math.round(1/d.driftY)}` : '—',
            '1/40', d.passed ? 'PASS' : 'FAIL',
          ]),
        }
      )
    }
  }

  return { id: 'analysis', title: 'Analysis Results', content }
}

// ── Main Report Assembler ─────────────────────────────────────

export function assembleReport(
  project: CivilOSProject,
  type: ReportType
): ReportDocument {
  const sections: ReportSection[] = []

  const include = (t: ReportType[]) => t.includes(type) || type === 'full'

  sections.push(coverSection(project))
  sections.push(parametersSection(project))

  if (include(['analysis', 'design_basis'])) sections.push(seismicSection(project))
  if (include(['analysis', 'design_basis'])) sections.push(windSection(project))
  if (include(['analysis', 'design_basis'])) sections.push(loadCombosSection(project))
  if (include(['member_design', 'analysis'])) sections.push(memberSummarySection(project))
  if (include(['analysis']))                  sections.push(analysisSection(project))
  if (include(['compliance']))               sections.push(complianceSection(project))
  if (include(['bbs']))                       sections.push(bbsSection(project))

  const typeLabels: Record<ReportType, string> = {
    design_basis:  'Design Basis Report',
    analysis:      'Structural Analysis Report',
    member_design: 'Member Design Report',
    compliance:    'BNBC Compliance Report',
    bbs:           'Bar Bending Schedule',
    full:          'Complete Structural Report',
  }

  return {
    title:       typeLabels[type],
    subtitle:    `${project.meta.name} — ${project.meta.projectNo}`,
    type,
    projectMeta: {
      name:      project.meta.name,
      projectNo: project.meta.projectNo,
      client:    project.meta.client,
      engineer:  project.meta.engineer,
      address:   project.meta.address,
      date:      new Date().toLocaleDateString('en-GB'),
      code:      'BNBC 2020 / ACI 318-19',
    },
    sections,
    generatedAt: Date.now(),
  }
}
