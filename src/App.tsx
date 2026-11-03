import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import WorksPage from './pages/WorksPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import CustomersPage from './pages/CustomersPage'
import CustomerDetailPage from './pages/CustomerDetailPage'
import TasksPage from './pages/TasksPage'
import TeamPage from './pages/TeamPage'
import ProfilePage from './pages/ProfilePage'

function FullScreenLoading() {
  return (
    <div className="fullscreen-loading">
      <div className="loader" />
      <p>正在连接 Supabase...</p>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth()

  if (loading) return <FullScreenLoading />
  if (!configured) {
    return (
      <div className="setup-screen">
        <h1>需要配置 Supabase</h1>
        <p>请复制 <code>.env.example</code> 为 <code>.env.local</code>，填入项目 URL 和 anon public key 后重启服务。</p>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  return children
}

function RequireOrganization({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoading />
  if (!profile?.organization_id) return <Navigate to="/onboarding" replace />

  return children
}

function RootRedirect() {
  const { session, loading } = useAuth()

  if (loading) return <FullScreenLoading />
  return <Navigate to={session ? '/' : '/home'} replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/works" element={<WorksPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route
        path="/onboarding"
        element={(
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        )}
      />
      <Route
        element={(
          <RequireAuth>
            <RequireOrganization>
              <Layout />
            </RequireOrganization>
          </RequireAuth>
        )}
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  )
}
