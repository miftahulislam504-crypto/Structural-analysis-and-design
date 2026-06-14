// ============================================================
// CivilOS Structural — Analysis Runner
// Phase 4: Orchestrates DSM analysis for all load cases
// ============================================================

import { CivilOSProject, AnalysisResults } from '../../lib/types'
import { convertToAnalyticalModel } from '../analysis/modelConverter'
import { assembleGlobalStiffness } from './stiffnessMatrix'
import {
  assembleLoadVector,
  gaussianElimination,
  extractDisplacements,
  extractReactions,
  extractMemberForces,
  calculateStoryDrifts,
} from './dsmSolver'

export interface RunnerProgress {
  step: string
  percent: number
}

export type ProgressCallback = (p: RunnerProgress) => void

// ── Count free DOFs ───────────────────────────────────────────

function countFreeDOFs(model: ReturnType<typeof convertToAnalyticalModel>): number {
  let max = 0
  for (const node of model.nodes) {
    const vals = Object.values(node.dof)
    for (const v of vals) {
      if (v > max) max = v
    }
  }
  return max
}

// ── Main Runner ───────────────────────────────────────────────

export async function runAnalysis(
  project: CivilOSProject,
  onProgress?: ProgressCallback
): Promise<AnalysisResults> {
  const progress = (step: string, percent: number) => {
    onProgress?.({ step, percent })
  }

  try {
    // ── Step 1: Generate analytical model ───────────────────
    progress('Analytical Model তৈরি হচ্ছে...', 5)
    await tick()
    const model = convertToAnalyticalModel(project)

    if (model.elements.length === 0) {
      return failResult('কোনো element নেই — মডেলিং চেক করুন')
    }
    if (model.restraints.length === 0) {
      return failResult('কোনো support নেই — ভবন unstable')
    }

    // ── Step 2: Count DOFs ───────────────────────────────────
    progress('DOF গণনা করা হচ্ছে...', 10)
    await tick()
    const totalDOF = countFreeDOFs(model)

    if (totalDOF < 3) {
      return failResult(`পর্যাপ্ত free DOF নেই (${totalDOF})`)
    }

    // ── Step 3: Assemble global stiffness matrix ─────────────
    progress(`Global Stiffness Matrix তৈরি হচ্ছে... (${totalDOF}×${totalDOF})`, 20)
    await tick()
    const K = assembleGlobalStiffness(model, totalDOF)

    // ── Step 4: Solve for each load combination ──────────────
    const defaultCombos = project.loads.loadCombinations.filter(lc => lc.isDefault)
    const combosToRun   = defaultCombos.length > 0
      ? defaultCombos
      : project.loads.loadCombinations.slice(0, 3)

    const allDisplacements: AnalysisResults['nodeDisplacements']  = []
    const allReactions:     AnalysisResults['supportReactions']   = []
    const allForces:        AnalysisResults['memberForces']        = []
    const allDrifts:        NonNullable<AnalysisResults['storyDrifts']> = []

    const errorLog: string[] = []

    for (let i = 0; i < combosToRun.length; i++) {
      const combo   = combosToRun[i]
      const pct     = 20 + Math.round((i / combosToRun.length) * 60)
      progress(`Load Case "${combo.label}" সমাধান হচ্ছে...`, pct)
      await tick()

      // Assemble load vector
      const F = assembleLoadVector(model, project, combo.id, totalDOF)

      // Solve K·U = F
      const U = gaussianElimination(K, F)
      if (!U) {
        errorLog.push(`"${combo.label}": Singular matrix — সমাধান হয়নি`)
        continue
      }

      // Check for NaN/Inf
      if (U.some(v => !isFinite(v))) {
        errorLog.push(`"${combo.label}": Numerical instability`)
        continue
      }

      // Extract results
      const displacements = extractDisplacements(model, U, combo.id)
      const reactions     = extractReactions(model, U, K, F, combo.id)
      const forces        = extractMemberForces(model, U, combo.id, project)
      const drifts        = calculateStoryDrifts(model, U, project, combo.id)

      allDisplacements.push(...displacements)
      allReactions.push(...reactions)
      allForces.push(...forces)
      allDrifts.push(...drifts)
    }

    // ── Step 5: Finalize ─────────────────────────────────────
    progress('ফলাফল প্রসেস হচ্ছে...', 85)
    await tick()

    const hasErrors = errorLog.length === combosToRun.length

    progress('সম্পন্ন!', 100)

    return {
      status: hasErrors ? 'failed' : 'complete',
      timestamp: Date.now(),
      nodeDisplacements: allDisplacements,
      supportReactions:  allReactions,
      memberForces:      allForces,
      storyDrifts:       allDrifts,
      errorLog:          errorLog.length > 0 ? errorLog : undefined,
    }
  } catch (err: any) {
    return failResult(`Unexpected error: ${err?.message ?? String(err)}`)
  }
}

function failResult(msg: string): AnalysisResults {
  return {
    status:           'failed',
    timestamp:        Date.now(),
    nodeDisplacements: [],
    supportReactions:  [],
    memberForces:      [],
    errorLog:          [msg],
  }
}

// Yield to event loop so UI can update
function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// ── Quick summary stats ───────────────────────────────────────

export function getResultsSummary(results: AnalysisResults, project: CivilOSProject) {
  if (results.status !== 'complete') return null

  // Max displacement across all nodes + load cases
  const maxUz = results.nodeDisplacements.reduce(
    (max, d) => Math.max(max, Math.abs(d.uz)), 0
  )
  const maxUx = results.nodeDisplacements.reduce(
    (max, d) => Math.max(max, Math.abs(d.ux)), 0
  )

  // Max reactions
  const maxFz = results.supportReactions.reduce(
    (max, r) => Math.max(max, Math.abs(r.Fz)), 0
  )

  // Max moments
  const maxMz = results.memberForces.reduce((max, mf) =>
    Math.max(max, ...mf.stations.map(s => Math.abs(s.Mz))), 0
  )
  const maxVy = results.memberForces.reduce((max, mf) =>
    Math.max(max, ...mf.stations.map(s => Math.abs(s.Vy))), 0
  )

  // Story drifts
  const maxDrift = results.storyDrifts?.reduce(
    (max, d) => Math.max(max, d.driftX, d.driftY), 0
  ) ?? 0
  const driftPass = results.storyDrifts?.every(d => d.passed) ?? true

  return { maxUz, maxUx, maxFz, maxMz, maxVy, maxDrift, driftPass }
}
