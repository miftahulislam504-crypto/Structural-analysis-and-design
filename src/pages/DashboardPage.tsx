import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useProjectStore } from '../store/useProjectStore'
import { ProjectTemplate, ProjectMeta } from '../lib/types'
import { formatDate } from '../lib/utils'

const TEMPLATES: { id: ProjectTemplate; label: string; desc: string; icon: string; stories: string }[] = [
  { id: 'blank', label: 'খালি প্রজেক্ট', desc: 'নিজে সব সেটআপ করব', icon: '📄', stories: '—' },
  { id: 'residential_3story', label: '৩ তলা আবাসিক', desc: '3×3 বে, 3m তলা', icon: '🏠', stories: '৩ তলা' },
  { id: 'residential_6story', label: '৬ তলা আবাসিক', desc: '3×3 বে, 3m তলা', icon: '🏢', stories: '৬ তলা' },
  { id: 'commercial_4story', label: '৪ তলা বাণিজ্যিক', desc: '4×3 বে, 4m তলা', icon: '🏬', stories: '৪ তলা' },
  { id: 'industrial', label: 'শিল্প ভবন', desc: '3×2 বে, 5m তলা', icon: '🏭', stories: '৩ তলা' },
]

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  in_review: '#f97316',
  approved: '#22c55e',
  archived: '#475569',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'খসড়া',
  in_review: 'পর্যালোচনাধীন',
  approved: 'অনুমোদিত',
  archived: 'সংরক্ষিত',
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
    address: 'ঢাকা, বাংলাদেশ',
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
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Top Nav */}
      <nav className="border-b border-[#1e2d4a] px-6 py-4 flex items-center justify-between sticky top-0 bg-[#080d1a] z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-black text-lg shadow-glow-red">
            C
          </div>
          <div>
            <div className="text-slate-100 font-mono font-bold text-sm">CivilOS Structural</div>
            <div className="text-slate-600 text-xs font-mono">v2.0 — BNBC 2020</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-slate-300 text-sm font-mono">{user?.displayName ?? 'Engineer'}</div>
            <div className="text-slate-600 text-xs">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg border border-[#1e2d4a] text-slate-400 text-xs font-mono hover:border-red-500/50 hover:text-red-400 transition-all"
          >
            লগআউট
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 font-mono">
              আমার প্রজেক্টসমূহ
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {projectList.length} টি প্রজেক্ট
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-mono font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all shadow-glow-red"
          >
            + নতুন প্রজেক্ট
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
                className="text-left p-6 rounded-xl border border-[#1e2d4a] bg-[#0d1221] hover:border-[#1e3a5f] hover:bg-[#111827] transition-all group"
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
                <h3 className="text-slate-200 font-mono font-semibold text-sm mb-1 group-hover:text-white transition-colors">
                  {p.name}
                </h3>
                <p className="text-slate-600 text-xs font-mono">
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
          <div className="w-full max-w-2xl bg-[#0d1221] border border-[#1e2d4a] rounded-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[#1e2d4a]">
              <h2 className="text-slate-100 font-mono font-bold">নতুন প্রজেক্ট</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xl transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Template Selection */}
              <div>
                <label className="block text-xs text-slate-400 font-mono tracking-wider mb-3">
                  টেমপ্লেট বেছে নিন
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        selectedTemplate === t.id
                          ? 'border-red-500 bg-red-500/10 text-red-400'
                          : 'border-[#1e2d4a] bg-[#080d1a] text-slate-400 hover:border-[#1e3a5f]'
                      }`}
                    >
                      <div className="text-2xl mb-2">{t.icon}</div>
                      <div className="text-xs font-mono font-semibold">{t.label}</div>
                      <div className="text-xs text-slate-600 mt-1">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <FormField
                  label="প্রজেক্টের নাম *"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  placeholder="যেমন: মোহাম্মদপুর ৮ তলা আবাসিক ভবন"
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="ক্লায়েন্ট"
                    value={form.client}
                    onChange={(v) => setForm({ ...form, client: v })}
                    placeholder="মালিকের নাম"
                  />
                  <FormField
                    label="প্রজেক্ট নম্বর"
                    value={form.projectNo}
                    onChange={(v) => setForm({ ...form, projectNo: v })}
                    placeholder="COS-000001"
                  />
                </div>
                <FormField
                  label="ঠিকানা"
                  value={form.address}
                  onChange={(v) => setForm({ ...form, address: v })}
                  placeholder="ঢাকা, বাংলাদেশ"
                />
                <FormField
                  label="প্রকৌশলী"
                  value={form.engineer}
                  onChange={(v) => setForm({ ...form, engineer: v })}
                  placeholder="Engr. আপনার নাম"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-3 rounded-lg border border-[#1e2d4a] text-slate-400 font-mono text-sm hover:border-slate-500 transition-all"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name.trim()}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-mono font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  প্রজেক্ট তৈরি করুন →
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
      <label className="block text-xs text-slate-400 font-mono tracking-wider mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#080d1a] border border-[#1e2d4a] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 font-mono text-sm focus:border-red-500 focus:outline-none transition-colors"
      />
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-6">🏗️</div>
      <h3 className="text-slate-300 font-mono font-bold text-lg mb-2">কোনো প্রজেক্ট নেই</h3>
      <p className="text-slate-600 text-sm mb-8">প্রথম প্রজেক্ট তৈরি করে শুরু করুন</p>
      <button
        onClick={onNew}
        className="px-8 py-3 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-mono font-semibold text-sm hover:opacity-90 transition-all"
      >
        + নতুন প্রজেক্ট তৈরি করুন
      </button>
    </div>
  )
}
