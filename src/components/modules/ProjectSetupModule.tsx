import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { GridData, MaterialData, Story, GridLine } from '../../lib/types'
import { generateId, calcEc, getBNBCZoneFactor, getBNBCCa, getBNBCCv, defaultLoadCombinations } from '../../lib/utils'

type Tab = 'meta' | 'grid' | 'material' | 'load'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'meta',     label: 'Project Info', icon: '📋' },
  { id: 'grid',     label: 'Grid & Stories',   icon: '⊞' },
  { id: 'material', label: 'Materials',         icon: '🧱' },
  { id: 'load',     label: 'Loads',           icon: '↓' },
]

export default function ProjectSetupModule() {
  const [activeTab, setActiveTab] = useState<Tab>('meta')
  const { project, updateMeta, updateGrid, updateMaterials, updateLoads } = useProjectStore()

  if (!project) return null

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[#e5e7eb] bg-[#ffffff] px-6 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-mono border-b-2 transition-all ${
              activeTab === t.id
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'meta'     && <MetaTab />}
        {activeTab === 'grid'     && <GridTab />}
        {activeTab === 'material' && <MaterialTab />}
        {activeTab === 'load'     && <LoadTab />}
      </div>
    </div>
  )
}

// ── Meta Tab ──────────────────────────────────────────────────

function MetaTab() {
  const { project, updateMeta } = useProjectStore()
  if (!project) return null
  const { meta } = project

  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle title="Project Basic Info" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Project Name *" value={meta.name}
          onChange={(v) => updateMeta({ name: v, nameLocal: v })} />
        <InputField label="Project Number" value={meta.projectNo}
          onChange={(v) => updateMeta({ projectNo: v })} />
        <InputField label="Client Name" value={meta.client}
          onChange={(v) => updateMeta({ client: v })} />
        <InputField label="Engineer" value={meta.engineer}
          onChange={(v) => updateMeta({ engineer: v })} />
        <InputField label="Checked By" value={meta.checkedBy ?? ''}
          onChange={(v) => updateMeta({ checkedBy: v })} />
        <InputField label="Approved By" value={meta.approvedBy ?? ''}
          onChange={(v) => updateMeta({ approvedBy: v })} />
        <div className="sm:col-span-2">
          <InputField label="Address" value={meta.address}
            onChange={(v) => updateMeta({ address: v })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SelectField
          label="Structural System"
          value={meta.structuralSystem}
          onChange={(v) => updateMeta({ structuralSystem: v as any })}
          options={[
            { value: 'rcc_frame',    label: 'RCC Frame' },
            { value: 'dual_system',  label: 'Dual System' },
            { value: 'shear_wall',   label: 'Shear Wall' },
            { value: 'steel_frame',  label: 'Steel Frame' },
            { value: 'load_bearing', label: 'Load Bearing' },
          ]}
        />
        <SelectField
          label="Building Use"
          value={meta.buildingUse}
          onChange={(v) => updateMeta({ buildingUse: v as any })}
          options={[
            { value: 'residential',   label: 'Residential' },
            { value: 'commercial',    label: 'Commercial' },
            { value: 'industrial',    label: 'Industrial' },
            { value: 'institutional', label: 'Institutional' },
            { value: 'mixed',         label: 'Mixed' },
          ]}
        />
        <SelectField
          label="Importance Category (BNBC)"
          value={meta.importanceCategory}
          onChange={(v) => updateMeta({ importanceCategory: v as any })}
          options={[
            { value: 'I',   label: 'Category I — Low Importance' },
            { value: 'II',  label: 'Category II — Standard' },
            { value: 'III', label: 'Category III — High Importance' },
            { value: 'IV',  label: 'Category IV — Essential' },
          ]}
        />
      </div>

      <SelectField
        label="Project Status"
        value={meta.status}
        onChange={(v) => updateMeta({ status: v as any })}
        options={[
          { value: 'draft',     label: 'Draft' },
          { value: 'in_review', label: 'In Review' },
          { value: 'approved',  label: 'Approved' },
          { value: 'archived',  label: 'Archived' },
        ]}
      />
    </div>
  )
}

// ── Grid Tab ──────────────────────────────────────────────────

