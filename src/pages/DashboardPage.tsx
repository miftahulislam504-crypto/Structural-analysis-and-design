import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useProjectStore } from '../store/useProjectStore'
import { ProjectTemplate, ProjectMeta } from '../lib/types'
import { formatDate } from '../lib/utils'

const TEMPLATES: { id: ProjectTemplate; label: string; desc: string; icon: string; stories: string }[] = [
  { id: 'blank', label: 'Blank Project', desc: 'I will set up everything myself', icon: '📄', stories: '—' },
  { id: 'residential_3story', label: '3-Story Residential', desc: '3×3 bay, 3m story', icon: '🏠', stories: '3 stories' },
  { id: 'residential_6story', label: '6-Story Residential', desc: '3×3 bay, 3m story', icon: '🏢', stories: '6 stories' },
  { id: 'commercial_4story', label: '4-Story Commercial', desc: '4×3 bay, 4m story', icon: '🏬', stories: '4 stories' },
  { id: 'industrial', label: 'Industrial Building', desc: '3×2 bay, 5m story', icon: '🏭', stories: '3 stories' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  in_review: '#d97706',
  approved: '#059669',
  archived: '#6b7280',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  approved: 'Approved',
  archived: 'Archived',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { projectList, createProject, loadProject, loadProjectList, isSaving } = useProjectStore()

  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate>('residential_3story')
  const [form, setForm] = useState({
    name: '',
    client: '',
    address: 'Dhaka, Bangladesh',
    engineer: user?.displayName ?? '',
    projectNo: `COS-${Date.now().toString().slice(-6)}`,
  })

  useEffect(() => {
    if (user) loadProjectList(user.uid)
  }, [user])

  function handleCreate() {
    if (!form.name.trim()) return
    const project = createProject(selectedTemplate, {
      name: form.name,
      nameLocal: form.name,
      client: form.client,
      address: form.address,
      engineer: form.engineer,
      projectNo: form.projectNo,
    })
    navigate(`/project/${project.id}`)
  }

  async function handleOpen(id: string) {
    await loadProject(id)
    navigate(`/project/${id}`)
  }

  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* Top Nav */}
      <nav className="border-b border-[#e5e7eb] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#ffffff] z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-black text-lg shadow-glow-blue">
            C
          </div>
          <div>
            <div className="text-gray-900 font-mono font-bold text-sm">CivilOS Structural</div>
            <div className="text-gray-500 text-xs font-mono">v2.0 — BNBC 2020</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-gray-700 text-sm font-mono">{user?.displayName ?? 'Engineer'}</div>
            <div className="text-gray-500 text-xs">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg border border-[#e5e7eb] text-gray-600 text-xs font-mono hover:border-red-500/50 hover:text-red-600 transition-all"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-mono">
              My Projects
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {projectList.length} projects
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-mono font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-glow-blue"
          >
            + New Project
          </button>
        </div>

        {/* Project Grid */}
        {projectList.length === 0 ? (
          <EmptyState onNew={() => setShowNewModal(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {projectList.map((p) => (
              <button
                key={p.id}
                onClick={() => handleOpen(p.id)}
                className="text-left p-6 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] hover:border-blue-300 hover:bg-white hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center text-xl">
                    🏗️
                  </div>
                  <span
                    className="text-xs font-mono px-2 py-1 rounded-full border"
                    style={{
                      color: STATUS_COLORS[p.status],
                      borderColor: STATUS_COLORS[p.status] + '40',
                      background: STATUS_COLORS[p.status] + '10',
                    }}
                  >
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>
                <h3 className="text-gray-800 font-mono font-semibold text-sm mb-1 group-hover:text-blue-700 transition-colors">
                  {p.name}
                </h3>
                <p className="text-gray-500 text-xs font-mono">
                  {formatDate(p.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}
        >
          <div className="w-full max-w-2xl bg-[#f9fafb] border border-[#e5e7eb] rounded-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#e5e7eb]">
              <h2 className="text-gray-900 font-mono font-bold">New Project</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-gray-500 hover:text-gray-700 text-xl transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Template Selection */}
              <div>
                <label className="block text-xs text-gray-600 font-mono tracking-wider mb-3">
                  Choose a Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedTemplate === t.id
                          ? 'border-blue-500 bg-blue-500/10 text-blue-700'
                          : 'border-[#e5e7eb] bg-[#ffffff] text-gray-600 hover:border-[#d1d5db]'
                      }`}
                    >
                      <div className="text-2xl mb-2">{t.icon}</div>
                      <div className="text-xs font-mono font-semibold">{t.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <FormField
                  label="Project Name *"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="e.g. Mohammadpur 8-Story Residential Building"
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Client"
                    value={form.client}
                    onChange={(v) => setForm({ ...form, client: v })}
                    placeholder="Owner's name"
                  />
                  <FormField
                    label="Project Number"
                    value={form.projectNo}
                    onChange={(v) => setForm({ ...form, projectNo: v })}
                    placeholder="COS-000001"
                  />
                </div>
                <FormField
                  label="Address"
                  value={form.address}
                  onChange={(v) => setForm({ ...form, address: v })}
                  placeholder="Dhaka, Bangladesh"
                />
                <FormField
                  label="Engineer"
                  value={form.engineer}
                  onChange={(v) => setForm({ ...form, engineer: v })}
                  placeholder="Engr. Your Name"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-3 rounded-lg border border-[#e5e7eb] text-gray-600 font-mono text-sm hover:border-gray-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim()}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-mono font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Create Project →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FormField({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-600 font-mono tracking-wider mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-3 text-gray-800 placeholder-slate-600 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
      />
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-6">🏗️</div>
      <h3 className="text-gray-700 font-mono font-bold text-lg mb-2">No Projects Yet</h3>
      <p className="text-gray-500 text-sm mb-8">Get started by creating your first project</p>
      <button
        onClick={onNew}
        className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-mono font-semibold text-sm hover:opacity-90 transition-all"
      >
        + Create New Project
      </button>
    </div>
  )
}
