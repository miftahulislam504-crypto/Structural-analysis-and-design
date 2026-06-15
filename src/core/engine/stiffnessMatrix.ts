// ============================================================
// CivilOS Structural — Stiffness Matrix Generator
// Phase 4: Direct Stiffness Method (DSM)
// 3D Frame Element — 12×12 Local + Global Stiffness Matrix
// ============================================================

import { AnalyticalElement, AnalyticalModel } from '../../lib/types'

// ── 3D Frame Element Local Stiffness Matrix (12×12) ──────────
//
// DOF order per node: [ux, uy, uz, rx, ry, rz]
// Node 1 = start (6 DOF): indices 0–5
// Node 2 = end   (6 DOF): indices 6–11
//
// References:
//   McGuire, Gallagher & Ziemian — Matrix Structural Analysis
//   Kassimali — Matrix Analysis of Structures

export function localStiffnessMatrix(
  E: number,  // MPa
  G: number,  // MPa
  A: number,  // mm²
  Ix: number, // mm⁴ (strong axis — bending in local XZ plane)
  Iy: number, // mm⁴ (weak axis — bending in local XY plane)
  J: number,  // mm⁴ (torsion)
  L: number   // mm (element length)
): number[][] {
  const L2 = L * L
  const L3 = L * L * L

  // Stiffness coefficients
  const EA_L   = E * A / L
  const GJ_L   = G * J / L
  const EIy_L  = E * Iy / L
  const EIz_L  = E * Ix / L   // Ix = Iz in our notation (strong axis)

  const c1  = 12 * E * Ix / L3   // 12EIz/L³
  const c2  = 6  * E * Ix / L2   // 6EIz/L²
  const c3  = 4  * E * Ix / L    // 4EIz/L
  const c4  = 2  * E * Ix / L    // 2EIz/L

  const d1  = 12 * E * Iy / L3   // 12EIy/L³
  const d2  = 6  * E * Iy / L2   // 6EIy/L²
  const d3  = 4  * E * Iy / L    // 4EIy/L
  const d4  = 2  * E * Iy / L    // 2EIy/L

  // 12×12 matrix — initialized to zero
  const k: number[][] = Array.from({ length: 12 }, () => new Array(12).fill(0))

  // ── Axial (DOF 0, 6) ─────────────────────────────────────────
  k[0][0]  =  EA_L;  k[0][6]  = -EA_L
  k[6][0]  = -EA_L;  k[6][6]  =  EA_L

  // ── Torsion (DOF 3, 9) ───────────────────────────────────────
  k[3][3]  =  GJ_L;  k[3][9]  = -GJ_L
  k[9][3]  = -GJ_L;  k[9][9]  =  GJ_L

  // ── Bending in XZ plane (strong axis — DOF 1,5,7,11) ────────
  k[1][1]  =  c1;   k[1][5]  =  c2;   k[1][7]  = -c1;   k[1][11] =  c2
  k[5][1]  =  c2;   k[5][5]  =  c3;   k[5][7]  = -c2;   k[5][11] =  c4
  k[7][1]  = -c1;   k[7][5]  = -c2;   k[7][7]  =  c1;   k[7][11] = -c2
  k[11][1] =  c2;   k[11][5] =  c4;   k[11][7] = -c2;   k[11][11]=  c3

  // ── Bending in XY plane (weak axis — DOF 2,4,8,10) ──────────
  k[2][2]  =  d1;   k[2][4]  = -d2;   k[2][8]  = -d1;   k[2][10] = -d2
  k[4][2]  = -d2;   k[4][4]  =  d3;   k[4][8]  =  d2;   k[4][10] =  d4
  k[8][2]  = -d1;   k[8][4]  =  d2;   k[8][8]  =  d1;   k[8][10] =  d2
  k[10][2] = -d2;   k[10][4] =  d4;   k[10][8] =  d2;   k[10][10]=  d3

  return k
}

