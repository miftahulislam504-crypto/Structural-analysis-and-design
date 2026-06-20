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
    <div className="flex h-screen bg-[#ffffff] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto"><ActiveComponent /></main>
      </div>
    </div>
  )
}

function PlaceholderModule({ title, phase }: { title: string; phase: number }) {
  const colors = ['#dc2626','#d97706','#d97706','#059669','#0891b2','#1a56db','#7c3aed','#ec4899']
  const color  = colors[phase % colors.length]
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6 border"
        style={{ background: color+'15', borderColor: color+'40' }}>🔧</div>
      <h2 className="text-gray-800 font-mono font-bold text-xl mb-2">{title}</h2>
      <p className="text-gray-500 font-mono text-sm mb-4">Coming in Phase {phase}</p>
      <div className="px-4 py-2 rounded-full text-xs font-mono border"
        style={{ color, borderColor: color+'40', background: color+'10' }}>
        PHASE {phase} — UPCOMING
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#ffffff]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-2xl font-black">C</div>
        <p className="text-gray-500 font-mono text-sm">Loading project...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#ffffff] gap-4">
      <div className="text-red-600 font-mono text-sm">⚠ {error}</div>
      <button onClick={onBack}
        className="px-6 py-2 rounded-lg border border-[#e5e7eb] text-gray-600 font-mono text-sm hover:border-red-500/50 hover:text-red-600 transition-all">
        ← Back to Dashboard
      </button>
    </div>
  )
}
