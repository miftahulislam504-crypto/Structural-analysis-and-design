// ============================================================
// CivilOS Structural — Physical → Analytical Model Converter
// Phase 3: Model Conversion Engine
// Converts Columns/Beams/Slabs → Nodes/Elements/DOF/BC
// ============================================================

import {
  CivilOSProject,
  AnalyticalModel,
  AnalyticalNode,
  AnalyticalElement,
  BoundaryCondition,
  Diaphragm,
  DOFIndex,
  SectionProperties,
  MaterialProperties,
  MemberReleases,
  Column,
  Beam,
  Story,
} from '../../lib/types'
import { calcIRectangular, calcAreaRectangular, calcAreaCircular, calcICircular, calcG } from '../../lib/utils'

// ── Node ID helpers ──────────────────────────────────────────

function makeNodeId(gridX: string, gridY: string, storyId: string): string {
  return `N_${gridX}_${gridY}_${storyId}`
}

function makeBaseNodeId(gridX: string, gridY: string): string {
  return `N_${gridX}_${gridY}_BASE`
}

function makeElementId(type: string, memberId: string): string {
  return `E_${type}_${memberId}`
}

// ── Section property calculations ────────────────────────────

function columnSectionProps(col: Column): SectionProperties {
  if (col.section.type === 'rectangular') {
    const { width: b, depth: h } = col.section
    const area = calcAreaRectangular(b, h)
    const Ix   = calcIRectangular(b, h)   // strong axis (h direction)
    const Iy   = calcIRectangular(h, b)   // weak axis  (b direction)
    const J    = torsionJ_rect(b, h)
    return { area, Ix, Iy, J, Sz: Ix / (h / 2), Sy: Iy / (b / 2) }
  } else {
    const { diameter: d } = col.section
    const area = calcAreaCircular(d)
    const I    = calcICircular(d)
    const J    = 2 * I  // polar moment for circle
    return { area, Ix: I, Iy: I, J, Sz: I / (d / 2), Sy: I / (d / 2) }
  }
}

function beamSectionProps(beam: Beam): SectionProperties {
  if (beam.section.type === 'rectangular') {
    const { width: b, depth: h } = beam.section
    const area = calcAreaRectangular(b, h)
    const Ix   = calcIRectangular(b, h)
    const Iy   = calcIRectangular(h, b)
    const J    = torsionJ_rect(b, h)
    return { area, Ix, Iy, J, Sz: Ix / (h / 2), Sy: Iy / (b / 2) }
  } else {
    // T-beam: use transformed section (simplified)
    const { webWidth: bw, webDepth: hw, flangeWidth: bf, flangeThickness: tf } = beam.section
    const Aw   = calcAreaRectangular(bw, hw)
    const Af   = calcAreaRectangular(bf, tf)
    const area = Aw + Af
    // Centroid from bottom
    const yAw  = hw / 2
    const yAf  = hw + tf / 2
    const yBar = (Aw * yAw + Af * yAf) / area
    // Parallel axis
    const Aw_pa = bw * Math.pow(hw, 3) / 12 + Aw * Math.pow(yBar - yAw, 2)
    const Af_pa = bf * Math.pow(tf, 3)  / 12 + Af * Math.pow(yBar - yAf, 2)
    const Ix    = Aw_pa + Af_pa
    const Iy    = calcIRectangular(hw, bw) // simplified
    const J     = torsionJ_rect(bw, hw)
    const hTotal = hw + tf
    return {
      area, Ix, Iy, J,
      Sz: Ix / (hTotal - yBar),
      Sy: Iy / (bw / 2),
    }
  }
}

/** Saint-Venant torsion constant for rectangle: J ≈ (1/3) * b * t³ (open section approx) */
function torsionJ_rect(b: number, h: number): number {
  const a = Math.max(b, h)
  const t = Math.min(b, h)
  // More accurate: J = a*t³/3 * [1 - 0.63*(t/a)*(1 - t^4/(12*a^4))]
  return (a * Math.pow(t, 3) / 3) * (1 - 0.63 * (t / a) * (1 - Math.pow(t, 4) / (12 * Math.pow(a, 4))))
}

