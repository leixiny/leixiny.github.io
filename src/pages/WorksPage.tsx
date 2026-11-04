import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './WorksPage.css'

interface Project {
  id: string
  title: string
  cover: string
  summary: string
  uploadedAt: string
}

const baseUrl = import.meta.env.BASE_URL
const MIN_SCALE = 1
const MAX_SCALE = 4

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export default function WorksPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [idx, setIdx] = useState(0)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const total = projects.length
  const active = activeIdx == null ? null : projects[activeIdx]

  /* ---------- 数据 ---------- */
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

  /* ---------- 整页不滚动，滑动交给作品轨道 ---------- */
  useEffect(() => {
    const prev = document.body.style.overflow
    window.scrollTo(0, 0)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /* ---------- 轨道：一屏一个作品 ---------- */
  const trackRef = useRef<HTMLDivElement>(null)
  const idxRef = useRef(0)
  idxRef.current = idx
  const drag = useRef({ down: false, startX: 0, lastX: 0, startScroll: 0, moved: false, slide: -1 })
  const wheelLock = useRef(0)
  const suppressClick = useRef(0)

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current
      if (!el) return
      const target = clamp(i, 0, total - 1)
      el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' })
      setIdx(target)
    },
    [total],
  )

  const onTrackScroll = () => {
    const el = trackRef.current
    if (!el) return
    const i = clamp(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)), 0, total - 1)
    if (i !== idxRef.current) setIdx(i)
  }

  // 滚轮 / 触控板：整屏翻页
  useEffect(() => {
    if (state !== 'ready' || activeIdx != null) return
    const el = trackRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      if (Math.abs(d) < 2) return
      e.preventDefault()
      if (Date.now() < wheelLock.current) return
      wheelLock.current = Date.now() + 560
      goTo(idxRef.current + (d > 0 ? 1 : -1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [state, activeIdx, goTo])

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    if (!el) return
    const slide = (e.target as HTMLElement).closest<HTMLElement>('.wk-slide')
    drag.current = {
      down: true,
      startX: e.clientX,
      lastX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      slide: slide ? Array.from(el.querySelectorAll('.wk-slide')).indexOf(slide) : -1,
    }
    el.setPointerCapture(e.pointerId)
    el.classList.add('is-drag')
  }

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.down) return
    d.lastX = e.clientX
    const dx = e.clientX - d.startX
    if (Math.abs(dx) > 5) d.moved = true
    if (trackRef.current) trackRef.current.scrollLeft = d.startScroll - dx
  }

  const endDrag = () => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    const el = trackRef.current
    el?.classList.remove('is-drag')
    if (!el) return
    const w = Math.max(1, el.clientWidth)
    const dx = d.lastX - d.startX
    // 拖动超过 12% 就翻到相邻一张，否则回弹
    const target =
      Math.abs(dx) > w * 0.12
        ? Math.round(d.startScroll / w) + (dx < 0 ? 1 : -1)
        : Math.round(el.scrollLeft / w)
    goTo(target)
    if (d.moved) suppressClick.current = Date.now()
  }

  // pointer capture 会把 click 重定向到轨道，用按下时记的卡片兜底
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - suppressClick.current < 150) return
    const el = trackRef.current
    if (!el) return
    const slide = (e.target as HTMLElement).closest?.('.wk-slide')
    const i = slide ? Array.from(el.querySelectorAll('.wk-slide')).indexOf(slide) : drag.current.slide
    if (i >= 0) setActiveIdx(i)
  }

  useEffect(() => {
    if (state !== 'ready' || activeIdx != null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(idxRef.current + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(idxRef.current - 1)
      } else if (e.key === 'Enter') {
        setActiveIdx(idxRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, activeIdx, goTo])

  /* ---------- 全屏预览：缩放 + 平移 ---------- */
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 })
  const [panning, setPanning] = useState(false)
  const panRef = useRef({ down: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false })
  const suppressStageClick = useRef(0)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const applyZoom = useCallback((nextScale: number, nx: number, ny: number) => {
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
    setZoom(() => {
      const el = imgRef.current
      if (!el) return { scale, x: 0, y: 0 }
      const maxX = (el.offsetWidth * (scale - 1)) / 2
      const maxY = (el.offsetHeight * (scale - 1)) / 2
      return { scale, x: clamp(nx, -maxX, maxX), y: clamp(ny, -maxY, maxY) }
    })
  }, [])

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
  }, [activeIdx])

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

  useEffect(() => {
    if (activeIdx == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveIdx(null)
      else if (e.key === 'ArrowRight') setActiveIdx((i) => (i == null ? i : Math.min(total - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setActiveIdx((i) => (i == null ? i : Math.max(0, i - 1)))
      else if (e.key === '+' || e.key === '=') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25)
      else if (e.key === '-') zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.25)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeIdx, total, zoomAt])

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
    if (Date.now() - suppressStageClick.current < 130) return
    setActiveIdx(null)
  }

  const step = (delta: number) =>
    setActiveIdx((i) => (i == null ? i : clamp(i + delta, 0, total - 1)))

  return (
    <div className="works-page">
      {state !== 'ready' && (
        <div className="wk-boot">
          {state === 'error' ? <p>作品数据加载失败</p> : <span className="wk-boot-line" />}
        </div>
      )}

      {state === 'ready' && (
        <>
          <div
            ref={trackRef}
            className="wk-track"
            onScroll={onTrackScroll}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={onTrackClick}
          >
            {projects.map((p, i) => (
              <section
                key={p.id}
                className={`wk-slide ${i === idx ? 'is-active' : ''}`}
                aria-label={p.title}
              >
                <div
                  className="wk-slide-bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${baseUrl}${p.cover})` }}
                />
                <img
                  className="wk-slide-img"
                  src={`${baseUrl}${p.cover}`}
                  alt={p.title}
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
                <div className="wk-slide-veil" aria-hidden="true" />
                <div className="wk-slide-text">
                  <h1>{p.title}</h1>
                  <p>{p.summary}</p>
                </div>
              </section>
            ))}
          </div>

          <div className="wk-chrome">
            <Link className="wk-icon" to="/home" aria-label="返回主页">
              ←
            </Link>
            <button
              type="button"
              className="wk-icon"
              onClick={() => setActiveIdx(idx)}
              aria-label="全屏预览"
            >
              ⤢
            </button>
          </div>

          <div className="wk-dots" role="tablist" aria-label="切换作品">
            {projects.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={p.title}
                className={i === idx ? 'is-on' : ''}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}

      {active && (
        <div className="wk-view" role="dialog" aria-modal="true" aria-label={active.title}>
          <div
            ref={stageRef}
            className={`wk-view-stage ${zoom.scale > 1 ? 'is-zoomed' : ''} ${panning ? 'is-panning' : ''}`}
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
              className="wk-view-img"
              src={`${baseUrl}${active.cover}`}
              alt={active.title}
              draggable={false}
              style={{
                transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                transition: panning ? 'none' : undefined,
              }}
            />
          </div>

          <button type="button" className="wk-view-close" onClick={() => setActiveIdx(null)} aria-label="关闭">
            ×
          </button>

          {activeIdx != null && activeIdx > 0 && (
            <button
              type="button"
              className="wk-view-arrow is-prev"
              aria-label="上一件作品"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => step(-1)}
            >
              ←
            </button>
          )}
          {activeIdx != null && activeIdx < total - 1 && (
            <button
              type="button"
              className="wk-view-arrow is-next"
              aria-label="下一件作品"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => step(1)}
            >
              →
            </button>
          )}

          {zoom.scale > 1.02 && (
            <span className="wk-view-pct" aria-hidden="true">
              {Math.round(zoom.scale * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
