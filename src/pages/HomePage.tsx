import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import './HomePage.css'

interface GuestbookRow {
  id: number
  name: string
  message: string
  created_at: string
}

const skillGroups = [
  {
    name: '数据处理',
    items: [
      { name: 'SQL', evidence: '清洗 3.1 万条问卷与订单记录' },
      { name: 'Python / pandas', evidence: '按月批量处理销售明细' },
      { name: 'Excel 建模', evidence: '预算模型，误差控制在 3% 内' },
    ],
  },
  {
    name: '分析与洞察',
    items: [
      { name: '用户调研', evidence: '主导 312 份问卷 + 12 场深访' },
      { name: '行业研究', evidence: '4 篇消费赛道观察，1 篇被校内公号转载' },
      { name: '指标体系', evidence: '为二手平台搭 3 层指标' },
    ],
  },
  {
    name: '表达与协作',
    items: [
      { name: 'Power BI', evidence: '区域消费看板，60 人课程评审' },
      { name: 'Tableau', evidence: '课程可视化作业，评分 A' },
      { name: 'Git', evidence: '3 人团队分支协作流程' },
    ],
  },
]

const projects = [
  {
    title: '把 312 份问卷变成 3 条产品优先级',
    meta: '独立负责 · 2026.03 — 2026.05',
    background: '校园二手平台留存偏低，团队不确定该先改哪一环。',
    action: '设计问卷并完成 12 场深访，交叉分析 312 份样本，按影响面与实现成本排序需求。',
    result: '3 条优先级被采纳进入排期，其中首条已上线，次月留存回升。',
    tags: ['用户调研', '需求排序', '问卷设计'],
  },
  {
    title: '用公开数据做出区域消费差异看板',
    meta: '数据处理 · 2026.06',
    background: '课程作业要解释区域消费差异，而原始数据分散在三个来源。',
    action: '合并三份数据统一口径，用 Power BI 做联动看板，拆出人均消费与结构差异两条线。',
    result: '看板覆盖 31 个省份，被选为课程展示案例，评分 A。',
    tags: ['Power BI', '数据清洗', '可视化'],
  },
  {
    title: '一个下午上线，把简历做成可访问的网站',
    meta: '设计与开发 · 2026.10',
    background: '纸质简历承载不了作品细节，投递时容易被快速略过。',
    action: '用自然语言驱动开发完成单页站点，内容与代码分离，构建为静态站点直接托管。',
    result: '首屏 3 秒内可读完核心信息，手机端无横向滚动、无需缩放。',
    tags: ['Vibe Coding', '静态部署', '内容结构'],
  },
  {
    title: '客户任务管理系统 SupaProject',
    meta: '全栈开发 · 2026.10 · 演示账号 demo@test.cn / demo1234',
    background: '需要一个能真实落地的小型 CRM：客户、任务、跟进记录都要能增删改查。',
    action: 'React + TypeScript + Vite 构建前端，Supabase 提供数据库与登录鉴权，客户/任务/看板三视图联动。',
    result: '完整可用的任务管理系统——你现在看到的这个网站，就是由它驱动的。',
    tags: ['React', 'TypeScript', 'Supabase'],
    linkTo: '/',
    linkLabel: '打开在线系统',
  },
]

const contacts = [
  { label: '邮箱', value: 'leixinyi@stu.edu.cn', href: 'mailto:leixinyi@stu.edu.cn' },
  { label: '微信', value: 'leixinyi' },
  { label: 'GitHub', value: 'github.com/leixiny', href: 'https://github.com/leixiny' },
  { label: '简历', value: 'resume.pdf', href: 'resume.pdf', download: true },
]

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

const navSections = [
  { id: 'skills', label: '能力' },
  { id: 'work', label: '作品' },
  { id: 'contact', label: '联系' },
  { id: 'interact', label: '留言' },
]

