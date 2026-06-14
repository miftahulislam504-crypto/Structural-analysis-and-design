// ============================================================
// CivilOS Structural — FEM Runner
// Phase 15: Orchestrates Slab FEM · Raft FEM · P-Delta
// ============================================================

import { CivilOSProject } from '../../lib/types'
import {
  FEMMesh,
  FEMResults,
  SlabFEMConfig,
  RaftFEMConfig,
  PDeltaConfig,
  PDeltaResult,
  PunchingCheckInput,
  PunchingCheckResult,
  MaterialNonlinearResult,
  generateRectangularMesh,
  refineMeshAroundColumns,
  solveFEM,
  extractFEMResults,
  applyWinklerSprings,
  computeRaftSoilPressure,
  runPDeltaAnalysis,
  checkPunchingShear,
  checkMaterialNonlinearity,
} from './femEngine'

// ─────────────────────────────────────────────
// SLAB FEM RUNNER
// ─────────────────────────────────────────────

export interface SlabFEMRunResult {
  femResults: FEMResults
  punchingChecks: PunchingCheckResult[]
  nonlinearCheck: MaterialNonlinearResult[]
  mesh: FEMMesh
  deflectionStatus: 'PASS' | 'FAIL'
  deflectionLimit: number  // mm
  deflectionActual: number // mm
}

export function runSlabFEM(
  project: CivilOSProject,
  config: SlabFEMConfig
): SlabFEMRunResult {
  const { members, materials, grid } = project
  const slab = members.slabs.find(s => s.id === config.slabId)
  if (!slab) throw new Error(`Slab ${config.slabId} not found`)

  const story = grid.stories.find(s => s.id === slab.storyId)
  if (!story) throw new Error(`Story not found for slab`)

  const mat = materials.concrete
  const E  = mat.Ec     // MPa
  const nu = mat.poissonRatio ?? 0.2
  const t  = slab.thickness  // mm

  // Determine slab panel bounding box from grid
  // For rectangular slab: use first two xLines and yLines as panel extent
  const xCoords = grid.xLines.map(l => l.position).sort((a, b) => a - b)
  const yCoords = grid.yLines.map(l => l.position).sort((a, b) => a - b)

  // Take first panel (simplification; full implementation maps panelNodeIds to grid)
  const lx = xCoords.length >= 2 ? xCoords[1] - xCoords[0] : 4000
  const ly = yCoords.length >= 2 ? yCoords[1] - yCoords[0] : 4000

  // Load intensity from project
  const q = (project.loads.liveLoad.liveLoad + project.loads.deadLoad.superimposedDL) * 1.2
    + project.loads.deadLoad.superimposedDL * 0.4  // factored
  // kN/m² (approximation; full load combo from loadCaseId in V2)

  // Generate mesh
  let mesh = generateRectangularMesh(
    0, 0, story.level,
    lx, ly,
    config.meshSize,
    t,
    mat.id,
    q
  )

  // Refine around columns
  const columnPositions = config.columnIds.map(cid => {
    const col = members.columns.find(c => c.id === cid)
    if (!col) return null
    const xLine = grid.xLines.find(l => l.id === col.gridX)
    const yLine = grid.yLines.find(l => l.id === col.gridY)
    if (!xLine || !yLine) return null
    const size = col.section.type === 'rectangular'
      ? Math.max(col.section.width, col.section.depth)
      : col.section.diameter
    return { x: xLine.position, y: yLine.position, size }
  }).filter(Boolean) as Array<{ x: number; y: number; size: number }>

  if (columnPositions.length > 0) {
    mesh = refineMeshAroundColumns(mesh, columnPositions)
  }

  // Apply fixed BCs on beam supports (perimeter nodes)
  const perimeterNodes = getPerimeterNodes(mesh)
  mesh.boundaryConditions = perimeterNodes.map(nid => ({
    nodeId: nid,
    w: true,
    thetaX: slab.type === 'flat_slab' ? false : false,  // simple support
    thetaY: slab.type === 'flat_slab' ? false : false,
  }))

  // Solve
  const { displacements } = solveFEM(mesh, E, nu)
  const nodeIndex: Record<string, number> = {}
  mesh.nodes.forEach((n, i) => { nodeIndex[n.id] = i })
  const femResults = extractFEMResults(mesh, displacements, nodeIndex, E, nu)

  // Punching checks at each column
  const punchingChecks: PunchingCheckResult[] = columnPositions.map((col, idx) => {
    const colMember = members.columns.find(c => {
      const xl = grid.xLines.find(l => l.id === c.gridX)
      const yl = grid.yLines.find(l => l.id === c.gridY)
      return xl && yl && Math.abs(xl.position - col.x) < 1 && Math.abs(yl.position - col.y) < 1
    })

    const Vu = project.results.memberForces.find(
      mf => mf.elementId === colMember?.id
    )?.stations[0]?.N ?? 200  // kN default if analysis not run

    const punchInput: PunchingCheckInput = {
      Vu: Math.abs(Vu),
      fc: mat.fc,
      d: t - slab.clearCover - 10,  // effective depth (assuming D10 bar)
      columnB: colMember?.section.type === 'rectangular' ? colMember.section.width  : (colMember?.section as any).diameter ?? 300,
      columnH: colMember?.section.type === 'rectangular' ? colMember.section.depth  : (colMember?.section as any).diameter ?? 300,
      colPosition: idx === 0 ? 'interior' : 'edge',
      lambda: 1.0,
    }
    return checkPunchingShear(punchInput)
  })

  // Nonlinear check
  const nonlinearCheck = checkMaterialNonlinearity(femResults.elementResults, mat.fc, t)

  // Deflection check — ACI 318-19 §24.2
  const span = Math.max(lx, ly) / 1000  // m
  const deflLimit = span * 1000 / 480    // mm (long-term, affecting partitions)

  return {
    femResults: {
      ...femResults,
      maxPunchingRatio: punchingChecks.length
        ? Math.max(...punchingChecks.map(p => p.ratio))
        : 0,
    },
    punchingChecks,
    nonlinearCheck,
    mesh,
    deflectionStatus: femResults.maxDeflection <= deflLimit ? 'PASS' : 'FAIL',
    deflectionLimit: deflLimit,
    deflectionActual: femResults.maxDeflection,
  }
}

