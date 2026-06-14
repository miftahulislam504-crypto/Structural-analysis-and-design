import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useProjectStore } from '../store/useProjectStore'
import { useUIStore } from '../store/useUIStore'
import { ActiveModule } from '../lib/types'
import Sidebar from '../components/layout/Sidebar'
import Topbar from '../components/layout/Topbar'
import DashboardModule from '../components/modules/DashboardModule'
import ProjectSetupModule from '../components/modules/ProjectSetupModule'
import ModelingModule from '../components/modeling/ModelingModule'
import DSMSolverModule from '../components/analysis/DSMSolverModule'
import LateralLoadModule from '../components/loads/LateralLoadModule'
import DesignModule from '../components/design/DesignModule'
import AdvancedMembersModule from '../components/advanced/AdvancedMembersModule'
import DetailingModule from '../components/detailing/DetailingModule'
import DrawingModule from '../components/drawing/DrawingModule'
import BBSModule from '../components/bbs/BBSModule'
import ComplianceModule from '../components/compliance/ComplianceModule'
import ReportModule from '../components/report/ReportModule'
import OptimizationModule from '../components/optimization/OptimizationModule'
import BIMModule from '../components/bim/BIMModule'
import FEMModule from '../components/fem/FEMModule'

const MODULE_MAP: Record<ActiveModule, React.FC> = {
  dashboard:     DashboardModule,
  project_setup: ProjectSetupModule,
  modeling:      ModelingModule,
  analysis:      DSMSolverModule,
  loads:         LateralLoadModule,
  design:        DesignModule,
  detailing:     DetailingModule,
  drawing:       DrawingModule,
  bbs:           BBSModule,
  compliance:    ComplianceModule,
  report:        ReportModule,
  optimization:  OptimizationModule,
  bim:           BIMModule,
  fem:           FEMModule,
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project, loadProject, isLoading, error } = useProjectStore()
  const { activeModule } = useUIStore()

  useEffect(() => { if (id && !project) loadProject(id) }, [id])

  if (isLoading) return <LoadingScreen />
  if (error)     return <ErrorScreen error={error} onBack={() => navigate('/dashboard')} />
  if (!project)  return <LoadingScreen />

  const ActiveComponent = MODULE_MAP[activeModule] ?? DashboardModule

  return (
    <div className="flex h-screen bg-[#0a0f1e] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto"><ActiveComponent /></main>
      </div>
    </div>
  )
}

function PlaceholderModule({ title, phase }: { title: string; phase: number }) {
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899']
  const color  = colors[phase % colors.length]
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6 border"
        style={{ background: color+'15', borderColor: color+'40' }}>🔧</div>
      <h2 className="text-slate-200 font-mono font-bold text-xl mb-2">{title}</h2>
      <p className="text-slate-500 font-mono text-sm mb-4">Phase {phase}-এ আসছে</p>
      <div className="px-4 py-2 rounded-full text-xs font-mono border"
        style={{ color, borderColor: color+'40', background: color+'10' }}>
        PHASE {phase} — UPCOMING
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl font-black">C</div>
        <p className="text-slate-500 font-mono text-sm">প্রজেক্ট লোড হচ্ছে...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1e] gap-4">
      <div className="text-red-400 font-mono text-sm">⚠ {error}</div>
      <button onClick={onBack}
        className="px-6 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 font-mono text-sm hover:border-red-500/50 hover:text-red-400 transition-all">
        ← ড্যাশবোর্ডে ফিরে যান
      </button>
    </div>
  )
}