export default function HomePage() {
  const [likes, setLikes] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)
  const [justLiked, setJustLiked] = useState(false)
  const [messages, setMessages] = useState<GuestbookRow[]>([])
  const [guestbookState, setGuestbookState] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setGuestbookState('offline')
      return
    }
    let channel: ReturnType<typeof supabase.channel> | undefined

    ;(async () => {
      try {
        // 访问计数：每个浏览器会话只 +1
        if (!sessionStorage.getItem('home_viewed')) {
          sessionStorage.setItem('home_viewed', '1')
          const inc = await supabase.rpc('increment_stat', { stat_key: 'views' })
          if (inc.error) throw inc.error
          if (typeof inc.data === 'number') setViews(inc.data)
        }
        const [likesRes, viewsRes] = await Promise.all([
          supabase.from('site_stats').select('value').eq('key', 'likes').maybeSingle(),
          supabase.from('site_stats').select('value').eq('key', 'views').maybeSingle(),
        ])
        if (likesRes.error) throw likesRes.error
        if (viewsRes.error) throw viewsRes.error
        if (typeof likesRes.data?.value === 'number') setLikes(likesRes.data.value)
        if (typeof viewsRes.data?.value === 'number') setViews(viewsRes.data.value)

        const gb = await supabase
          .from('guestbook')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (gb.error) throw gb.error
        setMessages(gb.data ?? [])
        setGuestbookState('ready')
      } catch (err) {
        console.error('互动功能初始化失败', err)
        setGuestbookState('error')
      }
    })()

    channel = supabase
      .channel('guestbook-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'guestbook' },
        (payload) => {
          const row = payload.new as GuestbookRow
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]))
        },
      )
      .subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  async function handleLike() {
    if (justLiked) return
    setJustLiked(true)
    try {
      const { data, error } = await supabase.rpc('increment_stat', { stat_key: 'likes' })
      if (error) throw error
      if (typeof data === 'number') setLikes(data)
    } catch (err) {
      console.error(err)
      setNotice('点赞失败，请稍后再试')
    }
    setTimeout(() => setJustLiked(false), 900)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) {
      setNotice('先写点内容再发布')
      return
    }
    setSubmitting(true)
    setNotice('')
    try {
      const { data, error } = await supabase
        .from('guestbook')
        .insert({ name: name.trim().slice(0, 24) || '访客', message: text.slice(0, 200) })
        .select()
        .single()
      if (error) throw error
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [data, ...prev]))
      setMessage('')
    } catch (err) {
      console.error(err)
      setNotice('发布失败：' + ((err as Error).message || '请稍后再试'))
    } finally {
      setSubmitting(false)
    }
  }

  const interactDisabled = guestbookState === 'offline' || guestbookState === 'error'

  return (
    <div className="home-page">
      <header className="home-nav">
        <span className="home-brand">雷馨怡</span>
        <nav className="home-links">
          {navSections.map((s) => (
            <button key={s.id} type="button" onClick={() => scrollToSection(s.id)}>
              {s.label}
            </button>
          ))}
        </nav>
        <Link className="btn-primary home-enter" to="/">
          进入管理系统
        </Link>
      </header>

      <section className="home-hero">
        <p className="home-eyebrow">数字经济 · 本科三年级</p>
        <h1>你好，我是雷馨怡</h1>
        <p className="home-tagline">用数据讲清商业问题，把分析做成能落地的决策。</p>
        <div className="home-hero-cta">
          <button type="button" className="btn-primary" onClick={() => scrollToSection('work')}>
            查看作品
          </button>
          <Link className="btn-secondary" to="/">
            进入管理系统
          </Link>
        </div>
        <div className="home-hero-stats">
          <span>
            <strong>{views ?? '—'}</strong> 次访问
          </span>
          <button type="button" className={`home-like ${justLiked ? 'liked' : ''}`} onClick={handleLike}>
            <i className="home-like-heart">{justLiked ? '♥' : '♡'}</i>
            <strong>{likes ?? '—'}</strong> 人点赞
          </button>
        </div>
      </section>

      <section id="skills" className="home-section">
        <p className="home-label">01 · 能力</p>
        <h2>从数据到决策的能力链条</h2>
        <div className="home-skill-grid">
          {skillGroups.map((group) => (
            <article key={group.name} className="card home-skill-card">
              <h3>{group.name}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.name}>
                    <strong>{item.name}</strong>
                    <span>{item.evidence}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="home-learning">最近在学：SQL 窗口函数、A/B 测试的实验设计</p>
      </section>

      <section id="work" className="home-section">
        <p className="home-label">02 · 作品</p>
        <h2>四个能说清结果的项目</h2>
        <div className="home-work-grid">
          {projects.map((p) => (
            <article key={p.title} className="card home-work-card">
              <h3>{p.title}</h3>
              <p className="home-work-meta">{p.meta}</p>
              <div className="home-work-line">
                <em>背景</em>
                <p>{p.background}</p>
              </div>
              <div className="home-work-line">
                <em>行动</em>
                <p>{p.action}</p>
              </div>
              <div className="home-work-result">
                <em>结果</em>
                <p>{p.result}</p>
              </div>
              <div className="home-work-tags">
                {p.tags.map((t) => (
                  <span key={t} className="badge badge-neutral">{t}</span>
                ))}
                {p.linkTo && (
                  <Link className="badge badge-purple home-work-link" to={p.linkTo}>
                    {p.linkLabel} ↗
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="home-section">
        <p className="home-label">03 · 联系</p>
        <h2>随时可以找我</h2>
        <div className="card home-contact-card">
          {contacts.map((c) => (
            <div key={c.label} className="home-contact-row">
              <span className="home-contact-label">{c.label}</span>
              {c.href ? (
                <a href={c.href} download={c.download}>{c.value}</a>
              ) : (
                <span>{c.value}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="interact" className="home-section">
        <p className="home-label">04 · 互动</p>
        <h2>这一页是活的：留言和点赞都会被记住</h2>
        {interactDisabled && (
          <div className="alert alert-info home-offline">
            {guestbookState === 'offline'
              ? '互动功能尚未接入 Supabase：配置 .env.local 后重启即可激活。'
              : '互动功能暂时不可用：请在 Supabase 执行 supabase/migrations/0002_site_interaction.sql 建表，并确认网络可以访问 Supabase。'}
          </div>
        )}
        <div className="home-interact-grid">
          <form className="card home-gb-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="home-gb-name">怎么称呼你？（可留空）</label>
              <input
                id="home-gb-name"
                className="input"
                value={name}
                maxLength={24}
                disabled={interactDisabled}
                onChange={(e) => setName(e.target.value)}
                placeholder="访客"
              />
            </div>
            <div className="field">
              <label htmlFor="home-gb-message">
                写点什么 <span className="home-gb-count">{message.length} / 200</span>
              </label>
              <textarea
                id="home-gb-message"
                className="input"
                value={message}
                maxLength={200}
                disabled={interactDisabled}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="留一句想对我说的话…"
              />
            </div>
            {notice && <div className="alert alert-error">{notice}</div>}
            <button type="submit" className="btn-primary" disabled={submitting || interactDisabled}>
              {submitting ? '发布中…' : '发布留言'}
            </button>
          </form>
          <div className="card home-gb-list">
            {guestbookState === 'loading' && <p className="muted">正在加载留言…</p>}
            {guestbookState === 'ready' && messages.length === 0 && (
              <p className="muted">还没有留言，来做第一个吧。</p>
            )}
            {messages.map((m) => (
              <article key={m.id} className="home-gb-item">
                <header>
                  <strong>{m.name || '访客'}</strong>
                  <time>{formatDate(m.created_at)}</time>
                </header>
                <p>{m.message}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="home-footer">
        © 2026 雷馨怡 · 数字经济专业 · 由 SupaProject 驱动
      </footer>
    </div>
  )
}
