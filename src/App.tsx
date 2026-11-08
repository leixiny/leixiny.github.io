import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoadingScreen from './components/LoadingScreen'
import { markIntroDone } from './lib/intro'
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
  return <LoadingScreen />
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth()
  const here = useLocation()

  if (loading) return <FullScreenLoading />
  if (!configured) {
    return (
      <div className="setup-screen">
        <h1>需要配置 Supabase</h1>
        <p>请复制 <code>.env.example</code> 为 <code>.env.local</code>，填入项目 URL 和 anon public key 后重启服务。</p>
      </div>
    )
  }
  // 游客能进来逛，只是编辑要登录：记下想去哪，登录完直接送回去
  if (!session) return <Navigate to="/login" replace state={{ from: here }} />

  return children
}

function RequireOrganization({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) return <FullScreenLoading />
  if (!profile?.organization_id) return <Navigate to="/onboarding" replace />

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* 开屏就是个人首页：不登录也能看 */}
      <Route path="/" element={<HomePage />} />
      {/* 老地址还留着：页脚、「留言」链接都指着 /home */}
      <Route path="/home" element={<HomePage />} />
      {/* 作品集是独立的一页，同样不用登录 */}
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
      {/* 管理系统（改作品、改项目）才需要登录 */}
      <Route
        path="/app"
        element={(
          <RequireAuth>
            <RequireOrganization>
              <Layout />
            </RequireOrganization>
          </RequireAuth>
        )}
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  // 首屏加载页：至少露一个完整的翻字循环，页面真加载完了也等这一下，再淡出
  const [intro, setIntro] = useState<'hold' | 'out' | 'done'>('hold')

  useEffect(() => {
    const HOLD = 1250
    const started = performance.now()
    const timers: number[] = []
    document.documentElement.classList.add('is-booting')

    const leave = () => {
      const wait = Math.max(0, HOLD - (performance.now() - started))
      timers.push(
        window.setTimeout(() => {
          setIntro('out')
          document.documentElement.classList.remove('is-booting')
          timers.push(
            window.setTimeout(() => {
              setIntro('done')
              // 幕布落下去才让首页落笔，开场那几笔不藏在加载页后面
              markIntroDone()
            }, 600),
          )
        }, wait),
      )
    }

    if (document.readyState === 'complete') leave()
    else window.addEventListener('load', leave, { once: true })

    return () => {
      timers.forEach(window.clearTimeout)
      window.removeEventListener('load', leave)
      document.documentElement.classList.remove('is-booting')
    }
  }, [])

  return (
    <>
      {intro !== 'done' ? <LoadingScreen leaving={intro === 'out'} /> : null}
      <HashRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </>
  )
}