// ── Transformation Matrix (12×12) ────────────────────────────
//
// [T] maps local DOF → global DOF
// Built from 3×3 direction cosine matrix [λ]
// [T] = block_diag([λ], [λ], [λ], [λ])

export function transformationMatrix(
  localAxisX: [number, number, number],
  localAxisY: [number, number, number],
  localAxisZ: [number, number, number]
): number[][] {
  const [lx, mx, nx] = localAxisX
  const [ly, my, ny] = localAxisY
  const [lz, mz, nz] = localAxisZ

  // 3×3 direction cosine block
  const lambda = [
    [lx, mx, nx],
    [ly, my, ny],
    [lz, mz, nz],
  ]

  // 12×12 transformation matrix
  const T: number[][] = Array.from({ length: 12 }, () => new Array(12).fill(0))
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        T[b * 3 + i][b * 3 + j] = lambda[i][j]
      }
    }
  }
  return T
}

// ── Global Element Stiffness Matrix ──────────────────────────
// [K_global] = [T]ᵀ · [k_local] · [T]

export function globalElementStiffness(
  kLocal: number[][],
  T: number[][]
): number[][] {
  const n = 12
  // Tt = T transpose
  const Tt = transpose(T)
  // K = Tt * k * T
  return matMul(matMul(Tt, kLocal), T)
}

// ── Assemble Global Stiffness Matrix ─────────────────────────
//
// For each element: scatter element DOFs into global K
// Uses connectivity via DOF indices

export function assembleGlobalStiffness(
  model: AnalyticalModel,
  totalDOF: number
): number[][] {
  // Initialize global K (totalDOF × totalDOF)
  const K: number[][] = Array.from({ length: totalDOF }, () =>
    new Array(totalDOF).fill(0)
  )

  // Build DOF map: nodeId → [ux_dof, uy_dof, uz_dof, rx_dof, ry_dof, rz_dof]
  const dofMap = buildDOFMap(model)

  for (const element of model.elements) {
    const L   = elementLength(element, model)
    if (L < 1) continue  // degenerate element

    const sp  = element.sectionProperties
    const mp  = element.materialProperties
    const ax  = element.localAxis ?? {
      x: [1, 0, 0] as [number,number,number],
      y: [0, 1, 0] as [number,number,number],
      z: [0, 0, 1] as [number,number,number],
    }

    // Local stiffness
    const kL  = localStiffnessMatrix(mp.E, mp.G, sp.area, sp.Ix, sp.Iy, sp.J, L)

    // Apply member releases (pin connections)
    const kLr = applyReleases(kL, element.releases)

    // Transformation matrix
    const T   = transformationMatrix(ax.x, ax.y, ax.z)

    // Global element stiffness
    const kG  = globalElementStiffness(kLr, T)

    // Get global DOF indices for start and end nodes
    const startDOFs = dofMap.get(element.startNodeId) ?? []
    const endDOFs   = dofMap.get(element.endNodeId)   ?? []
    const elemDOFs  = [...startDOFs, ...endDOFs]  // 12 DOF indices

    // Scatter into global K
    for (let i = 0; i < 12; i++) {
      const gi = elemDOFs[i]
      if (gi < 0) continue  // restrained DOF
      for (let j = 0; j < 12; j++) {
        const gj = elemDOFs[j]
        if (gj < 0) continue
        if (gi < totalDOF && gj < totalDOF) {
          K[gi][gj] += kG[i][j]
        }
      }
    }
  }

  return K
}

// ── Apply Member End Releases ────────────────────────────────
// Modifies local stiffness to account for pin releases