function materialProps(fc: number, nu: number): MaterialProperties {
  const E = Math.round(4700 * Math.sqrt(fc)) // MPa
  const G = Math.round(E / (2 * (1 + nu)))
  return { E, G, nu, rho: 24 }  // 24 kN/m³
}

// ── Local axis for members ────────────────────────────────────

function columnLocalAxis() {
  return {
    x: [0, 0, 1] as [number, number, number],  // along column height (Z global)
    y: [1, 0, 0] as [number, number, number],  // local y = global X
    z: [0, 1, 0] as [number, number, number],  // local z = global Y
  }
}

function beamLocalAxis(
  startMm: { x: number; y: number },
  endMm: { x: number; y: number }
): { x: [number,number,number]; y: [number,number,number]; z: [number,number,number] } {
  const dx = endMm.x - startMm.x
  const dy = endMm.y - startMm.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len
  const uy = dy / len
  return {
    x: [ux, uy, 0],     // along beam axis
    y: [-uy, ux, 0],    // perpendicular in plan
    z: [0, 0, -1],      // downward (weak axis for beam)
  }
}

// ── Node position from grid ───────────────────────────────────

function getNodePosition(
  gridXId: string,
  gridYId: string,
  story: Story,
  project: CivilOSProject
): { x: number; y: number; z: number } | null {
  const xLine = project.grid.xLines.find(l => l.id === gridXId)
  const yLine = project.grid.yLines.find(l => l.id === gridYId)
  if (!xLine || !yLine) return null
  return {
    x: xLine.position,   // mm
    y: yLine.position,   // mm
    z: story.level,      // mm elevation
  }
}

function parseNodeId(nodeId: string): { gridX: string; gridY: string } | null {
  // Format: N_gridXId_gridYId_storyId  or  node_gridXId_gridYId (from PlanCanvas)
  const parts = nodeId.split('_')
  if (nodeId.startsWith('node_') && parts.length >= 3) {
    return { gridX: parts[1], gridY: parts[2] }
  }
  if (nodeId.startsWith('N_') && parts.length >= 4) {
    return { gridX: parts[1], gridY: parts[2] }
  }
  return null
}

// ── DOF assignment ────────────────────────────────────────────

let _dofCounter = 0

function nextDOF(): number {
  return ++_dofCounter
}

function freeDOF(): DOFIndex {
  return {
    ux: nextDOF(), uy: nextDOF(), uz: nextDOF(),
    rx: nextDOF(), ry: nextDOF(), rz: nextDOF(),
  }
}

function fixedDOF(): DOFIndex {
  return { ux: -1, uy: -1, uz: -1, rx: -1, ry: -1, rz: -1 }
}

function rigidDiaphragmDOF(masterDOF: DOFIndex): DOFIndex {
  // In rigid diaphragm: ux, uy, rz constrained to master
  return {
    ux: masterDOF.ux,   // slave to master
    uy: masterDOF.uy,   // slave to master
    uz: nextDOF(),      // free vertical
    rx: nextDOF(),      // free rotation
    ry: nextDOF(),      // free rotation
    rz: masterDOF.rz,  // slave to master
  }
}

// ── MAIN CONVERTER ────────────────────────────────────────────

