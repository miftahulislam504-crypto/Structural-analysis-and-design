import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'

// Pages (lazy imports in later phases — direct for now)
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ProjectPage from './pages/ProjectPage'


export default function App() {
  const { user, initialized, init } = useAuthStore()

  useEffect(() => {
    const unsubscribe = init()
    return unsubscribe
  }, [init])

  // Auth loading state
  if (!initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white text-2xl font-black shadow-glow-red">
            C
          </div>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-red-500 animate-pulse-glow"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/auth"
        element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />}
      />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={user ? <DashboardPage /> : <Navigate to="/auth" replace />}
      />
      <Route
        path="/project/:id"
        element={user ? <ProjectPage /> : <Navigate to="/auth" replace />}
      />

      {/* Default */}
      <Route
        path="*"
        element={<Navigate to={user ? '/dashboard' : '/auth'} replace />}
      />
    </Routes>
  )
}
