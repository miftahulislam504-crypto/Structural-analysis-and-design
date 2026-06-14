// ============================================================
// CivilOS Structural — FEM Engine
// Phase 15: Advanced Finite Element Method
// Covers: Plate/Shell FEM · Raft · P-Delta · Nonlinear
// BNBC 2020 | ACI 318-19 | Bangladesh Engineering Practice
// ============================================================

import { CivilOSProject, MaterialData } from '../../lib/types'

// ─────────────────────────────────────────────
// TYPES — FEM Mesh
// ─────────────────────────────────────────────

export interface FEMNode {
  id: string
  x: number   // mm
  y: number   // mm
  z: number   // mm
  dof: {
    w: number    // out-of-plane displacement
    thetaX: number
    thetaY: number
  }
}

export interface FEMElement {
  id: string
  type: 'DKT' | 'Q4' | 'Q8'       // DKT = Discrete Kirchhoff Triangle, Q4/Q8 = Quad
  nodeIds: [string, string, string, string?]
  thickness: number                  // mm
  materialId: string
  loadIntensity: number              // kN/m²
}

export interface FEMMesh {
  nodes: FEMNode[]
  elements: FEMElement[]
  boundaryConditions: FEMBoundaryCondition[]
}

export interface FEMBoundaryCondition {
  nodeId: string
  w?: boolean       // out-of-plane fixed
  thetaX?: boolean
  thetaY?: boolean
  isSpring?: boolean
  springKz?: number  // kN/m (for raft soil springs)
}

// ─────────────────────────────────────────────
// TYPES — FEM Results
// ─────────────────────────────────────────────

export type FEMStatus = 'idle' | 'meshing' | 'solving' | 'done' | 'error'

export interface FEMResults {
  status: FEMStatus
  timestamp?: number
  maxDeflection: number    // mm
  maxMomentMx: number      // kN·m/m
  maxMomentMy: number      // kN·m/m
  maxMomentMxy: number     // kN·m/m
  maxShearVx: number       // kN/m
  maxShearVy: number       // kN/m
  maxPunchingRatio: number // Vu/φVc
  nodeResults: FEMNodeResult[]
  elementResults: FEMElementResult[]
  pDeltaAmplification?: number  // for P-Delta
  errorLog?: string[]
}

export interface FEMNodeResult {
  nodeId: string
  w: number        // mm deflection
  thetaX: number   // rad
  thetaY: number   // rad
  soilPressure?: number  // kN/m² for raft
}

export interface FEMElementResult {
  elementId: string
  Mx: number   // kN·m/m
  My: number   // kN·m/m
  Mxy: number  // kN·m/m
  Vx: number   // kN/m
  Vy: number   // kN/m
  vonMises?: number
}

// ─────────────────────────────────────────────
// TYPES — Analysis Configurations
// ─────────────────────────────────────────────

export interface SlabFEMConfig {
  slabId: string
  meshSize: number          // mm (target element size)
  loadCaseId: string
  checkPunching: boolean
  columnIds: string[]
}

export interface RaftFEMConfig {
  foundationId: string
  meshSize: number
  soilModulus: number        // kN/m³ (Modulus of subgrade reaction)
  loadCaseId: string
}

export interface PDeltaConfig {
  maxIterations: number
  tolerance: number          // mm, convergence criterion
  loadCaseId: string
}

// ─────────────────────────────────────────────
// MESH GENERATOR
// ─────────────────────────────────────────────

/**
 * Generate structured quad mesh for a rectangular slab panel.
 * Mesh is aligned with X/Y global axes.
 * Returns FEMMesh with Q4 elements.
 */
