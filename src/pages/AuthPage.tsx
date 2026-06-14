import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const { login, register, isLoading, error, clearError } = useAuthStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (mode === 'login') {
      await login(email, password)
    } else {
      await register(email, password, name)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-3xl font-black mb-4 shadow-glow-red">
            C
          </div>
          <h1 className="text-2xl font-bold text-slate-100 font-mono">
            CivilOS <span className="text-red-400">Structural</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-mono tracking-wider">
            BNBC 2020 | ACI 318-19
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-xl p-8">
          {/* Tab switcher */}
          <div className="flex rounded-lg overflow-hidden border border-[#1e2d4a] mb-8">
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); clearError() }}
                className={`flex-1 py-3 text-sm font-mono font-medium transition-all ${
                  mode === tab
                    ? 'bg-red-500/20 text-red-400 border-b-2 border-red-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'login' ? 'লগইন' : 'নতুন অ্যাকাউন্ট'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name field (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-slate-400 font-mono tracking-wider mb-2">
                  প্রকৌশলীর নাম
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engr. আপনার নাম"
                  required
                  className="w-full bg-[#080d1a] border border-[#1e2d4a] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 font-mono text-sm focus:border-red-500 focus:outline-none transition-colors"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs text-slate-400 font-mono tracking-wider mb-2">
                ইমেইল
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@example.com"
                required
                className="w-full bg-[#080d1a] border border-[#1e2d4a] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 font-mono text-sm focus:border-red-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-slate-400 font-mono tracking-wider mb-2">
                পাসওয়ার্ড
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#080d1a] border border-[#1e2d4a] rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 font-mono text-sm focus:border-red-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-mono">
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-mono font-semibold text-sm tracking-wider hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading
                ? 'অপেক্ষা করুন...'
                : mode === 'login'
                ? 'লগইন করুন →'
                : 'অ্যাকাউন্ট তৈরি করুন →'}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-slate-600 text-xs font-mono mt-6">
            CivilOS Structural v2.0 — Bangladesh Engineering Practice
          </p>
        </div>
      </div>
    </div>
  )
}