export function convertToAnalyticalModel(project: CivilOSProject): AnalyticalModel {
  _dofCounter = 0  // reset DOF counter

  const nodes: AnalyticalNode[]     = []
  const elements: AnalyticalElement[] = []
  const restraints: BoundaryCondition[] = []
  const diaphragms: Diaphragm[]     = []

  const nodeMap = new Map<string, AnalyticalNode>()  // nodeId → node
  const matProps = materialProps(
    project.materials.concrete.fc,
    project.materials.concrete.poissonRatio
  )

  // ── Step 1: Create nodes at each column location per story ──
  for (const story of project.grid.stories) {
    // Get all unique grid intersections occupied by columns in this story
    const storyColumns = project.members.columns.filter(c => c.storyId === story.id)

    // Also include ALL grid intersections (even without columns) for beam connectivity
    const allIntersections = new Set<string>()
    for (const col of storyColumns) {
      allIntersections.add(`${col.gridX}_${col.gridY}`)
    }

    // Add beam endpoint intersections
    const storyBeams = project.members.beams.filter(b => b.storyId === story.id)
    for (const beam of storyBeams) {
      const sp = parseNodeId(beam.startNodeId)
      const ep = parseNodeId(beam.endNodeId)
      if (sp) allIntersections.add(`${sp.gridX}_${sp.gridY}`)
      if (ep) allIntersections.add(`${ep.gridX}_${ep.gridY}`)
    }

    // Create master node for rigid diaphragm (centroid of story)
    const masterNodeId = `N_MASTER_${story.id}`
    const masterX = project.grid.xLines.reduce((s, l) => s + l.position, 0) / (project.grid.xLines.length || 1)
    const masterY = project.grid.yLines.reduce((s, l) => s + l.position, 0) / (project.grid.yLines.length || 1)
    const masterDOF = freeDOF()
    const masterNode: AnalyticalNode = {
      id: masterNodeId,
      x: masterX,
      y: masterY,
      z: story.level,
      dof: masterDOF,
    }
    nodes.push(masterNode)
    nodeMap.set(masterNodeId, masterNode)

    // Rigid diaphragm
    diaphragms.push({
      id: `DIAPH_${story.id}`,
      storyId: story.id,
      type: 'rigid',
      masterNodeId,
    })

    // Create structural nodes
    for (const key of allIntersections) {
      const [gridX, gridY] = key.split('_')
      const nId = makeNodeId(gridX, gridY, story.id)
      if (nodeMap.has(nId)) continue

      const pos = getNodePosition(gridX, gridY, story, project)
      if (!pos) continue

      const dof = rigidDiaphragmDOF(masterDOF)
      const node: AnalyticalNode = {
        id: nId,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        dof,
        physicalMemberId: storyColumns.find(c => c.gridX === gridX && c.gridY === gridY)?.id,
      }
      nodes.push(node)
      nodeMap.set(nId, node)
    }

    // ── Step 2: Base nodes (fixed supports at foundation) ──────
    if (story === project.grid.stories[0]) {
      for (const key of allIntersections) {
        const [gridX, gridY] = key.split('_')
        const baseId = makeBaseNodeId(gridX, gridY)
        if (nodeMap.has(baseId)) continue

        const xLine = project.grid.xLines.find(l => l.id === gridX)
        const yLine = project.grid.yLines.find(l => l.id === gridY)
        if (!xLine || !yLine) continue

        const baseNode: AnalyticalNode = {
          id: baseId,
          x: xLine.position,
          y: yLine.position,
          z: 0,
          dof: fixedDOF(),
        }
        nodes.push(baseNode)
        nodeMap.set(baseId, baseNode)

        restraints.push({
          nodeId: baseId,
          ux: true, uy: true, uz: true,
          rx: true, ry: true, rz: true,
          type: 'fixed',
        })
      }
    }
  }

  // ── Step 3: Column elements (vertical members) ───────────────
  for (const col of project.members.columns) {
    const story = project.grid.stories.find(s => s.id === col.storyId)
    if (!story) continue

    const topNodeId  = makeNodeId(col.gridX, col.gridY, col.storyId)
    const storyIndex = project.grid.stories.indexOf(story)

    let botNodeId: string
    if (storyIndex === 0) {
      botNodeId = makeBaseNodeId(col.gridX, col.gridY)
    } else {
      const prevStory = project.grid.stories[storyIndex - 1]
      botNodeId = makeNodeId(col.gridX, col.gridY, prevStory.id)
    }

    if (!nodeMap.has(topNodeId) || !nodeMap.has(botNodeId)) continue

    const secProps = columnSectionProps(col)
    const element: AnalyticalElement = {
      id: makeElementId('COL', col.id),
      type: 'frame',
      startNodeId: botNodeId,
      endNodeId: topNodeId,
      physicalMemberId: col.id,
      sectionProperties: secProps,
      materialProperties: matProps,
      localAxis: columnLocalAxis(),
      releases: {},  // fixed-fixed for columns
    }
    elements.push(element)
  }

  // ── Step 4: Beam elements (horizontal members) ───────────────
  for (const beam of project.members.beams) {
    const story = project.grid.stories.find(s => s.id === beam.storyId)
    if (!story) continue

    const sp = parseNodeId(beam.startNodeId)
    const ep = parseNodeId(beam.endNodeId)
    if (!sp || !ep) continue

    const startNodeId = makeNodeId(sp.gridX, sp.gridY, beam.storyId)
    const endNodeId   = makeNodeId(ep.gridX, ep.gridY, beam.storyId)

    if (!nodeMap.has(startNodeId) || !nodeMap.has(endNodeId)) continue

    const startNode = nodeMap.get(startNodeId)!
    const endNode   = nodeMap.get(endNodeId)!

    const secProps  = beamSectionProps(beam)
    const localAxis = beamLocalAxis(
      { x: startNode.x, y: startNode.y },
      { x: endNode.x,   y: endNode.y   }
    )

    // Cantilever → pin at far end
    const releases: MemberReleases = beam.isCantilever
      ? { endMx: true, endMy: true, endMz: true }
      : {}

    const element: AnalyticalElement = {
      id: makeElementId('BM', beam.id),
      type: 'frame',
      startNodeId,
      endNodeId,
      physicalMemberId: beam.id,
      sectionProperties: secProps,
      materialProperties: matProps,
      localAxis,
      releases,
    }
    elements.push(element)
  }

  return { nodes, elements, restraints, diaphragms }
}