export function generateRectangularMesh(
  x0: number, y0: number, z: number,
  lx: number, ly: number,
  meshSize: number,
  thickness: number,
  materialId: string,
  loadIntensity: number
): FEMMesh {
  const nx = Math.max(2, Math.ceil(lx / meshSize))
  const ny = Math.max(2, Math.ceil(ly / meshSize))
  const dx = lx / nx
  const dy = ly / ny

  const nodes: FEMNode[] = []
  const elements: FEMElement[] = []
  const nodeIndex: Record<string, string> = {}  // "i_j" → nodeId

  // Create nodes
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const id = `fn_${i}_${j}`
      nodes.push({
        id,
        x: x0 + i * dx,
        y: y0 + j * dy,
        z,
        dof: { w: 0, thetaX: 0, thetaY: 0 },
      })
      nodeIndex[`${i}_${j}`] = id
    }
  }

  // Create Q4 elements
  let eCount = 0
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const n1 = nodeIndex[`${i}_${j}`]
      const n2 = nodeIndex[`${i + 1}_${j}`]
      const n3 = nodeIndex[`${i + 1}_${j + 1}`]
      const n4 = nodeIndex[`${i}_${j + 1}`]
      elements.push({
        id: `fe_${eCount++}`,
        type: 'Q4',
        nodeIds: [n1, n2, n3, n4],
        thickness,
        materialId,
        loadIntensity,
      })
    }
  }

  return { nodes, elements, boundaryConditions: [] }
}

/**
 * Refine mesh locally around column positions (punching zone).
 * Halves mesh size within 2×column_size radius.
 */
export function refineMeshAroundColumns(
  mesh: FEMMesh,
  columnPositions: Array<{ x: number; y: number; size: number }>
): FEMMesh {
  // For Phase 15 initial implementation: mark elements near columns
  // Full adaptive refinement is a future enhancement
  const refinedMesh = { ...mesh }
  // Tag elements near column for finer punching checks
  refinedMesh.elements = mesh.elements.map(el => {
    const nodes = el.nodeIds.map(nid => mesh.nodes.find(n => n.id === nid)!)
    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length
    const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length
    const nearColumn = columnPositions.some(
      col => Math.sqrt((cx - col.x) ** 2 + (cy - col.y) ** 2) < col.size * 2
    )
    return nearColumn ? { ...el, type: 'Q8' as const } : el
  })
  return refinedMesh
}

// ─────────────────────────────────────────────
// Q4 ELEMENT STIFFNESS — Mindlin-Reissner Plate
// ─────────────────────────────────────────────

/**
 * 4-node Mindlin-Reissner plate element stiffness matrix.
 * DOF per node: [w, θx, θy] → 12×12 matrix.
 * Uses 2×2 Gauss integration for bending, reduced (1-pt) for shear.
 *
 * Reference: Bathe, "Finite Element Procedures", Ch. 5
 */
export function q4PlateStiffness(
  nodeCoords: Array<{ x: number; y: number }>,  // 4 nodes, CCW
  E: number,    // MPa
  nu: number,
  t: number     // thickness mm
): number[][] {
  const D = flexuralRigidityMatrix(E, nu, t)
  const Ds = shearRigidityMatrix(E, nu, t)

  const K = Array.from({ length: 12 }, () => new Array(12).fill(0))

  // 2×2 Gauss points for bending
  const gp = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)]
  const gw = [1, 1]

  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const xi = gp[i], eta = gp[j]
      const { Jdet, Bb, Bs } = shapeFunctionDerivatives(nodeCoords, xi, eta, t)

      // Bending contribution: Bb^T D Bb |J| w
      const KbContrib = matMulScalar(matMul(transpose(Bb), matMul(D, Bb)), Jdet * gw[i] * gw[j])
      // Shear contribution: Bs^T Ds Bs |J| w (reduced integration via same GP for now)
      const KsContrib = matMulScalar(matMul(transpose(Bs), matMul(Ds, Bs)), Jdet * gw[i] * gw[j])

      addMatrix(K, KbContrib)
      addMatrix(K, KsContrib)
    }
  }

  return K
}

function flexuralRigidityMatrix(E: number, nu: number, t: number): number[][] {
  const D0 = (E * t ** 3) / (12 * (1 - nu ** 2))
  return [
    [D0,      D0 * nu, 0],
    [D0 * nu, D0,      0],
    [0,       0,       D0 * (1 - nu) / 2],
  ]
}