function GridTab() {
  const { project, updateGrid } = useProjectStore()
  if (!project) return null
  const { grid } = project

  function addXLine() {
    const lastPos = grid.xLines.at(-1)?.position ?? 0
    const newLine: GridLine = {
      id: generateId('gx'),
      label: String.fromCharCode(65 + grid.xLines.length),
      position: lastPos + 5000,
    }
    updateGrid({ ...grid, xLines: [...grid.xLines, newLine] })
  }

  function addYLine() {
    const lastPos = grid.yLines.at(-1)?.position ?? 0
    const newLine: GridLine = {
      id: generateId('gy'),
      label: `${grid.yLines.length + 1}`,
      position: lastPos + 4000,
    }
    updateGrid({ ...grid, yLines: [...grid.yLines, newLine] })
  }

  function addStory() {
    const lastLevel = grid.stories.length > 0
      ? grid.stories.at(-1)!.level + grid.stories.at(-1)!.height
      : 0
    const labels = ['GF', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F', 'RF']
    const story: Story = {
      id: generateId('st'),
      label: labels[grid.stories.length] ?? `${grid.stories.length}F`,
      level: lastLevel,
      height: 3000,
      isMasterStory: grid.stories.length === 0,
    }
    updateGrid({ ...grid, stories: [...grid.stories, story] })
  }

  function updateXLine(id: string, field: keyof GridLine, value: any) {
    updateGrid({ ...grid, xLines: grid.xLines.map(l => l.id === id ? { ...l, [field]: value } : l) })
  }

  function updateYLine(id: string, field: keyof GridLine, value: any) {
    updateGrid({ ...grid, yLines: grid.yLines.map(l => l.id === id ? { ...l, [field]: value } : l) })
  }

  function updateStory(id: string, field: keyof Story, value: any) {
    updateGrid({ ...grid, stories: grid.stories.map(s => s.id === id ? { ...s, [field]: value } : s) })
  }

  function removeXLine(id: string) {
    updateGrid({ ...grid, xLines: grid.xLines.filter(l => l.id !== id) })
  }

  function removeYLine(id: string) {
    updateGrid({ ...grid, yLines: grid.yLines.filter(l => l.id !== id) })
  }

  function removeStory(id: string) {
    updateGrid({ ...grid, stories: grid.stories.filter(s => s.id !== id) })
  }

  const totalHeight = grid.stories.reduce((sum, s) => sum + s.height, 0)

  return (
    <div className="max-w-3xl space-y-8">
      <SectionTitle title="Grid Lines & Story Definition" />

      {/* Summary */}
      {grid.stories.length > 0 && (
        <div className="flex gap-4 text-xs font-mono">
          <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600">
            Total Stories: {grid.stories.length}
          </div>
          <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-emerald-600">
            Height: {(totalHeight / 1000).toFixed(1)} m
          </div>
          <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600">
            X-Bay: {grid.xLines.length - 1} | Y-Bay: {grid.yLines.length - 1}
          </div>
        </div>
      )}

      {/* X Grid Lines */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-700 font-mono font-semibold text-sm">X-Axis Grid Lines (A, B, C...)</h3>
          <AddButton onClick={addXLine} label="+ X Line" />
        </div>
        <GridTable
          lines={grid.xLines}
          onUpdate={updateXLine}
          onRemove={removeXLine}
          axisLabel="X"
        />
      </div>

      {/* Y Grid Lines */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-700 font-mono font-semibold text-sm">Y-Axis Grid Lines (1, 2, 3...)</h3>
          <AddButton onClick={addYLine} label="+ Y Line" />
        </div>
        <GridTable
          lines={grid.yLines}
          onUpdate={updateYLine}
          onRemove={removeYLine}
          axisLabel="Y"
        />
      </div>

      {/* Stories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-700 font-mono font-semibold text-sm">Story Definition</h3>
          <AddButton onClick={addStory} label="+ Add Story" />
        </div>
        <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#ffffff]">
                <th className="text-left px-4 py-3 text-gray-500">Story</th>
                <th className="text-left px-4 py-3 text-gray-500">Label</th>
                <th className="text-left px-4 py-3 text-gray-500">Height (mm)</th>
                <th className="text-left px-4 py-3 text-gray-500">Elevation (m)</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {grid.stories.map((s, i) => (
                <tr key={s.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-white/2">
                  <td className="px-4 py-3 text-gray-600">{i + 1}</td>
                  <td className="px-4 py-3">
                    <input
                      value={s.label}
                      onChange={(e) => updateStory(s.id, 'label', e.target.value)}
                      className="bg-[#ffffff] border border-[#e5e7eb] rounded px-2 py-1 text-gray-800 w-16 focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={s.height}
                      onChange={(e) => updateStory(s.id, 'height', Number(e.target.value))}
                      className="bg-[#ffffff] border border-[#e5e7eb] rounded px-2 py-1 text-gray-800 w-24 focus:border-blue-500 focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(s.level / 1000).toFixed(2)} m
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeStory(s.id)} className="text-gray-500 hover:text-red-600 transition-colors">✕</button>
                  </td>
                </tr>
              ))}
              {grid.stories.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No stories yet — add one</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function GridTable({ lines, onUpdate, onRemove, axisLabel }: {
  lines: GridLine[]
  onUpdate: (id: string, field: keyof GridLine, value: any) => void
  onRemove: (id: string) => void
  axisLabel: string
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-[#e5e7eb] bg-[#ffffff]">
            <th className="text-left px-4 py-3 text-gray-500">Label</th>
            <th className="text-left px-4 py-3 text-gray-500">Position (mm)</th>
            <th className="text-left px-4 py-3 text-gray-500">Position (m)</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id} className="border-b border-[#f3f4f6] last:border-0 hover:bg-white/2">
              <td className="px-4 py-3">
                <input
                  value={l.label}
                  onChange={(e) => onUpdate(l.id, 'label', e.target.value)}
                  className="bg-[#ffffff] border border-[#e5e7eb] rounded px-2 py-1 text-gray-800 w-16 focus:border-blue-500 focus:outline-none"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  value={l.position}
                  onChange={(e) => onUpdate(l.id, 'position', Number(e.target.value))}
                  className="bg-[#ffffff] border border-[#e5e7eb] rounded px-2 py-1 text-gray-800 w-28 focus:border-blue-500 focus:outline-none"
                />
              </td>
              <td className="px-4 py-3 text-gray-600">{(l.position / 1000).toFixed(2)} m</td>
              <td className="px-4 py-3">
                <button onClick={() => onRemove(l.id)} className="text-gray-500 hover:text-red-600 transition-colors">✕</button>
              </td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No {axisLabel}-lines yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Material Tab ──────────────────────────────────────────────

function MaterialTab() {
  const { project, updateMaterials } = useProjectStore()
  if (!project) return null
  const { materials } = project

  function setFc(fc: number) {
    updateMaterials({
      ...materials,
      concrete: { ...materials.concrete, fc, Ec: calcEc(fc) },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle title="Material Properties" />

      {/* Concrete */}
      <Card title="🧱 Concrete">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Grade" value={materials.concrete.grade}
            onChange={(v) => updateMaterials({ ...materials, concrete: { ...materials.concrete, grade: v } })} />
          <div>
            <label className="block text-xs text-gray-600 font-mono mb-2">f'c (MPa) — Compressive Strength</label>
            <input
              type="number"
              value={materials.concrete.fc}
              onChange={(e) => setFc(Number(e.target.value))}
              className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-3 text-gray-800 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 font-mono mb-2">Ec (MPa) — Modulus of Elasticity</label>
            <div className="bg-[#ffffff] border border-[#f3f4f6] rounded-lg px-4 py-3 text-gray-500 font-mono text-sm">
              {materials.concrete.Ec.toLocaleString()} <span className="text-xs text-gray-400">(auto = 4700√f'c)</span>
            </div>
          </div>
          <InputField label="Unit Weight (kN/m³)" value={materials.concrete.unitWeight.toString()}
            onChange={(v) => updateMaterials({ ...materials, concrete: { ...materials.concrete, unitWeight: Number(v) } })}
            type="number" />
          <InputField label="Poisson's Ratio" value={materials.concrete.poissonRatio.toString()}
            onChange={(v) => updateMaterials({ ...materials, concrete: { ...materials.concrete, poissonRatio: Number(v) } })}
            type="number" />
        </div>
      </Card>

      {/* Steel */}
      <Card title="⚙️ Steel Reinforcement">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Grade" value={materials.steel.grade}
            onChange={(v) => updateMaterials({ ...materials, steel: { ...materials.steel, grade: v } })} />
          <InputField label="fy (MPa) — Yield Strength" value={materials.steel.fy.toString()}
            onChange={(v) => updateMaterials({ ...materials, steel: { ...materials.steel, fy: Number(v) } })}
            type="number" />
          <div>
            <label className="block text-xs text-gray-600 font-mono mb-2">Es (MPa)</label>
            <div className="bg-[#ffffff] border border-[#f3f4f6] rounded-lg px-4 py-3 text-gray-500 font-mono text-sm">
              200,000 <span className="text-xs text-gray-400">(fixed)</span>
            </div>
          </div>
          <InputField label="fyt (MPa) — Transverse Steel" value={materials.steel.fyt.toString()}
            onChange={(v) => updateMaterials({ ...materials, steel: { ...materials.steel, fyt: Number(v) } })}
            type="number" />
        </div>
      </Card>

      {/* Cover */}
      <Card title="📏 Clear Cover">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-600 font-mono mb-2">Global Clear Cover (mm)</label>
            <input
              type="number"
              value={materials.globalClearCover}
              onChange={(e) => updateMaterials({ ...materials, globalClearCover: Number(e.target.value) })}
              className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-3 text-gray-800 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="text-xs text-gray-500 font-mono mt-5">
            Typically 40mm (beam/column)<br />30mm (slab)
          </div>
        </div>
      </Card>
    </div>
  )
}

// ── Load Tab ──────────────────────────────────────────────────

function LoadTab() {
  const { project, updateLoads } = useProjectStore()
  if (!project) return null
  const { loads } = project

  function updateSeismic(field: string, value: any) {
    const zone = field === 'seismicZone' ? value : loads.seismicLoad.seismicZone
    const siteClass = field === 'siteClass' ? value : loads.seismicLoad.siteClass
    updateLoads({
      ...loads,
      seismicLoad: {
        ...loads.seismicLoad,
        [field]: value,
        Z: getBNBCZoneFactor(zone),
        Ca: getBNBCCa(zone, siteClass),
        Cv: getBNBCCv(zone, siteClass),
      },
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SectionTitle title="Load Definition (BNBC 2020)" />

      {/* Dead + Live */}
      <Card title="↓ Gravity Loads">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="SDL — Floor (kN/m²)" value={(loads.deadLoad.superimposedDL ?? loads.deadLoad.deadLoad ?? 0).toString()}
            onChange={(v) => updateLoads({ ...loads, deadLoad: { ...loads.deadLoad, superimposedDL: Number(v) } })}
            type="number" hint="Floor finish + partition" />
          <InputField label="LL — Floor (kN/m²)" value={loads.liveLoad.liveLoad.toString()}
            onChange={(v) => updateLoads({ ...loads, liveLoad: { ...loads.liveLoad, liveLoad: Number(v) } })}
            type="number" hint="BNBC Table 2.2" />
          <InputField label="SDL — Roof (kN/m²)" value={(loads.roofLoad.superimposedDL ?? loads.roofLoad.deadLoad ?? 0).toString()}
            onChange={(v) => updateLoads({ ...loads, roofLoad: { ...loads.roofLoad, superimposedDL: Number(v) } })}
            type="number" />
          <InputField label="LL — Roof (kN/m²)" value={loads.roofLoad.liveLoad.toString()}
            onChange={(v) => updateLoads({ ...loads, roofLoad: { ...loads.roofLoad, liveLoad: Number(v) } })}
            type="number" />
          <InputField label="Wall Load (kN/m)" value={(loads.deadLoad.wallLoad ?? 10).toString()}
            onChange={(v) => updateLoads({ ...loads, deadLoad: { ...loads.deadLoad, wallLoad: Number(v) } })}
            type="number" hint="Linear load on beam" />
          <InputField label="Water Tank (kN/m²)" value={(loads.roofLoad.waterTank ?? 0).toString()}
            onChange={(v) => updateLoads({ ...loads, roofLoad: { ...loads.roofLoad, waterTank: Number(v) } })}
            type="number" />
        </div>
      </Card>

      {/* Seismic */}
      <Card title="🌀 Seismic Load (BNBC 2020)">
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Seismic Zone" value={(loads.seismicLoad.seismicZone ?? loads.seismicLoad.zone ?? 2).toString()}
            onChange={(v) => updateSeismic('seismicZone', Number(v) as 1 | 2 | 3)}
            options={[
              { value: '1', label: 'Zone 1 — Z=0.12' },
              { value: '2', label: 'Zone 2 — Z=0.20' },
              { value: '3', label: 'Zone 3 — Z=0.28' },
            ]} />
          <SelectField label="Site Class" value={loads.seismicLoad.siteClass}
            onChange={(v) => updateSeismic('siteClass', v)}
            options={[
              { value: 'SA', label: 'SA — Hard Rock' },
              { value: 'SB', label: 'SB — Rock' },
              { value: 'SC', label: 'SC — Hard Soil' },
              { value: 'SD', label: 'SD — Soft Soil' },
              { value: 'SE', label: 'SE — Very Soft' },
            ]} />
          <InputField label="I (Importance Factor)" value={loads.seismicLoad.importanceFactor.toString()}
            onChange={(v) => updateSeismic('importanceFactor', Number(v))} type="number" />
          <InputField label="R (Response Modification)" value={loads.seismicLoad.responseModificationFactor.toString()}
            onChange={(v) => updateSeismic('responseModificationFactor', Number(v))} type="number" />
        </div>

        {/* Auto-calc values */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Z', value: loads.seismicLoad.Z ?? 'auto' },
            { label: 'Ca', value: loads.seismicLoad.Ca ?? 'auto' },
            { label: 'Cv', value: loads.seismicLoad.Cv ?? 'auto' },
          ].map((item) => (
            <div key={item.label} className="bg-[#ffffff] rounded-lg p-3 border border-[#f3f4f6]">
              <div className="text-xs text-gray-500 font-mono">{item.label} (auto)</div>
              <div className="text-emerald-600 font-mono font-bold text-lg mt-1">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <SelectField label="Analysis Method" value={loads.seismicLoad.analysisMethod ?? 'static'}
            onChange={(v) => updateSeismic('analysisMethod', v)}
            options={[
              { value: 'static', label: 'Static — Equivalent Lateral Force (ELF)' },
              { value: 'response_spectrum', label: 'Response Spectrum' },
              { value: 'time_history', label: 'Time History (Phase 5)' },
            ]} />
        </div>
      </Card>

      {/* Wind */}
      <Card title="💨 Wind Load">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Basic Wind Speed (km/h)" value={loads.windLoad.basicWindSpeed.toString()}
            onChange={(v) => updateLoads({ ...loads, windLoad: { ...loads.windLoad, basicWindSpeed: Number(v) } })}
            type="number" hint="From BNBC wind map" />
          <SelectField label="Exposure Category" value={loads.windLoad.exposureCategory}
            onChange={(v) => updateLoads({ ...loads, windLoad: { ...loads.windLoad, exposureCategory: v as 'B' | 'C' | 'D' } })}
            options={[
              { value: 'B', label: 'B — Urban / Vegetation' },
              { value: 'C', label: 'C — Open Terrain' },
              { value: 'D', label: 'D — Coastal' },
            ]} />
        </div>
      </Card>

      {/* Load Combos summary */}
      <Card title="⚡ Load Combinations">
        <div className="space-y-1">
          {loads.loadCombinations.map((lc) => (
            <div key={lc.id} className="flex items-center justify-between py-2 border-b border-[#f3f4f6] last:border-0">
              <span className="text-gray-700 font-mono text-xs">{lc.label}</span>
              <span className="text-gray-500 font-mono text-xs">{lc.code}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => updateLoads({ ...loads, loadCombinations: defaultLoadCombinations() })}
          className="mt-3 text-xs text-gray-500 hover:text-gray-600 font-mono transition-colors"
        >
          ↺ Reset to Default
        </button>
      </Card>
    </div>
  )
}

// ── Shared UI ─────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return (
    <div>
      <div className="h-0.5 rainbow-bar rounded mb-4" />
      <h2 className="text-gray-800 font-mono font-bold text-base">{title}</h2>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#e5e7eb]">
        <h3 className="text-gray-700 font-mono font-semibold text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InputField({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 font-mono mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-gray-800 placeholder-slate-600 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
      />
      {hint && <p className="text-xs text-gray-400 font-mono mt-1">{hint}</p>}
    </div>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 font-mono mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-gray-800 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg border border-[#e5e7eb] text-gray-600 text-xs font-mono hover:border-blue-500/40 hover:text-blue-600 transition-all"
    >
      {label}
    </button>
  )
}