// ── Validation ────────────────────────────────────────────────

export interface ModelValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  stats: {
    nodeCount: number
    elementCount: number
    columnCount: number
    beamCount: number
    dofCount: number
    restrainedDOF: number
    freeDOF: number
  }
}

export function validateAnalyticalModel(
  model: AnalyticalModel,
  project: CivilOSProject
): ModelValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  const colElements = model.elements.filter(e => e.id.startsWith('E_COL'))
  const bmElements  = model.elements.filter(e => e.id.startsWith('E_BM'))
  const freeDOFCount     = model.nodes.reduce((sum, n) => {
    return sum + Object.values(n.dof).filter(d => d > 0).length
  }, 0)
  const restrainedCount = model.restraints.length * 6

  // Checks
  if (project.members.columns.length === 0) {
    errors.push('কোনো কলাম নেই — কমপক্ষে ৪টি কলাম দিন')
  }
  if (project.members.beams.length === 0) {
    warnings.push('কোনো বিম নেই — শুধু কলাম দিয়ে বিশ্লেষণ সম্ভব কিন্তু অসম্পূর্ণ')
  }
  if (model.restraints.length === 0) {
    errors.push('কোনো Support নেই — ভবন unstable')
  }
  if (colElements.length !== project.members.columns.length) {
    warnings.push(`${project.members.columns.length - colElements.length} টি কলাম element তৈরি হয়নি`)
  }
  if (freeDOFCount < 6) {
    errors.push('সিস্টেমে পর্যাপ্ত DOF নেই')
  }

  // Check for floating nodes (no element connected)
  const connectedNodes = new Set<string>()
  for (const el of model.elements) {
    connectedNodes.add(el.startNodeId)
    connectedNodes.add(el.endNodeId)
  }
  const floatingNodes = model.nodes.filter(
    n => !connectedNodes.has(n.id) && !n.id.includes('MASTER') && !n.id.includes('BASE')
  )
  if (floatingNodes.length > 0) {
    warnings.push(`${floatingNodes.length} টি floating node আছে`)
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    stats: {
      nodeCount: model.nodes.length,
      elementCount: model.elements.length,
      columnCount: colElements.length,
      beamCount: bmElements.length,
      dofCount: freeDOFCount + restrainedCount,
      restrainedDOF: restrainedCount,
      freeDOF: freeDOFCount,
    },
  }
}

// ── Element length calculation ────────────────────────────────

export function elementLength(
  element: AnalyticalElement,
  model: AnalyticalModel
): number {
  const sn = model.nodes.find(n => n.id === element.startNodeId)
  const en = model.nodes.find(n => n.id === element.endNodeId)
  if (!sn || !en) return 0
  return Math.sqrt(
    Math.pow(en.x - sn.x, 2) +
    Math.pow(en.y - sn.y, 2) +
    Math.pow(en.z - sn.z, 2)
  )
}
