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
    <div className="min-h-screen bg-[#ffffff] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white text-3xl font-black mb-4 shadow-glow-blue">
            C
          </div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">
            CivilOS <span className="text-blue-600">Structural</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1 font-mono tracking-wider">
            BNBC 2020 | ACI 318-19
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-xl p-8">
          {/* Tab switcher */}
          <div className="flex rounded-lg overflow-hidden border border-[#e5e7eb] mb-8">
            {(['login', 'register'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); clearError() }}
                className={`flex-1 py-3 text-sm font-mono font-medium transition-all ${
                  mode === tab
                    ? 'bg-blue-500/15 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'login' ? 'Login' : 'New Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name field (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-gray-600 font-mono tracking-wider mb-2">
                  Engineer Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engr. Your Name"
                  required
                  className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-3 text-gray-800 placeholder-slate-600 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs text-gray-600 font-mono tracking-wider mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@example.com"
                required
                className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-3 text-gray-800 placeholder-slate-600 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs text-gray-600 font-mono tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#ffffff] border border-[#e5e7eb] rounded-lg px-4 py-3 text-gray-800 placeholder-slate-600 font-mono text-sm focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 text-sm font-mono">
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-mono font-semibold text-sm tracking-wider hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading
                ? 'Please wait...'
                : mode === 'login'
                ? 'Login →'
                : 'Create Account →'}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-gray-500 text-xs font-mono mt-6">
            CivilOS Structural v2.0 — Bangladesh Engineering Practice
          </p>
        </div>
      </div>
    </div>
  )
}
