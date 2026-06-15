// ============================================================
// CivilOS Structural — DSM Solver
// Phase 4: Direct Stiffness Method
// Solves: [K]{U} = {F} for nodal displacements
// Then extracts support reactions + member forces
// ============================================================

import {
  AnalyticalModel,
  AnalysisResults,
  NodeDisplacement,
  SupportReaction,
  MemberForces,
  ForceStation,
  LoadDefinition,
  CivilOSProject,
} from '../../lib/types'
import {
  assembleGlobalStiffness,
  localStiffnessMatrix,
  transformationMatrix,
  transpose,
  matMul,
} from './stiffnessMatrix'

// ── Load Vector Assembly ─────────────────────────────────────
//
// Converts LoadDefinition → Nodal Force Vector {F}
// For Phase 4: Gravity loads (DL + LL) distributed to nodes
// Wind/Seismic lateral loads added in Phase 5

export function assembleLoadVector(
  model: AnalyticalModel,
  project: CivilOSProject,
  loadCaseId: string,
  totalDOF: number
): number[] {
  const F = new Array(totalDOF).fill(0)
  const dofMap = buildDOFMap(model)
  const { loads, grid, members, materials } = project

  // Determine load factors from combination
  const combo = loads.loadCombinations.find(lc => lc.id === loadCaseId)
  const DLfactor = combo?.factors.find(f => f.loadType === 'D')?.factor ?? 1.2
  const LLfactor = combo?.factors.find(f => f.loadType === 'L')?.factor ?? 1.6

  // ── Beam loads: distributed load → fixed-end forces ─────────
  for (const beam of members.beams) {
    const story = grid.stories.find(s => s.id === beam.storyId)
    if (!story) continue

    const sp = parseNodeId(beam.startNodeId)
    const ep = parseNodeId(beam.endNodeId)
    if (!sp || !ep) continue

    const startNodeId = `N_${sp.gridX}_${sp.gridY}_${beam.storyId}`
    const endNodeId   = `N_${ep.gridX}_${ep.gridY}_${beam.storyId}`

    const startNode = model.nodes.find(n => n.id === startNodeId)
    const endNode   = model.nodes.find(n => n.id === endNodeId)
    if (!startNode || !endNode) continue

    // Beam length
    const dx = endNode.x - startNode.x
    const dy = endNode.y - startNode.y
    const L  = Math.sqrt(dx * dx + dy * dy) / 1000  // m

    // Tributary width (assume half bay each side) — simplified 0.5 * avg bay
    const tributaryWidth = estimateTributaryWidth(beam, project) // m

    // Distributed load on beam (kN/m)
    const wDL = DLfactor * (
      (loads.deadLoad.superimposedDL ?? loads.deadLoad.deadLoad ?? 0) * tributaryWidth +
      (loads.deadLoad.wallLoad ?? 0)
    )
    const wLL = LLfactor * loads.liveLoad.liveLoad * tributaryWidth
    const w   = wDL + wLL  // kN/m total

    // Gravity (Z-direction, downward = negative)
    // Fixed-end reactions for UDL on simply-supported beam:
    //   Ry at each end = wL/2 (vertical)
    //   Mz at ends     = ±wL²/12 (fixed-fixed)
    const Ry  = w * L / 2   // kN
    const Mz  = w * L * L / 12  // kN·m

    // Apply to start node
    const sDOFs = dofMap.get(startNodeId) ?? []
    applyForce(F, sDOFs, 2, -Ry * 1000)    // uz (N) downward
    applyForce(F, sDOFs, 5, -Mz * 1e6)     // rz (N·mm)

    // Apply to end node
    const eDOFs = dofMap.get(endNodeId) ?? []
    applyForce(F, eDOFs, 2, -Ry * 1000)    // uz (N)
    applyForce(F, eDOFs, 5,  Mz * 1e6)     // rz (N·mm) opposite sign
  }

  // ── Column self-weight → lumped at top node ──────────────────
  for (const col of members.columns) {
    const story = grid.stories.find(s => s.id === col.storyId)
    if (!story) continue

    const topNodeId = `N_${col.gridX}_${col.gridY}_${col.storyId}`
    const topDOFs   = dofMap.get(topNodeId) ?? []

    // Column cross-section area
    let area = 0
    if (col.section.type === 'rectangular') {
      area = (col.section.width / 1000) * (col.section.depth / 1000)  // m²
    } else {
      area = Math.PI * Math.pow(col.section.diameter / 2000, 2)
    }

    const selfWeight = DLfactor * materials.concrete.unitWeight * area * (story.height / 1000)  // kN
    applyForce(F, topDOFs, 2, -selfWeight * 1000)  // downward (N)
  }

  return F
}

