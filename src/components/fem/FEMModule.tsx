// ============================================================
// CivilOS Structural — FEM Module UI
// Phase 15: Advanced FEM Engine
// Plate/Shell · Raft SSI · P-Delta · Punching · Nonlinear
// ============================================================

import { useState, useCallback } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import {
  SlabFEMConfig,
  RaftFEMConfig,
  PDeltaConfig,
  FEMStatus,
} from '../../core/fem/femEngine'
import {
  runSlabFEM,
  runRaftFEM,
  runPDelta,
  SlabFEMRunResult,
  RaftFEMRunResult,
} from '../../core/fem/femRunner'
import type { PDeltaResult } from '../../core/fem/femEngine'

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type FEMTab = 'slab' | 'raft' | 'pdelta' | 'results'

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function FEMModule() {
  const { project } = useProjectStore()
  const [activeTab, setActiveTab] = useState<FEMTab>('slab')
  const [femStatus, setFemStatus] = useState<FEMStatus>('idle')

  // Slab FEM state
  const [slabConfig, setSlabConfig] = useState<SlabFEMConfig>({
    slabId: '',
    meshSize: 250,
    loadCaseId: '1.2D+1.6L',
    checkPunching: true,
    columnIds: [],
  })
  const [slabResult, setSlabResult] = useState<SlabFEMRunResult | null>(null)

  // Raft FEM state
  const [raftConfig, setRaftConfig] = useState<RaftFEMConfig>({
    foundationId: '',
    meshSize: 500,
    soilModulus: 48000,
    loadCaseId: '1.2D+1.6L',
  })
  const [raftResult, setRaftResult] = useState<RaftFEMRunResult | null>(null)

  // P-Delta state
  const [pdeltaConfig, setPdeltaConfig] = useState<PDeltaConfig>({
    maxIterations: 10,
    tolerance: 0.1,
    loadCaseId: '1.2D+1.0E',
  })
  const [pdeltaResult, setPdeltaResult] = useState<PDeltaResult | null>(null)

  const [error, setError] = useState<string | null>(null)

  if (!project) return <EmptyState />

  // ── Runners ──────────────────────────────────

  function runSlab() {
    if (!project) return
    if (!slabConfig.slabId) { setError('Please select a Slab'); return }
    setFemStatus('meshing')
    setError(null)
    try {
      const result = runSlabFEM(project, slabConfig)
      setSlabResult(result)
      setFemStatus('done')
      setActiveTab('results')
    } catch (e: any) {
      setError(e.message)
      setFemStatus('error')
    }
  }

  function runRaft() {
    if (!project) return
    if (!raftConfig.foundationId) { setError('Please select a Foundation'); return }
    setFemStatus('solving')
    setError(null)
    try {
      const result = runRaftFEM(project, raftConfig)
      setRaftResult(result)
      setFemStatus('done')
      setActiveTab('results')
    } catch (e: any) {
      setError(e.message)
      setFemStatus('error')
    }
  }

  function runPDeltaAnalysis() {
    if (!project) return
    setFemStatus('solving')
    setError(null)
    try {
      const result = runPDelta(project, pdeltaConfig)
      setPdeltaResult(result)
      setFemStatus('done')
      setActiveTab('results')
    } catch (e: any) {
      setError(e.message)
      setFemStatus('error')
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#ffffff] overflow-hidden">
      {/* Header */}
      <div className="border-b border-[#e5e7eb] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-gray-800 font-mono font-bold text-lg flex items-center gap-2">
            <span className="text-purple-600">🔬</span> Advanced FEM Engine
            <span className="text-xs font-normal text-gray-500 ml-2">Phase 15</span>
          </h1>
          <p className="text-gray-500 font-mono text-xs mt-0.5">
            Plate/Shell FEM · Raft SSI · P-Delta Analysis · Punching · Nonlinear
          </p>
        </div>
        <StatusBadge status={femStatus} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e5e7eb]">
        {([
          { id: 'slab',    label: 'Slab FEM',    icon: '▦' },
          { id: 'raft',    label: 'Raft FEM',    icon: '⬛' },
          { id: 'pdelta',  label: 'P-Delta',     icon: '△' },
          { id: 'results', label: 'Results',      icon: '📊' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-3 font-mono text-xs border-b-2 transition-all flex items-center gap-2 ${
              activeTab === t.id
                ? 'border-purple-500 text-purple-600 bg-purple-500/5'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span> {t.label}
            {t.id === 'results' && (slabResult || raftResult || pdeltaResult) && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 ml-1" />
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 font-mono text-xs">
          ⚠ {error}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'slab'   && <SlabFEMPanel config={slabConfig} setConfig={setSlabConfig} project={project} onRun={runSlab} status={femStatus} />}
        {activeTab === 'raft'   && <RaftFEMPanel config={raftConfig} setConfig={setRaftConfig} project={project} onRun={runRaft} status={femStatus} />}
        {activeTab === 'pdelta' && <PDeltaPanel  config={pdeltaConfig} setConfig={setPdeltaConfig} onRun={runPDeltaAnalysis} status={femStatus} />}
        {activeTab === 'results' && (
          <ResultsPanel slabResult={slabResult} raftResult={raftResult} pdeltaResult={pdeltaResult} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SLAB FEM PANEL
// ─────────────────────────────────────────────

function SlabFEMPanel({ config, setConfig, project, onRun, status }: {
  config: SlabFEMConfig
  setConfig: (c: SlabFEMConfig) => void
  project: any
  onRun: () => void
  status: FEMStatus
}) {
  const slabs     = project.members.slabs     ?? []
  const columns   = project.members.columns   ?? []
  const isRunning = status === 'meshing' || status === 'solving'

  return (
    <div className="max-w-2xl space-y-6">
      <InfoBox
        title="Slab FEM Analysis"
        desc="Slab deflection, moment, shear, and punching check using Q4 Mindlin-Reissner plate elements."
        color="purple"
      />

      {/* Slab Select */}
      <ConfigSection title="Select Slab">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Slab</Label>
            <Select
              value={config.slabId}
              onChange={v => setConfig({ ...config, slabId: v })}
              options={slabs.map((s: any) => ({ value: s.id, label: s.label }))}
              placeholder="-- Select Slab --"
            />
          </div>
          <div>
            <Label>Load Case</Label>
            <Select
              value={config.loadCaseId}
              onChange={v => setConfig({ ...config, loadCaseId: v })}
              options={[
                { value: '1.2D+1.6L', label: '1.2D + 1.6L (Gravity)' },
                { value: '1.2D+1.0E', label: '1.2D + 1.0E (Seismic)' },
                { value: '1.2D+1.0W', label: '1.2D + 1.0W (Wind)' },
              ]}
            />
          </div>
        </div>
      </ConfigSection>

      {/* Mesh Config */}
      <ConfigSection title="Mesh Settings">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Mesh Size (mm)</Label>
            <NumberInput
              value={config.meshSize}
              onChange={v => setConfig({ ...config, meshSize: v })}
              min={100} max={1000} step={50}
            />
            <p className="text-gray-500 font-mono text-xs mt-1">Smaller = more accurate (slower)</p>
          </div>
          <div>
            <Label>Punching Check</Label>
            <div className="flex items-center gap-3 mt-2">
              <Toggle
                checked={config.checkPunching}
                onChange={v => setConfig({ ...config, checkPunching: v })}
              />
              <span className="text-gray-600 font-mono text-xs">ACI 318-19 §22.6</span>
            </div>
          </div>
        </div>
      </ConfigSection>

      {/* Column Selection for Punching */}
      {config.checkPunching && (
        <ConfigSection title="Punching Check — Select Columns">
          <p className="text-gray-500 font-mono text-xs mb-3">Select the columns near which to perform punching check:</p>
          <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {columns.map((col: any) => (
              <button
                key={col.id}
                onClick={() => {
                  const ids = config.columnIds.includes(col.id)
                    ? config.columnIds.filter(id => id !== col.id)
                    : [...config.columnIds, col.id]
                  setConfig({ ...config, columnIds: ids })
                }}
                className={`px-2 py-1.5 rounded font-mono text-xs border transition-all text-left ${
                  config.columnIds.includes(col.id)
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-600'
                    : 'border-[#e5e7eb] text-gray-500 hover:text-gray-700'
                }`}
              >
                {col.label}
              </button>
            ))}
          </div>
          {columns.length === 0 && (
            <p className="text-gray-500 font-mono text-xs">No columns found — add columns in the Modeling module.</p>
          )}
        </ConfigSection>
      )}

      <RunButton onRun={onRun} isRunning={isRunning} label="Run Slab FEM" color="purple" />
    </div>
  )
}

// ─────────────────────────────────────────────
// RAFT FEM PANEL
// ─────────────────────────────────────────────

function RaftFEMPanel({ config, setConfig, project, onRun, status }: {
  config: RaftFEMConfig
  setConfig: (c: RaftFEMConfig) => void
  project: any
  onRun: () => void
  status: FEMStatus
}) {
  const foundations = project.members.foundations?.filter((f: any) => f.type === 'raft') ?? []
  const isRunning   = status === 'meshing' || status === 'solving'

  const ksSuggestions = [
    { label: 'Soft Clay (12,000)', value: 12000 },
    { label: 'Medium Clay (48,000)', value: 48000 },
    { label: 'Stiff Clay (96,000)', value: 96000 },
    { label: 'Dense Sand (192,000)', value: 192000 },
    { label: 'Bangladesh Soft (16,000)', value: 16000 },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <InfoBox
        title="Raft Foundation FEM"
        desc="Soil-structure interaction using the Winkler spring model. Raft deflection, moment, and soil pressure."
        color="blue"
      />

      <ConfigSection title="Select Foundation">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Raft Foundation</Label>
            <Select
              value={config.foundationId}
              onChange={v => setConfig({ ...config, foundationId: v })}
              options={foundations.map((f: any) => ({ value: f.id, label: f.label }))}
              placeholder="-- Select Raft --"
            />
            {foundations.length === 0 && (
              <p className="text-yellow-500/70 font-mono text-xs mt-1">
                ⚠ Add a Raft foundation in Project Setup
              </p>
            )}
          </div>
          <div>
            <Label>Mesh Size (mm)</Label>
            <NumberInput value={config.meshSize} onChange={v => setConfig({ ...config, meshSize: v })} min={200} max={2000} step={100} />
          </div>
        </div>
      </ConfigSection>

      <ConfigSection title="Soil Parameters">
        <Label>Modulus of Subgrade Reaction ks (kN/m³)</Label>
        <div className="grid grid-cols-5 gap-2 mt-2 mb-3">
          {ksSuggestions.map(s => (
            <button
              key={s.value}
              onClick={() => setConfig({ ...config, soilModulus: s.value })}
              className={`px-2 py-1.5 rounded font-mono text-xs border transition-all text-center ${
                config.soilModulus === s.value
                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-600'
                  : 'border-[#e5e7eb] text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <NumberInput
          value={config.soilModulus}
          onChange={v => setConfig({ ...config, soilModulus: v })}
          min={5000} max={500000} step={1000}
        />
        <p className="text-gray-500 font-mono text-xs mt-1">
          Bangladesh soft soil: 12,000–24,000 kN/m³ is commonly used
        </p>
      </ConfigSection>

      <div className="p-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
        <p className="text-gray-600 font-mono text-xs font-semibold mb-2">Settlement Limits (BNBC)</p>
        <div className="grid grid-cols-3 gap-4 text-xs font-mono">
          <div><span className="text-gray-500">Max Total:</span> <span className="text-gray-700">25 mm</span></div>
          <div><span className="text-gray-500">Differential:</span> <span className="text-gray-700">20 mm</span></div>
          <div><span className="text-gray-500">Angular:</span> <span className="text-gray-700">1/500</span></div>
        </div>
      </div>

      <RunButton onRun={onRun} isRunning={isRunning} label="Run Raft FEM" color="blue" />
    </div>
  )
}

// ─────────────────────────────────────────────
// P-DELTA PANEL
// ─────────────────────────────────────────────

function PDeltaPanel({ config, setConfig, onRun, status }: {
  config: PDeltaConfig
  setConfig: (c: PDeltaConfig) => void
  onRun: () => void
  status: FEMStatus
}) {
  const isRunning = status === 'solving'

  return (
    <div className="max-w-2xl space-y-6">
      <InfoBox
        title="P-Delta Analysis (Geometric Nonlinearity)"
        desc="Second-order effect of axial load on story drift. BNBC §2.3.4 / AISC 360 Appendix 8 — B₂ amplification factor."
        color="orange"
      />

      <div className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/5">
        <p className="text-orange-600 font-mono text-xs font-semibold mb-2">📋 Prerequisites</p>
        <ul className="space-y-1 text-gray-500 font-mono text-xs">
          <li>✓ Phase 4 — DSM Analysis must be completed</li>
          <li>✓ Phase 5 — Seismic/Wind loads must be completed</li>
          <li className="text-gray-600">→ B₂ = 1 / (1 − θ) where θ = ΣPu·Δ / (H·L)</li>
        </ul>
      </div>

      <ConfigSection title="Analysis Settings">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Load Case</Label>
            <Select
              value={config.loadCaseId}
              onChange={v => setConfig({ ...config, loadCaseId: v })}
              options={[
                { value: '1.2D+1.0E', label: '1.2D + 1.0E (Seismic)' },
                { value: '1.2D+1.0W', label: '1.2D + 1.0W (Wind)' },
                { value: '0.9D+1.0E', label: '0.9D + 1.0E' },
              ]}
            />
          </div>
          <div>
            <Label>Max Iterations</Label>
            <NumberInput value={config.maxIterations} onChange={v => setConfig({ ...config, maxIterations: v })} min={3} max={50} step={1} />
          </div>
          <div>
            <Label>Convergence Tolerance (mm)</Label>
            <NumberInput value={config.tolerance} onChange={v => setConfig({ ...config, tolerance: v })} min={0.01} max={1} step={0.01} />
          </div>
        </div>
      </ConfigSection>

      <div className="p-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
        <p className="text-gray-600 font-mono text-xs font-semibold mb-2">Stability Ratio θ Reference</p>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex justify-between"><span className="text-gray-500">θ ≤ 0.10</span><span className="text-emerald-600">P-Delta negligible — skip</span></div>
          <div className="flex justify-between"><span className="text-gray-500">0.10 &lt; θ ≤ 0.60</span><span className="text-amber-600">P-Delta significant — use B₂</span></div>
          <div className="flex justify-between"><span className="text-gray-500">θ &gt; 0.60</span><span className="text-red-600">Structure unstable!</span></div>
        </div>
      </div>

      <RunButton onRun={onRun} isRunning={isRunning} label="Run P-Delta Analysis" color="orange" />
    </div>
  )
}

// ─────────────────────────────────────────────
// RESULTS PANEL
// ─────────────────────────────────────────────

function ResultsPanel({ slabResult, raftResult, pdeltaResult }: {
  slabResult: SlabFEMRunResult | null
  raftResult: RaftFEMRunResult | null
  pdeltaResult: PDeltaResult | null
}) {
  if (!slabResult && !raftResult && !pdeltaResult) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-gray-500 font-mono text-sm">No analysis has been run yet.</p>
        <p className="text-gray-500 font-mono text-xs mt-1">Run Slab FEM, Raft FEM, or P-Delta.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Slab Results */}
      {slabResult && (
        <section>
          <h2 className="text-gray-700 font-mono font-bold text-sm mb-4 flex items-center gap-2">
            <span className="text-purple-600">▦</span> Slab FEM Results
          </h2>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard label="Max Deflection" value={`${slabResult.femResults.maxDeflection.toFixed(2)} mm`} sub={`Limit: ${slabResult.deflectionLimit.toFixed(1)} mm`} status={slabResult.deflectionStatus} />
            <MetricCard label="Max Mx" value={`${slabResult.femResults.maxMomentMx.toFixed(2)} kN·m/m`} status="info" />
            <MetricCard label="Max My" value={`${slabResult.femResults.maxMomentMy.toFixed(2)} kN·m/m`} status="info" />
            <MetricCard label="Max Punching" value={`${(slabResult.femResults.maxPunchingRatio * 100).toFixed(0)}%`} sub="Vu/φVc" status={slabResult.femResults.maxPunchingRatio <= 1 ? 'PASS' : 'FAIL'} />
          </div>

          {/* Punching Details */}
          {slabResult.punchingChecks.length > 0 && (
            <div className="mb-6">
              <p className="text-gray-500 font-mono text-xs font-semibold mb-2">Punching Shear — ACI 318-19 §22.6</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#e5e7eb]">
                      {['Col #', 'bo (mm)', 'd (mm)', 'Vu (kN)', 'φVc (kN)', 'Ratio', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {slabResult.punchingChecks.map((p, i) => (
                      <tr key={i} className="border-b border-[#e5e7eb]/50">
                        <td className="px-3 py-2 text-gray-600">C{i + 1}</td>
                        <td className="px-3 py-2 text-gray-600">{p.bo.toFixed(0)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.d.toFixed(0)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.Vu.toFixed(1)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.phiVc.toFixed(1)}</td>
                        <td className="px-3 py-2 text-gray-600">{p.ratio.toFixed(3)}</td>
                        <td className="px-3 py-2">
                          <StatusBadgeSmall status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {slabResult.punchingChecks.filter(p => p.recommendation).map((p, i) => (
                <div key={i} className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-mono">
                  💡 {p.recommendation}
                </div>
              ))}
            </div>
          )}

          {/* Cracking */}
          <div>
            <p className="text-gray-500 font-mono text-xs font-semibold mb-2">Material Nonlinearity — Cracking Check</p>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Total Elements" value={slabResult.nonlinearCheck.length.toString()} />
              <StatBox label="Cracked" value={slabResult.nonlinearCheck.filter(r => r.cracked).length.toString()} color="yellow" />
              <StatBox
                label="Min Ie/Ig"
                value={Math.min(...slabResult.nonlinearCheck.map(r => r.effectiveStiffnessRatio)).toFixed(2)}
                color="orange"
              />
            </div>
          </div>
        </section>
      )}

      {/* Raft Results */}
      {raftResult && (
        <section>
          <h2 className="text-gray-700 font-mono font-bold text-sm mb-4 flex items-center gap-2">
            <span className="text-blue-600">⬛</span> Raft FEM Results
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MetricCard label="Max Soil Pressure" value={`${raftResult.maxSoilPressure.toFixed(1)} kN/m²`} sub={`Allowable: ${raftResult.allowablePressure} kN/m²`} status={raftResult.bearingStatus} />
            <MetricCard label="Differential Settlement" value={`${raftResult.differentialSettlement.toFixed(1)} mm`} sub="Limit: 25 mm" status={raftResult.settlingStatus} />
            <MetricCard label="Max Deflection" value={`${raftResult.femResults.maxDeflection.toFixed(1)} mm`} status="info" />
            <MetricCard label="Max Mx" value={`${raftResult.femResults.maxMomentMx.toFixed(1)} kN·m/m`} status="info" />
          </div>
          <div className="p-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
            <p className="text-gray-500 font-mono text-xs">
              Raft maximum settlement: {raftResult.femResults.maxDeflection.toFixed(1)} mm |
              Max Mxy: {raftResult.femResults.maxMomentMxy.toFixed(2)} kN·m/m
            </p>
          </div>
        </section>
      )}

      {/* P-Delta Results */}
      {pdeltaResult && (
        <section>
          <h2 className="text-gray-700 font-mono font-bold text-sm mb-4 flex items-center gap-2">
            <span className="text-orange-600">△</span> P-Delta Results
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MetricCard label="B₂ Amplification" value={pdeltaResult.amplificationFactor.toFixed(3)} sub="max across stories" status={pdeltaResult.amplificationFactor < 1.5 ? 'PASS' : 'FAIL'} />
            <MetricCard label="Convergence" value={pdeltaResult.converged ? 'Yes' : 'No'} sub={`${pdeltaResult.iterations} iterations`} status={pdeltaResult.converged ? 'PASS' : 'FAIL'} />
            <MetricCard label="Stories Analyzed" value={pdeltaResult.storyDrifts.length.toString()} status="info" />
          </div>

          {pdeltaResult.storyDrifts.length > 0 && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    {['Story', 'Δ₁st Order (mm)', 'Δ P-Delta (mm)', 'Amplification'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pdeltaResult.storyDrifts.map(s => (
                    <tr key={s.storyId} className="border-b border-[#e5e7eb]/50">
                      <td className="px-3 py-2 text-gray-600">{s.storyId}</td>
                      <td className="px-3 py-2 text-gray-600">{s.drift.toFixed(3)}</td>
                      <td className="px-3 py-2 text-gray-600">{s.driftAmplified.toFixed(3)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          s.driftAmplified / (s.drift || 1) > 1.2
                            ? 'bg-red-500/20 text-red-600'
                            : 'bg-green-500/20 text-emerald-600'
                        }`}>
                          ×{(s.driftAmplified / (s.drift || 1)).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pdeltaResult.errorLog.length > 0 && (
            <div className="space-y-1">
              {pdeltaResult.errorLog.map((msg, i) => (
                <div key={i} className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-amber-600 text-xs font-mono">
                  ⚠ {msg}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function InfoBox({ title, desc, color }: { title: string; desc: string; color: string }) {
  const colors: Record<string, string> = {
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-600',
    blue:   'border-blue-500/20 bg-blue-500/5 text-blue-600',
    orange: 'border-orange-500/20 bg-orange-500/5 text-orange-600',
  }
  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <p className="font-mono font-semibold text-sm mb-1">{title}</p>
      <p className="text-gray-600 font-mono text-xs">{desc}</p>
    </div>
  )
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-600 font-mono text-xs font-semibold mb-3 uppercase tracking-wider">{title}</p>
      <div className="p-4 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] space-y-4">
        {children}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-500 font-mono text-xs mb-1.5">{children}</p>
}

function Select({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-3 py-2 text-gray-700 font-mono text-xs focus:outline-none focus:border-purple-500/50"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function NumberInput({ value, onChange, min, max, step }: {
  value: number; onChange: (v: number) => void
  min: number; max: number; step: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-3 py-2 text-gray-700 font-mono text-xs focus:outline-none focus:border-purple-500/50"
    />
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full transition-all relative ${checked ? 'bg-purple-500' : 'bg-[#e5e7eb]'}`}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  )
}

function RunButton({ onRun, isRunning, label, color }: {
  onRun: () => void; isRunning: boolean; label: string; color: string
}) {
  const colors: Record<string, string> = {
    purple: 'bg-purple-500/20 border-purple-500/30 text-purple-600 hover:bg-purple-500/30',
    blue:   'bg-blue-500/20 border-blue-500/30 text-blue-600 hover:bg-blue-500/30',
    orange: 'bg-orange-500/20 border-orange-500/30 text-orange-600 hover:bg-orange-500/30',
  }
  return (
    <button
      onClick={onRun}
      disabled={isRunning}
      className={`w-full py-3 rounded-xl border font-mono text-sm font-semibold transition-all disabled:opacity-50 ${colors[color]}`}
    >
      {isRunning ? (
        <span className="flex items-center justify-center gap-2">
          <span className="animate-spin">⟳</span> Analysis running...
        </span>
      ) : (
        `▶ ${label}`
      )}
    </button>
  )
}

function StatusBadge({ status }: { status: FEMStatus }) {
  const map: Record<FEMStatus, { label: string; color: string }> = {
    idle:    { label: 'Ready',    color: 'text-gray-500 border-gray-300' },
    meshing: { label: 'Meshing…', color: 'text-amber-600 border-yellow-500/30 bg-yellow-500/10' },
    solving: { label: 'Solving…', color: 'text-blue-600 border-blue-500/30 bg-blue-500/10' },
    done:    { label: 'Done ✓',   color: 'text-emerald-600 border-green-500/30 bg-green-500/10' },
    error:   { label: 'Error',    color: 'text-red-600 border-red-500/30 bg-red-500/10' },
  }
  const s = map[status]
  return (
    <span className={`px-3 py-1 rounded-full font-mono text-xs border ${s.color}`}>{s.label}</span>
  )
}

function StatusBadgeSmall({ status }: { status: 'PASS' | 'FAIL' }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
      status === 'PASS' ? 'bg-green-500/20 text-emerald-600' : 'bg-red-500/20 text-red-600'
    }`}>{status}</span>
  )
}

function MetricCard({ label, value, sub, status }: {
  label: string; value: string; sub?: string
  status: 'PASS' | 'FAIL' | 'info'
}) {
  const border = status === 'PASS' ? 'border-green-500/20' : status === 'FAIL' ? 'border-red-500/20' : 'border-[#e5e7eb]'
  const valColor = status === 'PASS' ? 'text-emerald-600' : status === 'FAIL' ? 'text-red-600' : 'text-gray-800'
  return (
    <div className={`p-3 rounded-lg border ${border} bg-[#f9fafb]`}>
      <p className="text-gray-500 font-mono text-xs mb-1">{label}</p>
      <p className={`font-mono text-sm font-bold ${valColor}`}>{value}</p>
      {sub && <p className="text-gray-500 font-mono text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function StatBox({ label, value, color = 'slate' }: { label: string; value: string; color?: string }) {
  const c = color === 'yellow' ? 'text-amber-600' : color === 'orange' ? 'text-orange-600' : 'text-gray-700'
  return (
    <div className="p-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
      <p className="text-gray-500 font-mono text-xs mb-1">{label}</p>
      <p className={`font-mono text-base font-bold ${c}`}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="text-5xl mb-4">🔬</div>
      <p className="text-gray-500 font-mono text-sm">No project loaded</p>
    </div>
  )
}