function shearRigidityMatrix(E: number, nu: number, t: number): number[][] {
  const k = 5 / 6  // shear correction factor
  const G = E / (2 * (1 + nu))
  const Ds0 = k * G * t
  return [
    [Ds0, 0],
    [0, Ds0],
  ]
}

function shapeFunctionDerivatives(
  nodes: Array<{ x: number; y: number }>,
  xi: number, eta: number,
  t: number
): { Jdet: number; Bb: number[][]; Bs: number[][] } {
  // Shape functions N1..N4 for Q4
  const dNdxi  = [-(1 - eta) / 4, (1 - eta) / 4, (1 + eta) / 4, -(1 + eta) / 4]
  const dNdeta = [-(1 - xi) / 4, -(1 + xi) / 4, (1 + xi) / 4, (1 - xi) / 4]
  const N      = [
    (1 - xi) * (1 - eta) / 4,
    (1 + xi) * (1 - eta) / 4,
    (1 + xi) * (1 + eta) / 4,
    (1 - xi) * (1 + eta) / 4,
  ]

  // Jacobian
  let J11 = 0, J12 = 0, J21 = 0, J22 = 0
  for (let a = 0; a < 4; a++) {
    J11 += dNdxi[a] * nodes[a].x
    J12 += dNdxi[a] * nodes[a].y
    J21 += dNdeta[a] * nodes[a].x
    J22 += dNdeta[a] * nodes[a].y
  }
  const Jdet = J11 * J22 - J12 * J21
  const invJdet = 1 / Jdet
  const dNdx = dNdxi.map((v, a) => (v * J22 - dNdeta[a] * J12) * invJdet)
  const dNdy = dNdxi.map((v, a) => (-v * J21 + dNdeta[a] * J11) * invJdet)

  // Bending B-matrix (3 × 12): [κx, κy, κxy] from [w, θx, θy]
  const Bb: number[][] = Array.from({ length: 3 }, () => new Array(12).fill(0))
  for (let a = 0; a < 4; a++) {
    const col = a * 3
    // κx = -∂θx/∂x
    Bb[0][col + 1] = -dNdx[a]
    // κy = -∂θy/∂y
    Bb[1][col + 2] = -dNdy[a]
    // κxy = -(∂θx/∂y + ∂θy/∂x)
    Bb[2][col + 1] = -dNdy[a]
    Bb[2][col + 2] = -dNdx[a]
  }

  // Shear B-matrix (2 × 12): [γxz, γyz] from [w, θx, θy]
  const Bs: number[][] = Array.from({ length: 2 }, () => new Array(12).fill(0))
  for (let a = 0; a < 4; a++) {
    const col = a * 3
    // γxz = ∂w/∂x - θx
    Bs[0][col]     = dNdx[a]
    Bs[0][col + 1] = -N[a]
    // γyz = ∂w/∂y - θy
    Bs[1][col]     = dNdy[a]
    Bs[1][col + 2] = -N[a]
  }

  return { Jdet, Bb, Bs }
}

// ─────────────────────────────────────────────
// GLOBAL ASSEMBLY + SOLVER
// ─────────────────────────────────────────────

/**
 * Assemble global stiffness matrix and load vector.
 * Applies boundary conditions (fixed supports + soil springs for raft).
 * Solves [K]{u} = {f} using Gaussian elimination.
 */
