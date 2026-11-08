import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import WaterRipple from './WaterRipple'

const navItems = [
  { to: '/', label: '个人主页', icon: '✦' },
  { to: '/app', label: '仪表盘', icon: '▦' },
  { to: '/app/customers', label: '项目', icon: '◎' },
  { to: '/app/tasks', label: '任务', icon: '✓' },
  { to: '/app/team', label: '成员', icon: '☷' },
  { to: '/app/profile', label: '我的', icon: '☻' },
]

export default function Layout() {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SupaProject</strong>
            <span>{organization?.name ?? '未创建空间'}</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{initials(profile?.full_name ?? '用户')}</div>
          <div className="sidebar-user-meta">
            <strong>{profile?.full_name}</strong>
            <span>{profile?.email}</span>
          </div>
          <button type="button" className="signout" onClick={signOut} title="退出登录">
            ↗
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      {/* 全站的水：管理系统的每次点击也在水面荡开 */}
      <WaterRipple />
    </div>
  )
}
