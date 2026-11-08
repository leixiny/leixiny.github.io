import { Suspense, lazy, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { prefetch, prefetchAdmin } from '../lib/prefetch'
import './axon.css'

const AxonField = lazy(() => import('../axon/AxonField'))

/** 十枚胶囊：里面七枚是分区，后面三枚是出口 */
const chips = [
  { to: '/app', label: '全部', end: true },
  { to: '/app/works', label: '作品' },
  { to: '/app/customers', label: '项目' },
  { to: '/app/tasks', label: '任务' },
  { to: '/app/team', label: '成员' },
  { to: '/app/profile', label: '资料' },
  { to: '/', label: '首页' },
]

/** 左栏四张卡：作品封面 + 两行说明 */
const cards = [
  { title: '客户任务管理系统', meta: '界面 · 内部工具', note: '全栈\n上线', cover: 'covers/crm-cut.webp' },
  { title: '把简历做成网站', meta: '排版 · 动效', note: '个人\n设计', cover: 'covers/website-cut.webp' },
  { title: '区域消费差异看板', meta: '数据 · 图表', note: '分析\n可视化', cover: 'covers/dashboard-cut.webp' },
  { title: '问卷 → 优先级', meta: '调研 · 归纳', note: '流程\n方法', cover: 'covers/survey-cut.webp' },
]

const STAR =
  '20.00,10.80 21.76,15.75 26.51,13.49 24.25,18.24 29.20,20.00 24.25,21.76 26.51,26.51 21.76,24.25 20.00,29.20 18.24,24.25 13.49,26.51 15.75,21.76 10.80,20.00 15.75,18.24 13.49,13.49 18.24,15.75'

export default function AxonLayout() {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const consoleRef = useRef<HTMLElement>(null)

  // 换分区回到顶部：表格滚到一半点「任务」，不该从半截开始看
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  // 空闲时先把后台几页的代码捂热，第一次点不会卡在下载上
  useEffect(() => {
    prefetchAdmin()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="axon">
      <Suspense fallback={null}>
        <AxonField />
      </Suspense>

      <div className="axon-ui">
        <header className="axon-brand">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="18.5" fill="none" stroke="#fff" strokeWidth="1.6" />
            <polygon points={STAR} fill="#fff" />
          </svg>
          <div>
            <b>雷馨怡</b>
            <span>{organization?.name ?? '作品管理台'}</span>
          </div>
        </header>

        <div className="axon-counter" title="分区数">07</div>

        <div className="axon-user">
          <span>{profile?.email}</span>
          <button type="button" onClick={signOut}>退出</button>
        </div>

        <nav className="axon-tags" aria-label="分区">
          {chips.map((chip) => (
            <NavLink
              key={chip.to}
              to={chip.to}
              end={chip.end}
              className={({ isActive }) => `axon-chip ${isActive ? 'is-on' : ''}`}
              onPointerEnter={() => prefetch(chip.to)}
              onFocus={() => prefetch(chip.to)}
              onTouchStart={() => prefetch(chip.to)}
            >
              {chip.label}
            </NavLink>
          ))}
          <a className="axon-chip" href="showcase.html" target="_blank" rel="noreferrer">放映</a>
          <a className="axon-chip" href="mailto:3121410697@qq.com">邮件</a>
          <button className="axon-chip" type="button" onClick={signOut}>退出</button>
        </nav>

        <aside className="axon-list" aria-label="作品索引">
          <div className="axon-list-head">索引 <s>/</s> index</div>
          {cards.map((card, i) => (
            <NavLink
              key={card.title}
              to="/app/works"
              className="axon-card"
              onPointerEnter={() => prefetch('/app/works')}
            >
              <div className="axon-thumb">
                <img
                  src={card.cover}
                  alt=""
                  width={220}
                  height={160}
                  decoding="async"
                  loading={i < 2 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                />
              </div>
              <div className="axon-meta">
                <span className="axon-card-title">
                  {card.title}
                  <em>{card.meta}</em>
                </span>
                <span className="axon-card-note">{card.note}</span>
              </div>
            </NavLink>
          ))}
        </aside>

        <section className="axon-console" ref={consoleRef}>
          {/* key 一换就重挂一次，进场那一下才有动画可放 */}
          <div className="axon-page" key={pathname}>
            <Outlet />
          </div>
        </section>

        <div className="axon-scrim" aria-hidden="true" />

        <aside className="axon-about">
          <div>
            <h2>[信息]</h2>
            <p>这里的改动直接写到线上页面。保存后刷新前台就能看到。</p>
          </div>
          <div>
            <h2>[在做的事]</h2>
            <p>一个自己的作品台：项目、任务、成员、作品档案，都在这里登记。</p>
            <p>留在这里，是为了让手上的活儿一直看得见，也给下一件新东西留个位置。</p>
          </div>
          <div>
            <h2>[在碰的]</h2>
            <ul>
              <li>作品档案</li>
              <li>数据看板</li>
              <li>客户系统</li>
              <li>网站排版</li>
            </ul>
          </div>
          <div>
            <h2>[联系]</h2>
            <a href="#/">首页 → 雷馨怡</a>
            <a href="mailto:3121410697@qq.com">邮箱 → 3121410697@qq.com</a>
          </div>
        </aside>
      </div>
    </div>
  )
}
