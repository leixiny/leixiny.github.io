import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AxonLayout from './components/AxonLayout'
import LoadingScreen from './components/LoadingScreen'
import { markIntroDone } from './lib/intro'
import {
  AuthPage,
  CustomerDetailPage,
  CustomersPage,
  DashboardPage,
  OnboardingPage,
  ProfilePage,
  TasksPage,
  TeamPage,
  WorksAdminPage,
} from './lib/pages'
import HomePage from './pages/HomePage'

/* 首页是落地页，留在主包里先到先得；后台各页按路由拆包，
   进后台才下载那几页的代码 —— 首包轻了，开屏就快。
   加载器见 lib/lazyPage.tsx：不用 React.lazy，省掉它挂起后那 300ms 的重试延迟 */

function FullScreenLoading() {
  return <LoadingScreen />
}

/** 作品集已经换成独立的 3D 放映页（public/showcase.html）：
 *  老地址 #/works 不再渲染旧的水面版，直接换成那一页，收藏夹里的链接也不会断 */
function WorksShowcaseRedirect() {
  useEffect(() => {
    window.location.replace('showcase.html')
  }, [])
  return <FullScreenLoading />
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

/** 换页回到顶部：从首页滚到底点进后台，不该落在半空中；
 *  带着 ?to=contact 来的不重置，那一页自己会滚到留言区 */
function RouteScrollReset() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    const target = new URLSearchParams(window.location.hash.split('?')[1] || '').get('to')
    if (target) return
    window.scrollTo(0, 0)
  }, [pathname, search])
  return null
}

function AppRoutes() {
  return (
    <Routes>
        {/* 开屏就是个人首页：不登录也能看 */}
        <Route path="/" element={<HomePage />} />
        {/* 老地址还留着：页脚、「留言」链接都指着 /home */}
        <Route path="/home" element={<HomePage />} />
        {/* 作品集 = 放映页，同一个页面，旧地址跳过去 */}
        <Route path="/works" element={<WorksShowcaseRedirect />} />
        <Route path="/showcase" element={<WorksShowcaseRedirect />} />
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
                <AxonLayout />
              </RequireOrganization>
            </RequireAuth>
          )}
        >
          <Route index element={<DashboardPage />} />
          <Route path="works" element={<WorksAdminPage />} />
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
  // 首屏加载页：露一个完整的翻字循环，页面真加载完了也等这一下，再淡出
  const [intro, setIntro] = useState<'hold' | 'out' | 'done'>('hold')

  useEffect(() => {
    // 最短停留 900ms：翻字循环 2000ms 里落三个字母，900ms 刚好看到第一个落地
    const HOLD = 900
    // 最长等 2600ms：慢网下 load 事件可能被一张 400KB 的图拖住几秒，
    // 加载页不该跟着一起干等 —— 幕布先落，图自己继续下
    const CAP = 2600
    const started = performance.now()
    const timers: number[] = []
    document.documentElement.classList.add('is-booting')

    let left = false
    const leave = () => {
      if (left) return
      left = true
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
    timers.push(window.setTimeout(leave, CAP))

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
        <RouteScrollReset />
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </>
  )
}