function applyForce(F: number[], dofs: number[], localDOF: number, value: number) {
  const gDOF = dofs[localDOF]
  if (gDOF >= 0 && gDOF < F.length) {
    F[gDOF] += value
  }
}

function estimateTributaryWidth(beam: any, project: CivilOSProject): number {
  // Simplified: use average bay spacing / 2
  const avgX = project.grid.xLines.length > 1
    ? (project.grid.xLines.at(-1)!.position - project.grid.xLines[0].position) /
      ((project.grid.xLines.length - 1) * 1000)
    : 4
  const avgY = project.grid.yLines.length > 1
    ? (project.grid.yLines.at(-1)!.position - project.grid.yLines[0].position) /
      ((project.grid.yLines.length - 1) * 1000)
    : 4
  return Math.min((avgX + avgY) / 4, 3.0)  // m, capped at 3m
}

// ── Gaussian Elimination Solver ───────────────────────────────
//
// Solves K·U = F using partial pivoting
// Returns displacement vector U (mm, radians)

export function gaussianElimination(K: number[][], F: number[]): number[] | null {
  const n = K.length
  // Build augmented matrix [K | F]
  const aug: number[][] = K.map((row, i) => [...row, F[i]])

  for (let col = 0; col < n; col++) {
    // Partial pivot
    let maxRow = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-10) {
      console.warn(`Singular matrix at DOF ${col} — check supports`)
      return null
    }

    // Eliminate
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col] / pivot
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j]
      }
    }

    // Normalize pivot row
    for (let j = col; j <= n; j++) aug[col][j] /= pivot
  }

  return aug.map(row => row[n])
}

// ── Support Reaction Extraction ───────────────────────────────

export function extractReactions(
  model: AnalyticalModel,
  U: number[],
  K_full: number[][],
  F: number[],
  loadCaseId: string
): SupportReaction[] {
  const reactions: SupportReaction[] = []
  const dofMap = buildDOFMap(model)

  for (const restraint of model.restraints) {
    const node = model.nodes.find(n => n.id === restraint.nodeId)
    if (!node) continue

    const dofs = dofMap.get(restraint.nodeId) ?? []

    // Reaction = K_row · U - F_row (for each restrained DOF)
    // Simplified: sum contributions from connected elements
    let Fx = 0, Fy = 0, Fz = 0, Mx = 0, My = 0, Mz = 0

    // For base nodes: reaction = sum of forces from attached column elements
    const connectedElements = model.elements.filter(
      el => el.startNodeId === restraint.nodeId || el.endNodeId === restraint.nodeId
    )

    for (const el of connectedElements) {
      const forces = elementForces(el, model, U)
      if (!forces) continue

      const isStart = el.startNodeId === restraint.nodeId
      const offset  = isStart ? 0 : 6

      // Local forces at this end
      const fLoc = forces.slice(offset, offset + 6)

      // Transform to global (fall back to identity if localAxis absent)
      const ax  = el.localAxis ?? {
        x: [1, 0, 0] as [number,number,number],
        y: [0, 1, 0] as [number,number,number],
        z: [0, 0, 1] as [number,number,number],
      }
      const T3  = [ax.x, ax.y, ax.z]  // 3×3 rotation

      Fx += T3[0][0] * fLoc[0] + T3[1][0] * fLoc[1] + T3[2][0] * fLoc[2]
      Fy += T3[0][1] * fLoc[0] + T3[1][1] * fLoc[1] + T3[2][1] * fLoc[2]
      Fz += T3[0][2] * fLoc[0] + T3[1][2] * fLoc[1] + T3[2][2] * fLoc[2]
      Mx += T3[0][0] * fLoc[3] + T3[1][0] * fLoc[4] + T3[2][0] * fLoc[5]
      My += T3[0][1] * fLoc[3] + T3[1][1] * fLoc[4] + T3[2][1] * fLoc[5]
      Mz += T3[0][2] * fLoc[3] + T3[1][2] * fLoc[4] + T3[2][2] * fLoc[5]
    }

    reactions.push({
      nodeId: restraint.nodeId,
      loadCaseId,
      Fx: Fx / 1000,   // N → kN
      Fy: Fy / 1000,
      Fz: Fz / 1000,
      Mx: Mx / 1e6,    // N·mm → kN·m
      My: My / 1e6,
      Mz: Mz / 1e6,
    })
  }

  return reactions
}