// ─────────────────────────────────────────────
// RAFT FEM RUNNER
// ─────────────────────────────────────────────

export interface RaftFEMRunResult {
  femResults: FEMResults
  mesh: FEMMesh
  maxSoilPressure: number   // kN/m²
  allowablePressure: number // kN/m²
  bearingStatus: 'PASS' | 'FAIL'
  differentialSettlement: number  // mm
  settlingStatus: 'PASS' | 'FAIL'
}

export function runRaftFEM(
  project: CivilOSProject,
  config: RaftFEMConfig
): RaftFEMRunResult {
  const { members, materials, grid } = project
  const foundation = members.foundations.find(f => f.id === config.foundationId)
  if (!foundation) throw new Error(`Foundation ${config.foundationId} not found`)

  const mat = materials.concrete
  const E  = mat.Ec
  const nu = mat.poissonRatio ?? 0.2

  // Generate raft mesh
  let mesh = generateRectangularMesh(
    0, 0, 0,
    foundation.length,
    foundation.width,
    config.meshSize,
    foundation.thickness,
    mat.id,
    0  // loads come from column reactions
  )

  // Apply column loads as point loads (distributed over nearby nodes)
  const columnLoads = foundation.columnIds.map(cid => {
    const col = members.columns.find(c => c.id === cid)
    if (!col) return null
    const xLine = grid.xLines.find(l => l.id === col.gridX)
    const yLine = grid.yLines.find(l => l.id === col.gridY)
    const P = project.results.supportReactions.find(r =>
      r.nodeId.includes(col.gridX) && r.nodeId.includes(col.gridY)
    )?.Fz ?? 500  // kN default
    if (!xLine || !yLine) return null
    return { x: xLine.position, y: yLine.position, P: Math.abs(P) }
  }).filter(Boolean) as Array<{ x: number; y: number; P: number }>

  // Distribute column point loads to mesh nodes
  mesh = distributeColumnLoadsToMesh(mesh, columnLoads)

  // Apply Winkler soil springs
  mesh = applyWinklerSprings(mesh, config.soilModulus)

  // Solve
  const { displacements } = solveFEM(mesh, E, nu, config.soilModulus)
  const nodeIndex: Record<string, number> = {}
  mesh.nodes.forEach((n, i) => { nodeIndex[n.id] = i })
  const femResults = extractFEMResults(mesh, displacements, nodeIndex, E, nu)

  // Soil pressure
  const nodeResultsWithPressure = computeRaftSoilPressure(
    femResults.nodeResults, config.soilModulus
  )
  const maxSoilPressure = Math.max(...nodeResultsWithPressure.map(r => r.soilPressure ?? 0))

  // Differential settlement (max - min deflection)
  const wValues = nodeResultsWithPressure.map(r => r.w)
  const differentialSettlement = Math.max(...wValues) - Math.min(...wValues)

  // BNBC bearing capacity
  const allowablePressure = foundation.soilBearingCapacity

  return {
    femResults: { ...femResults, nodeResults: nodeResultsWithPressure },
    mesh,
    maxSoilPressure,
    allowablePressure,
    bearingStatus: maxSoilPressure <= allowablePressure ? 'PASS' : 'FAIL',
    differentialSettlement,
    settlingStatus: differentialSettlement <= 25 ? 'PASS' : 'FAIL',  // 25mm BNBC limit
  }
}

