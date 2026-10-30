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

interface Milestone {
  date: string
  title: string
  desc?: string
}

interface Project {
  id: string
  title: string
  cover: string
  uploadedAt: string
  period: string
  role: string
  summary: string
  result: string
  tags: string[]
  url?: string
  milestones: Milestone[]
}

const skillTags = ['SQL', 'Python / pandas', 'Excel 建模', 'Power BI', 'Tableau', '用户调研', '指标体系', 'Git']

const contacts = [
  { label: '邮箱', value: 'leixinyi@stu.edu.cn', href: 'mailto:leixinyi@stu.edu.cn' },
  { label: '微信', value: 'leixinyi' },
  { label: 'GitHub', value: 'github.com/leixiny', href: 'https://github.com/leixiny' },
  { label: '简历', value: 'resume.pdf', href: 'resume.pdf', download: true },
]

function formatDateCN(iso: string) {
  return iso.replaceAll('-', '.')
}

function formatDateTime(ts: string) {
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
  { id: 'portfolio', label: '作品集' },
  { id: 'contact', label: '联系' },
  { id: 'interact', label: '留言' },
]

const baseUrl = import.meta.env.BASE_URL

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsState, setProjectsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [view, setView] = useState<'gallery' | 'timeline'>('gallery')
  const [active, setActive] = useState<Project | null>(null)

  const [likes, setLikes] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)
  const [justLiked, setJustLiked] = useState(false)
  const [messages, setMessages] = useState<GuestbookRow[]>([])
  const [guestbookState, setGuestbookState] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  // 作品数据：public/projects.json，内容与代码分离
  useEffect(() => {
    let cancelled = false
    fetch(`${baseUrl}projects.json`)
      .then((r) => {
        if (!r.ok) throw new Error('projects.json ' + r.status)
        return r.json()
      })
      .then((data: { projects: Project[] }) => {
        if (cancelled) return
        const sorted = [...data.projects].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
        setProjects(sorted)
        setProjectsState('ready')
      })
      .catch(() => !cancelled && setProjectsState('error'))
    return () => { cancelled = true }
  }, [])

  // 详情弹层：Esc 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [active])

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
        <p className="home-eyebrow">数字经济 · 本科三年级 · 作品集</p>
        <h1>你好，我是雷馨怡</h1>
        <p className="home-tagline">用数据讲清商业问题，把分析做成能落地的决策。这里收录我做过的项目，以及它们从想法到上线的孵化过程。</p>
        <div className="home-skill-tags">
          {skillTags.map((t) => (
            <span key={t} className="badge badge-neutral">{t}</span>
          ))}
        </div>
        <div className="home-hero-cta">
          <button type="button" className="btn-primary" onClick={() => scrollToSection('portfolio')}>
            浏览作品集
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

      <section id="portfolio" className="home-section">
        <div className="home-portfolio-head">
          <div>
            <p className="home-label">01 · 作品集</p>
            <h2>项目与它们的孵化过程</h2>
          </div>
          <div className="home-view-switch" role="tablist" aria-label="作品视图切换">
            <button
              type="button"
              className={view === 'gallery' ? 'active' : ''}
              onClick={() => setView('gallery')}
            >
              画廊
            </button>
            <button
              type="button"
              className={view === 'timeline' ? 'active' : ''}
              onClick={() => setView('timeline')}
            >
              孵化时间线
            </button>
          </div>
        </div>

        {projectsState === 'loading' && <p className="muted">正在加载作品…</p>}
        {projectsState === 'error' && (
          <div className="alert alert-error">作品数据加载失败：projects.json 缺失或无法访问。</div>
        )}

        {projectsState === 'ready' && view === 'gallery' && (
          <div className="home-gallery">
            {projects.map((p) => (
              <article key={p.id} className="card home-gallery-card" onClick={() => setActive(p)}>
                <div className="home-cover">
                  <img src={`${baseUrl}${p.cover}`} alt={p.title} loading="lazy" />
                  <span className="home-cover-date" title="上传时间">
                    <i>⇪</i> {formatDateCN(p.uploadedAt)} 上传
                  </span>
                </div>
                <div className="home-gallery-body">
                  <p className="home-work-meta">{p.role} · {p.period}</p>
                  <h3>{p.title}</h3>
                  <p className="home-gallery-summary">{p.summary}</p>
                  <div className="home-work-tags">
                    {p.tags.map((t) => (
                      <span key={t} className="badge badge-neutral">{t}</span>
                    ))}
                  </div>
                  <div className="home-gallery-actions">
                    <span className="home-gallery-more">查看孵化过程 →</span>
                    {p.url && (
                      <a
                        className="home-open-btn"
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        打开作品 ↗
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {projectsState === 'ready' && view === 'timeline' && (
          <div className="home-timeline">
            {projects.map((p) => (
              <section key={p.id} className="home-tl-project">
                <header className="home-tl-head">
                  <img className="home-tl-thumb" src={`${baseUrl}${p.cover}`} alt="" loading="lazy" />
                  <div>
                    <h3>{p.title}</h3>
                    <p className="home-work-meta">
                      {p.role} · {p.period} ·{' '}
                      <span className="home-tl-uploaded">{formatDateCN(p.uploadedAt)} 上传</span>
                    </p>
                  </div>
                  {p.url && (
                    <a className="badge badge-purple home-tl-link" href={p.url} target="_blank" rel="noopener noreferrer">
                      打开作品 ↗
                    </a>
                  )}
                </header>
                <ol className="home-tl-nodes">
                  {p.milestones.map((m) => (
                    <li key={m.date + m.title}>
                      <time>{formatDateCN(m.date)}</time>
                      <div>
                        <strong>{m.title}</strong>
                        {m.desc && <p>{m.desc}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </section>

      <section id="contact" className="home-section">
        <p className="home-label">02 · 联系</p>
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
        <p className="home-label">03 · 互动</p>
        <h2>这一页是活的：留言和点赞都会被记住</h2>
        {interactDisabled && (
          <div className="alert alert-info home-offline">
            {guestbookState === 'offline'
              ? '互动功能尚未接入 Supabase：配置 .env.local 后重启即可激活。'
              : '互动功能暂时不可用：请确认网络可以访问 Supabase。'}
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
                  <time>{formatDateTime(m.created_at)}</time>
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

      {active && (
        <div className="home-modal-mask" onClick={() => setActive(null)}>
          <article className="card home-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="home-modal-close" aria-label="关闭" onClick={() => setActive(null)}>
              ×
            </button>
            <img className="home-modal-cover" src={`${baseUrl}${active.cover}`} alt={active.title} />
            <div className="home-modal-body">
              <p className="home-work-meta">
                {active.role} · {active.period} ·{' '}
                <span className="home-tl-uploaded">{formatDateCN(active.uploadedAt)} 上传</span>
              </p>
              <h3>{active.title}</h3>
              <p className="home-modal-summary">{active.summary}</p>
              <div className="home-work-tags">
                {active.tags.map((t) => (
                  <span key={t} className="badge badge-neutral">{t}</span>
                ))}
                {active.url && (
                  <a className="badge badge-purple" href={active.url} target="_blank" rel="noopener noreferrer" onClick={() => setActive(null)}>
                    直接打开作品 ↗
                  </a>
                )}
              </div>

              <h4>孵化过程</h4>
              <ol className="home-tl-nodes home-tl-nodes--modal">
                {active.milestones.map((m) => (
                  <li key={m.date + m.title}>
                    <time>{formatDateCN(m.date)}</time>
                    <div>
                      <strong>{m.title}</strong>
                      {m.desc && <p>{m.desc}</p>}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="home-work-result">
                <em>结果</em>
                <p>{active.result}</p>
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  )
}
