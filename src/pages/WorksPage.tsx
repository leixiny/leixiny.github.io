import { useCallback, useEffect, useRef, useState } from 'react'
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
const MIN_SCALE = 1
const MAX_SCALE = 4

function formatDateCN(iso: string) {
  return iso.replaceAll('-', '.')
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export default function WorksPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [view, setView] = useState<'gallery' | 'timeline'>('gallery')
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const active = activeIdx == null ? null : projects[activeIdx]

  /* ---------- 数据加载 ---------- */
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

  /* ---------- 入场动画 ---------- */
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

  /* ---------- 画廊：横向轨道（鼠标拖拽 + 滚轮横滑） ---------- */
  const railRef = useRef<HTMLDivElement>(null)
  const railDrag = useRef({ down: false, startX: 0, startScroll: 0, moved: false, cardIdx: -1 })
  const suppressClickUntil = useRef(0)

  // 纵向滚轮转为横向滑动；轨道到头时放行给页面滚动
  useEffect(() => {
    const el = railRef.current
    if (!el || view !== 'gallery' || state !== 'ready') return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0
      if (atStart || atEnd) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view, state])

  const onRailPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 触屏用原生滚动，只有鼠标接管拖拽
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = railRef.current
    if (!el) return
    const card = (e.target as HTMLElement).closest<HTMLElement>('.wk-card')
    railDrag.current = {
      down: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      cardIdx: card ? Array.from(el.querySelectorAll('.wk-card')).indexOf(card) : -1,
    }
    el.setPointerCapture(e.pointerId)
    el.classList.add('is-dragging')
  }

  const onRailPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = railDrag.current
    if (!d.down) return
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 5) d.moved = true
    if (railRef.current) railRef.current.scrollLeft = d.startScroll - dx
  }

  const endRailDrag = () => {
    const d = railDrag.current
    if (!d.down) return
    d.down = false
    railRef.current?.classList.remove('is-dragging')
    if (d.moved) suppressClickUntil.current = Date.now()
  }

  // 拖拽期间 pointer capture 会把 click 的 target 重定向到轨道，
  // 所以优先用 pointerdown 时记下的卡片，再用 e.target 兜底（触屏场景）
  const onRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - suppressClickUntil.current < 120) return
    let idx = -1
    const viaTarget = (e.target as HTMLElement).closest?.('.wk-card')
    if (viaTarget && railRef.current) {
      idx = Array.from(railRef.current.querySelectorAll('.wk-card')).indexOf(viaTarget)
    }
    if (idx < 0) idx = railDrag.current.cardIdx
    if (idx >= 0) openProject(idx)
  }

  const openProject = (i: number) => {
    if (Date.now() - suppressClickUntil.current < 120) return
    setActiveIdx(i)
  }

  /* ---------- 查看器：缩放 + 平移 ---------- */
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const panRef = useRef({ down: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false })
  const suppressStageClick = useRef(0)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const applyZoom = useCallback((nextScale: number, nx: number, ny: number) => {
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    setZoom(() => {
      const el = imgRef.current
      if (!el) return { scale, x: 0, y: 0 }
      // 平移范围 = 图片放大后溢出容器的一半，保证不会拖出边界
      const maxX = (el.offsetWidth * (scale - 1)) / 2
      const maxY = (el.offsetHeight * (scale - 1)) / 2
      return { scale, x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) }
    })
  }, [])

  // 以指针位置为锚点缩放：缩放前后指针下的图像点保持不动
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = imgRef.current
      if (!el) return
      const z = zoomRef.current
      const next = clamp(z.scale * factor, MIN_SCALE, MAX_SCALE)
      if (next === z.scale) return
      const rect = el.getBoundingClientRect()
      const c0x = rect.left + rect.width / 2 - z.x
      const c0y = rect.top + rect.height / 2 - z.y
      const k = next / z.scale
      applyZoom(next, k * z.x + (1 - k) * (clientX - c0x), k * z.y + (1 - k) * (clientY - c0y))
    },
    [applyZoom],
  )

  useEffect(() => {
    setZoom({ scale: 1, x: 0, y: 0 })
    setShowInfo(false)
  }, [activeIdx])

  // 查看器滚轮缩放（原生监听才能 preventDefault）
  useEffect(() => {
    if (activeIdx == null) return
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [activeIdx, zoomAt])

  // 键盘：Esc 关闭、←→ 切换、+/− 缩放；打开时锁定页面滚动
  useEffect(() => {
    if (activeIdx == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIdx(null)
      else if (e.key === 'ArrowRight') setActiveIdx((i) => (i == null ? i : Math.min(projects.length - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setActiveIdx((i) => (i == null ? i : Math.max(0, i - 1)))
      else if (e.key === '+' || e.key === '=') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25)
      else if (e.key === '-') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.25)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [activeIdx, projects.length, zoomAt])

  const onStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoomRef.current.scale <= 1) return
    const p = panRef.current
    p.down = true
    p.moved = false
    p.sx = e.clientX
    p.sy = e.clientY
    p.ox = zoomRef.current.x
    p.oy = zoomRef.current.y
    setPanning(true)
    stageRef.current?.setPointerCapture(e.pointerId)
  }

  const onStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = panRef.current
    if (!p.down) return
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) p.moved = true
    applyZoom(zoomRef.current.scale, p.ox + dx, p.oy + dy)
  }

  const endStagePan = () => {
    const p = panRef.current
    if (p.down && p.moved) suppressStageClick.current = Date.now()
    p.down = false
    setPanning(false)
  }

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== stageRef.current) return
    if (Date.now() - suppressStageClick.current < 120) return
    setActiveIdx(null)
  }

  const prev = () => setActiveIdx((i) => (i == null ? i : Math.max(0, i - 1)))
  const next = () => setActiveIdx((i) => (i == null ? i : Math.min(projects.length - 1, i + 1)))

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
            每个项目都从一句“想把它做出来”开始。横向滑动浏览，点开可以放大看细节，
            也能翻到完整的孵化时间线——想法、踩过的坑，以及最后落在了哪里。
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
        <section className="wk-rail-wrap" aria-label="作品画廊">
          <div
            ref={railRef}
            className="wk-rail"
            onPointerDown={onRailPointerDown}
            onPointerMove={onRailPointerMove}
            onPointerUp={endRailDrag}
            onPointerCancel={endRailDrag}
            onClick={onRailClick}
          >
            {projects.map((p, i) => (
              <article
                key={p.id}
                className="wk-card"
                data-reveal
                tabIndex={0}
                role="button"
                aria-label={`放大查看 ${p.title}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openProject(i)
                  }
                }}
              >
                <div className="wk-cover">
                  <img src={`${baseUrl}${p.cover}`} alt={p.title} loading="lazy" draggable={false} />
                  <span className="wk-index">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <div className="wk-card-body">
                  <div className="wk-card-row">
                    <h3>{p.title}</h3>
                    <span className="wk-card-arrow" aria-hidden="true">↗</span>
                  </div>
                  <p className="wk-meta">
                    {p.role} · {p.period}
                  </p>
                  <p className="wk-summary">{p.summary}</p>
                  <div className="wk-tags">
                    {p.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <p className="wk-wrap wk-rail-hint" aria-hidden="true">
            <span>←</span> 按住拖动 · 滚轮横滑 · 点击放大 <span>→</span>
          </p>
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
                  {p.url && p.url !== '#/' && (
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

      {active && activeIdx != null && (
        <div className={`wk-viewer ${showInfo ? 'has-detail' : ''}`} role="dialog" aria-modal="true" aria-label={active.title}>
          <div className="wk-viewer-top">
            <span className="wk-viewer-count">
              {String(activeIdx + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
            </span>
            <div className="wk-viewer-tools">
              <button type="button" onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.3)} aria-label="缩小">
                −
              </button>
              <span className="wk-viewer-pct">{Math.round(zoom.scale * 100)}%</span>
              <button type="button" onClick={() => zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.3)} aria-label="放大">
                ＋
              </button>
              <button type="button" onClick={() => applyZoom(1, 0, 0)} aria-label="重置缩放">
                1:1
              </button>
              <button type="button" className="wk-viewer-close" onClick={() => setActiveIdx(null)} aria-label="关闭">
                ×
              </button>
            </div>
          </div>

          <div
            ref={stageRef}
            className={`wk-viewer-stage ${zoom.scale > 1 ? 'is-zoomed' : ''} ${panning ? 'is-panning' : ''}`}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={endStagePan}
            onPointerCancel={endStagePan}
            onClick={onStageClick}
            onDoubleClick={(e) => {
              if (zoomRef.current.scale > 1) applyZoom(1, 0, 0)
              else zoomAt(e.clientX, e.clientY, 2.4)
            }}
          >
            <img
              ref={imgRef}
              className="wk-viewer-img"
              src={`${baseUrl}${active.cover}`}
              alt={active.title}
              draggable={false}
              style={{
                transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                transition: panning ? 'none' : undefined,
              }}
            />
            {activeIdx > 0 && (
              <button
                type="button"
                className="wk-viewer-arrow is-prev"
                aria-label="上一个项目"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={prev}
              >
                ←
              </button>
            )}
            {activeIdx < projects.length - 1 && (
              <button
                type="button"
                className="wk-viewer-arrow is-next"
                aria-label="下一个项目"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={next}
              >
                →
              </button>
            )}
          </div>

          {showInfo && (
            <div className="wk-viewer-detail">
              <p className="wk-viewer-summary">{active.summary}</p>
              <div className="wk-viewer-result">
                <em>结果</em>
                <p>{active.result}</p>
              </div>
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
            </div>
          )}

          <div className="wk-viewer-bar">
            <div className="wk-viewer-info">
              <p className="wk-viewer-meta">
                {active.role} · {active.period} · {formatDateCN(active.uploadedAt)} 上传
              </p>
              <h3>{active.title}</h3>
              <div className="wk-viewer-tags">
                {active.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
            <div className="wk-viewer-actions">
              <button type="button" className="wk-viewer-info-btn" onClick={() => setShowInfo((v) => !v)}>
                {showInfo ? '收起详情' : '孵化详情'}
                <i aria-hidden="true">{showInfo ? '▾' : '▸'}</i>
              </button>
              {active.url && active.url !== '#/' && (
                <a className="wk-open" href={active.url} target="_blank" rel="noopener noreferrer">
                  打开作品 ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