// ─────────────────────────────────────────────
// P-DELTA RUNNER
// ─────────────────────────────────────────────

export function runPDelta(
  project: CivilOSProject,
  config: PDeltaConfig
): PDeltaResult {
  const { grid, results, members } = project

  if (results.status !== 'complete') {
    return {
      converged: false,
      iterations: 0,
      amplificationFactor: 1.0,
      storyDrifts: [],
      errorLog: ['Linear analysis must be run first (Phase 4)'],
    }
  }

  // Build first-order drift data from analysis results
  const firstOrderData = (results.storyDrifts ?? []).map(sd => {
    const story = grid.stories.find(s => s.id === sd.storyId)
    const H = story?.height ?? 3000  // mm

    // ΣPu = sum of column axial loads at this story
    const storyColumns = members.columns.filter(c => c.storyId === sd.storyId)
    const ΣPu = storyColumns.reduce((sum, col) => {
      const colForce = results.memberForces.find(mf => mf.elementId === col.id)
      const N = colForce?.stations[0]?.N ?? 0
      return sum + Math.abs(N)
    }, 0)

    // ΔH = max of x or y drift
    const ΔH = Math.max(sd.driftX, sd.driftY) * H

    // H (lateral force at story) — from seismic/wind analysis
    const storyH = estimateStoryShear(project, sd.storyId)

    return {
      storyId: sd.storyId,
      drift: sd.driftX,
      ΣPu,
      ΔH,
      H: storyH,
    }
  })

  return runPDeltaAnalysis(project, firstOrderData, config)
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function getPerimeterNodes(mesh: FEMMesh): string[] {
  const xs = mesh.nodes.map(n => n.x)
  const ys = mesh.nodes.map(n => n.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)
  const tol = 1  // mm tolerance

  return mesh.nodes
    .filter(n =>
      Math.abs(n.x - xMin) < tol || Math.abs(n.x - xMax) < tol ||
      Math.abs(n.y - yMin) < tol || Math.abs(n.y - yMax) < tol
    )
    .map(n => n.id)
}

function distributeColumnLoadsToMesh(
  mesh: FEMMesh,
  loads: Array<{ x: number; y: number; P: number }>
): FEMMesh {
  const updatedElements = mesh.elements.map(el => {
    const elNodes = el.nodeIds.slice(0, 4).map(nid => mesh.nodes.find(n => n.id === nid)!)
    const cx = elNodes.reduce((s, n) => s + n.x, 0) / elNodes.length
    const cy = elNodes.reduce((s, n) => s + n.y, 0) / elNodes.length

    // Find nearest column load
    const nearest = loads.reduce<{ dist: number; load: typeof loads[0] | null }>(
      (best, load) => {
        const d = Math.sqrt((cx - load.x) ** 2 + (cy - load.y) ** 2)
        return d < best.dist ? { dist: d, load } : best
      },
      { dist: Infinity, load: null }
    )

    // Apply load to elements within 500mm of column
    if (nearest.load && nearest.dist < 500) {
      // Distribute P over area: intensity = P / area (kN/m²)
      const area = elementArea(elNodes.map(n => ({ x: n.x, y: n.y }))) * 1e-6  // m²
      const intensity = nearest.load.P / Math.max(area, 0.01)
      return { ...el, loadIntensity: el.loadIntensity + intensity }
    }
    return el
  })

  return { ...mesh, elements: updatedElements }
}

function elementArea(nodes: Array<{ x: number; y: number }>): number {
  let area = 0
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += nodes[i].x * nodes[j].y - nodes[j].x * nodes[i].y
  }
  return Math.abs(area) / 2
}

function estimateStoryShear(project: CivilOSProject, storyId: string): number {
  // Approximate story shear from BNBC seismic base shear distribution
  const { seismicLoad } = project.loads
  const { grid, members } = project

  // Simplified Fx = Cvx × V distribution
  const storyIdx = grid.stories.findIndex(s => s.id === storyId)
  const totalStories = grid.stories.length

  // Linear distribution (top story gets most)
  const V = 200  // kN placeholder; real value from seismicLoad engine
  const storyFraction = (storyIdx + 1) / ((totalStories * (totalStories + 1)) / 2)
  return V * storyFraction || 100  // kN
}
