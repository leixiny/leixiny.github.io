import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './WorksPage.css'

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

const baseUrl = import.meta.env.BASE_URL

function formatDateCN(iso: string) {
  return iso.replaceAll('-', '.')
}

export default function WorksPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [view, setView] = useState<'gallery' | 'timeline'>('gallery')
  const [active, setActive] = useState<Project | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${baseUrl}projects.json`)
      .then((r) => {
        if (!r.ok) throw new Error('projects.json ' + r.status)
        return r.json()
      })
      .then((data: { projects: Project[] }) => {
        if (cancelled) return
        setProjects([...data.projects].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)))
        setState('ready')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'))
    if (!els.length) return
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [state, view])

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

  return (
    <div className="works-page">
      <header className="wk-nav">
        <Link className="wk-back" to="/home">
          <i aria-hidden="true">←</i> 主页
        </Link>
        <span className="wk-nav-title">作品集</span>
        <Link className="wk-nav-enter" to="/">
          进入管理系统 <i aria-hidden="true">→</i>
        </Link>
      </header>

      <section className="wk-head">
        <div className="wk-glow" aria-hidden="true" />
        <div className="wk-wrap">
          <p className="wk-kicker">
            <span className="wk-kicker-line" />
            {state === 'ready' ? `${projects.length} 个项目 · 2026` : '加载中'}
          </p>
          <h1>项目与它们的孵化过程</h1>
          <p className="wk-intro">
            每个项目都从一句“想把它做出来”开始。点开可以看到完整的时间线——
            想法、踩过的坑，以及最后落在了哪里。
          </p>

          <div className="wk-switch" role="tablist" aria-label="作品视图切换">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'gallery'}
              className={view === 'gallery' ? 'is-active' : ''}
              onClick={() => setView('gallery')}
            >
              画廊
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'timeline'}
              className={view === 'timeline' ? 'is-active' : ''}
              onClick={() => setView('timeline')}
            >
              孵化时间线
            </button>
          </div>
        </div>
      </section>

      {state === 'error' && (
        <div className="wk-wrap">
          <p className="wk-error">作品数据加载失败：projects.json 缺失或无法访问。</p>
        </div>
      )}

      {state === 'ready' && view === 'gallery' && (
        <section className="wk-grid-wrap">
          <div className="wk-wrap wk-grid">
            {projects.map((p, i) => (
              <article
                key={p.id}
                className="wk-card"
                data-reveal
                tabIndex={0}
                role="button"
                onClick={() => setActive(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActive(p)
                  }
                }}
              >
                <div className="wk-cover">
                  <img src={`${baseUrl}${p.cover}`} alt={p.title} loading="lazy" />
                  <span className="wk-index">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="wk-body">
                  <p className="wk-meta">
                    {p.role} · {p.period}
                  </p>
                  <h3>{p.title}</h3>
                  <p className="wk-summary">{p.summary}</p>
                </div>
                <div className="wk-foot">
                  <div className="wk-tags">
                    {p.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="wk-foot-right">
                    <time dateTime={p.uploadedAt}>{formatDateCN(p.uploadedAt)}</time>
                    {p.url && (
                      <a
                        className="wk-open"
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        打开 ↗
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {state === 'ready' && view === 'timeline' && (
        <section className="wk-timeline-wrap">
          <div className="wk-wrap wk-timeline">
            {projects.map((p, i) => (
              <article key={p.id} className="wk-tl" data-reveal>
                <header className="wk-tl-head">
                  <span className="wk-tl-index">{String(i + 1).padStart(2, '0')}</span>
                  <img className="wk-tl-thumb" src={`${baseUrl}${p.cover}`} alt="" loading="lazy" />
                  <div className="wk-tl-title">
                    <h3>{p.title}</h3>
                    <p className="wk-meta">
                      {p.role} · {p.period} · {formatDateCN(p.uploadedAt)} 上传
                    </p>
                  </div>
                  {p.url && (
                    <a className="wk-open" href={p.url} target="_blank" rel="noopener noreferrer">
                      打开作品 ↗
                    </a>
                  )}
                </header>
                <ol className="wk-nodes">
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
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="wk-footer">
        <div className="wk-wrap wk-footer-row">
          <Link to="/home">← 回到主页</Link>
          <span>© 2026 雷馨怡</span>
        </div>
      </footer>

      {active && (
        <div className="wk-modal-mask" onClick={() => setActive(null)}>
          <article className="wk-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="wk-modal-close" aria-label="关闭" onClick={() => setActive(null)}>
              ×
            </button>
            <img className="wk-modal-cover" src={`${baseUrl}${active.cover}`} alt={active.title} />
            <div className="wk-modal-body">
              <p className="wk-meta">
                {active.role} · {active.period} · {formatDateCN(active.uploadedAt)} 上传
              </p>
              <h3>{active.title}</h3>
              <p className="wk-modal-summary">{active.summary}</p>
              <div className="wk-tags">
                {active.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
                {active.url && (
                  <a className="wk-open" href={active.url} target="_blank" rel="noopener noreferrer">
                    直接打开作品 ↗
                  </a>
                )}
              </div>

              <h4>孵化过程</h4>
              <ol className="wk-nodes">
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

              <div className="wk-result">
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