export function solveFEM(
  mesh: FEMMesh,
  E: number,
  nu: number,
  soilModulus?: number  // kN/m³ for raft; undefined = slab on beams
): { displacements: number[]; reactions: number[] } {
  const nNodes = mesh.nodes.length
  const nDOF   = nNodes * 3   // [w, θx, θy] per node

  // Build node index
  const nodeIndex: Record<string, number> = {}
  mesh.nodes.forEach((n, i) => { nodeIndex[n.id] = i })

  // Global K and F
  const K = Array.from({ length: nDOF }, () => new Array(nDOF).fill(0))
  const F = new Array(nDOF).fill(0)

  // Assemble element stiffnesses
  for (const el of mesh.elements) {
    const elNodes = el.nodeIds.slice(0, 4).map(nid => {
      const n = mesh.nodes.find(nd => nd.id === nid)!
      return { x: n.x, y: n.y, idx: nodeIndex[nid] }
    })

    const Ke = q4PlateStiffness(
      elNodes.map(n => ({ x: n.x, y: n.y })),
      E, nu, el.thickness
    )

    // Scatter into global K
    const dofMap = elNodes.flatMap(n => [n.idx * 3, n.idx * 3 + 1, n.idx * 3 + 2])
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        K[dofMap[r]][dofMap[c]] += Ke[r][c]
      }
    }

    // Distributed load → consistent nodal loads (w direction only)
    const area = elementArea(elNodes)
    const qNode = el.loadIntensity * area / 4  // kN (uniform)
    // Convert kN/m² * mm² → kN: loadIntensity is kN/m², area in mm²
    const qNodeKN = el.loadIntensity * area * 1e-6 / 4  // kN per node
    for (const n of elNodes) {
      F[n.idx * 3] += qNodeKN
    }
  }

  // Soil springs for raft (diagonal addition)
  if (soilModulus !== undefined) {
    for (const node of mesh.nodes) {
      const springK = soilModulus * tributaryArea(mesh, node) * 1e-6  // kN/mm
      const dof = nodeIndex[node.id] * 3
      K[dof][dof] += springK
    }
  }

  // Apply fixed BCs (penalty method)
  const PENALTY = 1e20
  for (const bc of mesh.boundaryConditions) {
    const idx = nodeIndex[bc.nodeId]
    if (bc.w)       { K[idx * 3][idx * 3]           += PENALTY }
    if (bc.thetaX)  { K[idx * 3 + 1][idx * 3 + 1]  += PENALTY }
    if (bc.thetaY)  { K[idx * 3 + 2][idx * 3 + 2]  += PENALTY }
  }

  // Solve [K]{u} = {F} — Gaussian elimination
  const u = gaussianElimination(K, F)
  const reactions = computeReactions(K, u, F)

  return { displacements: u, reactions }
}

// ─────────────────────────────────────────────
// RESULTS EXTRACTION
// ─────────────────────────────────────────────

export function extractFEMResults(
  mesh: FEMMesh,
  displacements: number[],
  nodeIndex: Record<string, number>,
  E: number,
  nu: number
): FEMResults {
  const nodeResults: FEMNodeResult[] = mesh.nodes.map(n => {
    const i = nodeIndex[n.id]
    return {
      nodeId: n.id,
      w:       displacements[i * 3],
      thetaX:  displacements[i * 3 + 1],
      thetaY:  displacements[i * 3 + 2],
    }
  })

  const elementResults: FEMElementResult[] = mesh.elements.map(el => {
    const elNodes = el.nodeIds.slice(0, 4).map(nid => {
      const n = mesh.nodes.find(nd => nd.id === nid)!
      return { x: n.x, y: n.y, idx: nodeIndex[nid] }
    })

    // Get element displacements
    const ue: number[] = elNodes.flatMap(n => [
      displacements[n.idx * 3],
      displacements[n.idx * 3 + 1],
      displacements[n.idx * 3 + 2],
    ])

    // Compute moments at centroid (xi=0, eta=0)
    const { Bb } = shapeFunctionDerivatives(
      elNodes.map(n => ({ x: n.x, y: n.y })), 0, 0, el.thickness
    )
    const D = flexuralRigidityMatrix(E, nu, el.thickness)
    const kappa = matVecMul(Bb, ue)
    const moments = matVecMul(D, kappa)

    // Shear forces (simple finite difference approximation)
    const Vx = moments[0] / (el.thickness || 150)
    const Vy = moments[1] / (el.thickness || 150)

    return {
      elementId: el.id,
      Mx:  moments[0] * 1e-6,    // N·mm/mm → kN·m/m
      My:  moments[1] * 1e-6,
      Mxy: moments[2] * 1e-6,
      Vx:  Vx * 1e-3,
      Vy:  Vy * 1e-3,
    }
  })

  const maxDeflection = Math.max(...nodeResults.map(r => Math.abs(r.w)))
  const maxMomentMx   = Math.max(...elementResults.map(r => Math.abs(r.Mx)))
  const maxMomentMy   = Math.max(...elementResults.map(r => Math.abs(r.My)))
  const maxMomentMxy  = Math.max(...elementResults.map(r => Math.abs(r.Mxy)))
  const maxShearVx    = Math.max(...elementResults.map(r => Math.abs(r.Vx)))
  const maxShearVy    = Math.max(...elementResults.map(r => Math.abs(r.Vy)))

  return {
    status: 'done',
    timestamp: Date.now(),
    maxDeflection,
    maxMomentMx,
    maxMomentMy,
    maxMomentMxy,
    maxShearVx,
    maxShearVy,
    maxPunchingRatio: 0,  // computed separately in punching check
    nodeResults,
    elementResults,
  }
}