export function applyReleases(
  k: number[][],
  releases: {
    startMx?: boolean; startMy?: boolean; startMz?: boolean
    endMx?: boolean;   endMy?: boolean;   endMz?: boolean
  }
): number[][] {
  // DOF indices for releases in local stiffness:
  // startMx=3, startMy=4, startMz=5, endMx=9, endMy=10, endMz=11
  const releasedDOFs: number[] = []
  if (releases.startMx) releasedDOFs.push(3)
  if (releases.startMy) releasedDOFs.push(4)
  if (releases.startMz) releasedDOFs.push(5)
  if (releases.endMx)   releasedDOFs.push(9)
  if (releases.endMy)   releasedDOFs.push(10)
  if (releases.endMz)   releasedDOFs.push(11)

  if (releasedDOFs.length === 0) return k

  // Static condensation for released DOFs
  // Partition: free (f) and released (r)
  const n = 12
  const fDOFs = Array.from({ length: n }, (_, i) => i).filter(i => !releasedDOFs.includes(i))

  // Build condensed matrix via static condensation
  // k_ff - k_fr * inv(k_rr) * k_rf
  const kNew: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  // Extract sub-matrices
  const kff = subMatrix(k, fDOFs, fDOFs)
  const kfr = subMatrix(k, fDOFs, releasedDOFs)
  const krf = subMatrix(k, releasedDOFs, fDOFs)
  const krr = subMatrix(k, releasedDOFs, releasedDOFs)

  // Invert krr (small matrix, use direct inversion)
  const krrInv = invertSmall(krr)
  if (!krrInv) return k  // singular — skip condensation

  // Condensed = kff - kfr * krrInv * krf
  const condensed = matSub(kff, matMul(matMul(kfr, krrInv), krf))

  // Place back into full matrix
  for (let i = 0; i < fDOFs.length; i++) {
    for (let j = 0; j < fDOFs.length; j++) {
      kNew[fDOFs[i]][fDOFs[j]] = condensed[i][j]
    }
  }

  return kNew
}

// ── DOF Map Builder ───────────────────────────────────────────

function buildDOFMap(model: AnalyticalModel): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (const node of model.nodes) {
    const d = node.dof
    // DOF index: positive = free DOF (1-indexed → 0-indexed), -1 = restrained
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

// ── Element Length ────────────────────────────────────────────

function elementLength(el: AnalyticalElement, model: AnalyticalModel): number {
  const sn = model.nodes.find(n => n.id === el.startNodeId)
  const en = model.nodes.find(n => n.id === el.endNodeId)
  if (!sn || !en) return 0
  return Math.sqrt(
    (en.x - sn.x) ** 2 +
    (en.y - sn.y) ** 2 +
    (en.z - sn.z) ** 2
  )
}

// ── Matrix Utilities ──────────────────────────────────────────

export function transpose(A: number[][]): number[][] {
  const m = A.length, n = A[0].length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => A[j][i])
  )
}

export function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length, k = B.length, n = B[0].length
  const C = Array.from({ length: m }, () => new Array(n).fill(0))
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++)
      for (let l = 0; l < k; l++)
        C[i][j] += A[i][l] * B[l][j]
  return C
}

export function matSub(A: number[][], B: number[][]): number[][] {
  return A.map((row, i) => row.map((v, j) => v - B[i][j]))
}

function subMatrix(A: number[][], rows: number[], cols: number[]): number[][] {
  return rows.map(r => cols.map(c => A[r][c]))
}

function invertSmall(A: number[][]): number[][] | null {
  const n = A.length
  if (n === 1) {
    if (Math.abs(A[0][0]) < 1e-12) return null
    return [[1 / A[0][0]]]
  }
  if (n === 2) {
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
    if (Math.abs(det) < 1e-12) return null
    return [
      [ A[1][1] / det, -A[0][1] / det],
      [-A[1][0] / det,  A[0][0] / det],
    ]
  }
  // Gaussian elimination with augmented matrix for n>2
  const aug = A.map((row, i) =>
    [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]
  )
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) pivot = row;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]]
    const p = aug[col][col]
    if (Math.abs(p) < 1e-12) return null
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= p
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const factor = aug[row][col]
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j]
    }
  }
  return aug.map(row => row.slice(n))
}