// ── Member Force Extraction ───────────────────────────────────
//
// For each element, compute local forces at 11 stations along length

export function extractMemberForces(
  model: AnalyticalModel,
  U: number[],
  loadCaseId: string,
  project: CivilOSProject
): MemberForces[] {
  const results: MemberForces[] = []

  for (const element of model.elements) {
    const localF = elementForces(element, model, U)
    if (!localF) continue

    const L     = elemLength(element, model)
    const Nstations = 11
    const stations: ForceStation[] = []

    // Internal forces at start
    const N0  =  localF[0]   // axial (N)
    const Vy0 =  localF[1]   // shear Y (N)
    const Vz0 =  localF[2]   // shear Z (N)
    const T0  =  localF[3]   // torsion (N·mm)
    const My0 =  localF[4]   // moment Y (N·mm)
    const Mz0 =  localF[5]   // moment Z (N·mm)

    // Distributed load (simplified: gravity only)
    const beam = project.members.beams.find(b =>
      element.physicalMemberId === b.id
    )
    const w = beam ? estimateBeamUDL(beam, project) : 0  // N/mm

    for (let i = 0; i < Nstations; i++) {
      const x = (i / (Nstations - 1)) * L  // mm from start

      // Linear variation for axial (constant for uniform member)
      // Shear varies linearly under UDL; Moment parabolic
      const N  =  N0
      const Vy = -Vy0 + w * x                          // N
      const Vz = -Vz0
      const T  =  T0
      const My =  My0 + Vz0 * x                        // N·mm
      const Mz = -Mz0 + Vy0 * x - 0.5 * w * x * x    // N·mm (parabolic under UDL)

      stations.push({
        position: x,
        N:  N  / 1000,      // → kN
        Vy: Vy / 1000,      // → kN
        Vz: Vz / 1000,
        T:  T  / 1e6,       // → kN·m
        My: My / 1e6,
        Mz: Mz / 1e6,
      })
    }

    results.push({ elementId: element.id, loadCaseId, stations })
  }

  return results
}

// ── Nodal Displacement Extraction ────────────────────────────

export function extractDisplacements(
  model: AnalyticalModel,
  U: number[],
  loadCaseId: string
): NodeDisplacement[] {
  const displacements: NodeDisplacement[] = []
  const dofMap = buildDOFMap(model)

  for (const node of model.nodes) {
    const dofs = dofMap.get(node.id) ?? []
    const getU = (d: number) => (d >= 0 && d < U.length ? U[d] : 0)

    displacements.push({
      nodeId: node.id,
      loadCaseId,
      ux: getU(dofs[0]),
      uy: getU(dofs[1]),
      uz: getU(dofs[2]),
      rx: getU(dofs[3]),
      ry: getU(dofs[4]),
      rz: getU(dofs[5]),
    })
  }

  return displacements
}

// ── Story Drift Calculation ───────────────────────────────────