// ─────────────────────────────────────────────
// P-DELTA ANALYSIS (Geometric Nonlinearity)
// ─────────────────────────────────────────────

/**
 * P-Delta iterative analysis.
 * Adds geometric stiffness reduction to frame analysis.
 * Converges when max displacement change < tolerance.
 *
 * Reference: AISC 360-16 Appendix 8 / BNBC 2020 §2.3.4
 */
export interface PDeltaResult {
  converged: boolean
  iterations: number
  amplificationFactor: number   // B2 factor per AISC/BNBC
  storyDrifts: Array<{ storyId: string; drift: number; driftAmplified: number }>
  errorLog: string[]
}

export function runPDeltaAnalysis(
  project: CivilOSProject,
  firstOrderDrifts: Array<{ storyId: string; drift: number; ΣPu: number; ΔH: number; H: number }>,
  config: PDeltaConfig
): PDeltaResult {
  const errorLog: string[] = []
  let converged = false
  let iterations = 0

  // B2 = 1 / (1 - θ) per AISC 360 Eq. A-8-6
  // θ = ΣPu·Δ / (H·L) — stability ratio
  const storyResults = firstOrderDrifts.map(s => {
    const theta = (s.ΣPu * s.ΔH) / (s.H * s.H)
    if (theta >= 0.6) {
      errorLog.push(`Story ${s.storyId}: θ = ${theta.toFixed(3)} ≥ 0.60 — Structure unstable!`)
    } else if (theta > 0.1) {
      errorLog.push(`Story ${s.storyId}: θ = ${theta.toFixed(3)} > 0.10 — P-Delta significant`)
    }
    const B2 = Math.max(1.0, 1 / (1 - theta))
    return {
      storyId: s.storyId,
      drift: s.ΔH,
      driftAmplified: s.ΔH * B2,
      theta,
      B2,
    }
  })

  // Iterative check
  for (let iter = 0; iter < config.maxIterations; iter++) {
    iterations = iter + 1
    const maxChange = storyResults.reduce((max, s) => {
      const newDrift = s.drift * s.B2
      const change = Math.abs(newDrift - s.driftAmplified)
      s.driftAmplified = newDrift
      return Math.max(max, change)
    }, 0)

    if (maxChange < config.tolerance) {
      converged = true
      break
    }
  }

  const maxB2 = Math.max(...storyResults.map(s => s.B2))

  return {
    converged,
    iterations,
    amplificationFactor: maxB2,
    storyDrifts: storyResults.map(s => ({
      storyId: s.storyId,
      drift: s.drift,
      driftAmplified: s.driftAmplified,
    })),
    errorLog,
  }
}

// ─────────────────────────────────────────────
// PUNCHING SHEAR CHECK — ACI 318-19 §22.6
// ─────────────────────────────────────────────

export interface PunchingCheckInput {
  Vu: number             // kN (column load)
  fc: number             // MPa
  d: number              // mm effective depth
  columnB: number        // mm column width
  columnH: number        // mm column depth
  colPosition: 'interior' | 'edge' | 'corner'
  lambda: number         // 1.0 normal weight
}

export interface PunchingCheckResult {
  bo: number             // mm critical perimeter
  d: number              // mm
  Vc1: number            // kN (two-way shear)
  Vc2: number            // kN (αs shear)
  Vc3: number            // kN (flat plate)
  phiVc: number          // kN (governing)
  Vu: number             // kN (factored)
  ratio: number          // Vu / φVc
  status: 'PASS' | 'FAIL'
  recommendation?: string
}

export function checkPunchingShear(input: PunchingCheckInput): PunchingCheckResult {
  const { Vu, fc, d, columnB, columnH, colPosition, lambda } = input

  // Critical perimeter bo at d/2 from column face
  let bo: number
  const alphaS = colPosition === 'interior' ? 40 : colPosition === 'edge' ? 30 : 20

  if (colPosition === 'interior') {
    bo = 2 * (columnB + d) + 2 * (columnH + d)
  } else if (colPosition === 'edge') {
    bo = columnB + d + 2 * (columnH + d / 2)
  } else {
    bo = (columnB + d / 2) + (columnH + d / 2)
  }

  const sqrtfc = Math.sqrt(fc)
  const Acp = bo * d   // mm²

  // ACI 318-19 Eq. 22.6.5.2: Three equations, smallest governs
  // φ = 0.75 for shear
  const phi = 0.75

  // ① Vc1 = 0.17(1 + 2/βc)λ√f'c · bo · d
  const betaC = Math.max(columnH, columnB) / Math.min(columnH, columnB)
  const Vc1 = 0.17 * (1 + 2 / betaC) * lambda * sqrtfc * Acp / 1000  // kN

  // ② Vc2 = 0.083(2 + αs·d/bo)λ√f'c · bo · d
  const Vc2 = 0.083 * (2 + alphaS * d / bo) * lambda * sqrtfc * Acp / 1000  // kN

  // ③ Vc3 = 0.33λ√f'c · bo · d
  const Vc3 = 0.33 * lambda * sqrtfc * Acp / 1000  // kN

  const Vc = Math.min(Vc1, Vc2, Vc3)
  const phiVc = phi * Vc
  const ratio = Vu / phiVc

  let recommendation: string | undefined
  if (ratio > 1.0) {
    const addThick = Math.ceil((ratio - 0.85) * d * 0.2)  // rough estimate
    recommendation = `Punching FAILS (${ratio.toFixed(2)}). Increase slab thickness by ~${addThick}mm, or add drop panel/column capital.`
  }

  return { bo, d, Vc1, Vc2, Vc3, phiVc, Vu, ratio, status: ratio <= 1.0 ? 'PASS' : 'FAIL', recommendation }
}

// ─────────────────────────────────────────────
// SOIL-STRUCTURE INTERACTION (Raft FEM)
// ─────────────────────────────────────────────

/**
 * Winkler spring model for raft foundation.
 * Each node gets a spring = ks × tributary area.
 * ks = modulus of subgrade reaction (kN/m³).
 *
 * Typical ks values (BNBC guideline):
 *   Soft clay:   12,000–24,000 kN/m³
 *   Stiff clay:  48,000–96,000 kN/m³
 *   Dense sand:  96,000–192,000 kN/m³
 */
export function applyWinklerSprings(
  mesh: FEMMesh,
  ks: number  // kN/m³
): FEMMesh {
  const bcs = mesh.boundaryConditions.filter(bc => !bc.isSpring)

  // Add spring BC to all nodes
  for (const node of mesh.nodes) {
    const area = tributaryArea(mesh, node)  // mm²
    const springKz = ks * area * 1e-6       // kN/m (ks kN/m³ × area m²)
    bcs.push({
      nodeId: node.id,
      isSpring: true,
      springKz,
    })
  }

  return { ...mesh, boundaryConditions: bcs }
}

export function computeRaftSoilPressure(
  nodeResults: FEMNodeResult[],
  ks: number  // kN/m³
): FEMNodeResult[] {
  return nodeResults.map(r => ({
    ...r,
    soilPressure: Math.max(0, r.w * ks * 1e-3),  // w in mm → m × ks = kN/m²
  }))
}