export function calculateStoryDrifts(
  model: AnalyticalModel,
  U: number[],
  project: CivilOSProject,
  loadCaseId: string
) {
  const dofMap = buildDOFMap(model)
  const drifts = []

  for (const story of project.grid.stories) {
    const masterNodeId = `N_MASTER_${story.id}`
    const masterDOFs   = dofMap.get(masterNodeId) ?? []
    const getU = (d: number) => (d >= 0 && d < U.length ? U[d] : 0)

    const dx = getU(masterDOFs[0])  // mm
    const dy = getU(masterDOFs[1])  // mm
    const h  = story.height         // mm

    const driftX = Math.abs(dx) / h
    const driftY = Math.abs(dy) / h
    const limit  = 0.025  // BNBC 2020

    drifts.push({
      storyId: loadCaseId,
      loadCaseId,
      driftX,
      driftY,
      limit,
      passed: driftX <= limit && driftY <= limit,
    })
  }

  return drifts
}

// ── Helpers ───────────────────────────────────────────────────

function buildDOFMap(model: AnalyticalModel): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const node of model.nodes) {
    const d = node.dof
    map.set(node.id, [
      d.ux > 0 ? d.ux - 1 : -1,
      d.uy > 0 ? d.uy - 1 : -1,
      d.uz > 0 ? d.uz - 1 : -1,
      d.rx > 0 ? d.rx - 1 : -1,
      d.ry > 0 ? d.ry - 1 : -1,
      d.rz > 0 ? d.rz - 1 : -1,
    ])
  }
  return map
}

function parseNodeId(nodeId: string): { gridX: string; gridY: string } | null {
  const parts = nodeId.split('_')
  if (nodeId.startsWith('node_') && parts.length >= 3)
    return { gridX: parts[1], gridY: parts[2] }
  if (nodeId.startsWith('N_') && parts.length >= 4)
    return { gridX: parts[1], gridY: parts[2] }
  return null
}

function elemLength(el: any, model: AnalyticalModel): number {
  const sn = model.nodes.find(n => n.id === el.startNodeId)
  const en = model.nodes.find(n => n.id === el.endNodeId)
  if (!sn || !en) return 0
  return Math.sqrt((en.x-sn.x)**2 + (en.y-sn.y)**2 + (en.z-sn.z)**2)
}

function elementForces(
  element: any,
  model: AnalyticalModel,
  U: number[]
): number[] | null {
  const L  = elemLength(element, model)
  if (L < 1) return null

  const sp = element.sectionProperties
  const mp = element.materialProperties
  const ax = element.localAxis

  const kL = localStiffnessMatrix(mp.E, mp.G, sp.area, sp.Ix, sp.Iy, sp.J, L)
  const T  = transformationMatrix(ax.x, ax.y, ax.z)

  const dofMap = buildDOFMap(model)
  const sDOFs  = dofMap.get(element.startNodeId) ?? []
  const eDOFs  = dofMap.get(element.endNodeId)   ?? []
  const allDOFs = [...sDOFs, ...eDOFs]

  const u_global: number[] = allDOFs.map(d => (d >= 0 && d < U.length ? U[d] : 0))
  // Transform to local: u_local = T * u_global
  const u_local = matMulVec(T, u_global)
  // Local forces = k_local * u_local
  return matMulVec(kL, u_local)
}

function matMulVec(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, val, j) => sum + val * v[j], 0))
}

function estimateBeamUDL(beam: any, project: CivilOSProject): number {
  // kN/m → N/mm
  const trib = Math.min(estimateTributaryWidthFromProject(project), 3.0)
  const DLfactor = 1.2
  const LLfactor = 1.6
  const w = DLfactor * (
    (project.loads.deadLoad.superimposedDL ?? project.loads.deadLoad.deadLoad ?? 0) * trib +
    (project.loads.deadLoad.wallLoad ?? 0)
  ) + LLfactor * project.loads.liveLoad.liveLoad * trib
  return w / 1000  // kN/m → N/mm
}

function estimateTributaryWidthFromProject(project: CivilOSProject): number {
  const avgX = project.grid.xLines.length > 1
    ? (project.grid.xLines.at(-1)!.position - project.grid.xLines[0].position) /
      ((project.grid.xLines.length - 1) * 1000)
    : 4
  const avgY = project.grid.yLines.length > 1
    ? (project.grid.yLines.at(-1)!.position - project.grid.yLines[0].position) /
      ((project.grid.yLines.length - 1) * 1000)
    : 4
  return (avgX + avgY) / 4
}