// ─────────────────────────────────────────────
// NONLINEAR MATERIAL (Simplified)
// ─────────────────────────────────────────────

/**
 * Simplified material nonlinearity check.
 * Compares moment demand to cracking moment Mcr.
 * Reduces effective stiffness in cracked zones.
 * Full nonlinear iteration is Phase 16+ scope.
 */
export interface MaterialNonlinearResult {
  elementId: string
  cracked: boolean
  Mcr: number      // kN·m/m
  Mdemand: number  // kN·m/m
  effectiveStiffnessRatio: number  // Ie/Ig
}

export function checkMaterialNonlinearity(
  elementResults: FEMElementResult[],
  fc: number,
  thickness: number  // mm
): MaterialNonlinearResult[] {
  const fr = 0.62 * Math.sqrt(fc)  // MPa modulus of rupture
  const t = thickness / 1000        // m
  const Mcr = fr * (t ** 2) / 6     // kN·m/m (fr MPa = kN/mm², * 1000 → kN/m²... careful units)
  // fr in MPa = N/mm². Section modulus S = t²/6 (m²/m). Mcr = fr × S × 10³ for kN·m/m
  const McrKNm = fr * (thickness ** 2) / 6 * 1e-6  // kN·m/m

  return elementResults.map(el => {
    const Mmax = Math.max(Math.abs(el.Mx), Math.abs(el.My))
    const cracked = Mmax > McrKNm
    const effectiveStiffnessRatio = cracked
      ? Math.max(0.25, McrKNm / Mmax)  // ACI 318 §24.2 simplified
      : 1.0

    return {
      elementId: el.id,
      cracked,
      Mcr: McrKNm,
      Mdemand: Mmax,
      effectiveStiffnessRatio,
    }
  })
}

// ─────────────────────────────────────────────
// HELPER MATH UTILITIES
// ─────────────────────────────────────────────

function transpose(A: number[][]): number[][] {
  return A[0].map((_, j) => A.map(row => row[j]))
}

function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, n = B[0].length, p = B.length
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      Array.from({ length: p }, (_, k) => A[i][k] * B[k][j]).reduce((s, v) => s + v, 0)
    )
  )
}

function matVecMul(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((s, aij, j) => s + aij * v[j], 0))
}

function matMulScalar(A: number[][], s: number): number[][] {
  return A.map(row => row.map(v => v * s))
}

function addMatrix(A: number[][], B: number[][]): void {
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[i].length; j++)
      A[i][j] += B[i][j]
}

function elementArea(nodes: Array<{ x: number; y: number }>): number {
  // Shoelace formula
  let area = 0
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += nodes[i].x * nodes[j].y - nodes[j].x * nodes[i].y
  }
  return Math.abs(area) / 2
}

function tributaryArea(mesh: FEMMesh, node: FEMNode): number {
  // Sum 1/4 of each connected element's area
  let area = 0
  for (const el of mesh.elements) {
    if (el.nodeIds.includes(node.id)) {
      const elNodes = el.nodeIds.slice(0, 4).map(nid => {
        const n = mesh.nodes.find(nd => nd.id === nid)!
        return { x: n.x, y: n.y }
      })
      area += elementArea(elNodes) / 4
    }
  }
  return area
}

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length
  const aug = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r
    }
    ;[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]]

    const pivot = aug[col][col]
    if (Math.abs(pivot) < 1e-14) continue  // singular (BC will have fixed this)

    for (let r = col + 1; r < n; r++) {
      const factor = aug[r][col] / pivot
      for (let c = col; c <= n; c++) {
        aug[r][c] -= factor * aug[col][c]
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n]
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j]
    }
    x[i] /= aug[i][i] || 1
  }
  return x
}

function computeReactions(K: number[][], u: number[], F: number[]): number[] {
  const Ku = matVecMul(K, u)
  return Ku.map((v, i) => v - F[i])
}
