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
  const drag = useRef({
    down: false,
    mode: 'flip' as 'flip' | 'pan',
    startX: 0,
    startY: 0,
    lastX: 0,
    startScroll: 0,
    moved: false,
    slide: -1,
    ox: 0,
    oy: 0,
  })
  const suppressClick = useRef(0)
  const glideTimer = useRef(0)

  // 翻页动画期间先关掉 scroll-snap，否则松手瞬间会被吸回原处
  const holdSnap = useCallback((ms = 560) => {
    const el = trackRef.current
    if (!el) return
    window.clearTimeout(glideTimer.current)
    el.classList.add('is-glide')
    glideTimer.current = window.setTimeout(() => el.classList.remove('is-glide'), ms)
  }, [])

  // 相邻两张中心之间的距离（卡片宽 + 间距）
  const stepOf = useCallback(() => {
    const el = trackRef.current
    if (!el) return 1
    const slides = el.querySelectorAll<HTMLElement>('.wk-slide')
    if (slides.length > 1) return slides[1].offsetLeft - slides[0].offsetLeft
    return slides[0]?.offsetWidth || el.clientWidth
  }, [])

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current
      if (!el) return
      const target = clamp(i, 0, total - 1)
      el.scrollTo({ left: target * stepOf(), behavior: 'smooth' })
      setIdx(target)
    },
    [total, stepOf],
  )

  const onTrackScroll = () => {
    const el = trackRef.current
    if (!el) return
    const i = clamp(Math.round(el.scrollLeft / Math.max(1, stepOf())), 0, total - 1)
    if (i !== idxRef.current) setIdx(i)
    schedulePaint()
  }

  /* ---------- 连续滑动：按「离屏幕中心的距离」给每张做虚化 ---------- */
  const blurRaf = useRef(0)
  const paintSlides = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const dragging = el.classList.contains('is-drag')
    const vw = window.innerWidth
    const step = Math.max(1, stepOf())
    // 拖动中虚化更重，停下后收敛一点，保留一点层次
    const maxBlur = dragging ? 13 : 9
    el.querySelectorAll<HTMLElement>('.wk-slide').forEach((s) => {
      const r = s.getBoundingClientRect()
      const d = Math.min(1, Math.abs(r.left + r.width / 2 - vw / 2) / step)
      const e = Math.pow(d, 1.35)
      s.style.setProperty('--wk-blur', `${(e * maxBlur).toFixed(2)}px`)
      s.style.setProperty('--wk-dim', `${(e * 0.3).toFixed(3)}`)
      s.style.setProperty('--wk-scale', `${(1 - e * 0.05).toFixed(4)}`)
    })
  }, [stepOf])

  const schedulePaint = useCallback(() => {
    if (blurRaf.current) return
    blurRaf.current = requestAnimationFrame(() => {
      blurRaf.current = 0
      paintSlides()
    })
  }, [paintSlides])

  useEffect(() => {
    if (state !== 'ready') return
    paintSlides()
    window.addEventListener('resize', schedulePaint)
    return () => window.removeEventListener('resize', schedulePaint)
  }, [state, paintSlides, schedulePaint])

  /* ---------- 页内预览缩放：滚轮即缩放，放大后拖动看局部 ---------- */
  const slideImgRef = useRef<HTMLImageElement>(null)
  const [pzoom, setPzoom] = useState({ scale: 1, x: 0, y: 0 })
  const pzoomRef = useRef(pzoom)
  pzoomRef.current = pzoom

  const applyPzoom = useCallback((scale: number, x: number, y: number) => {
    const s = clamp(scale, MIN_SCALE, MAX_SCALE)
    const el = slideImgRef.current
    if (!el) {
      setPzoom({ scale: s, x: 0, y: 0 })
      return
    }
    const maxX = (el.offsetWidth * (s - 1)) / 2
    const maxY = (el.offsetHeight * (s - 1)) / 2
    setPzoom({ scale: s, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) })
  }, [])

  // 以指针为锚点缩放：指针底下的那一点始终不动
  const pzoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const el = slideImgRef.current
      if (!el) return
      const z = pzoomRef.current
      const next = clamp(z.scale * factor, MIN_SCALE, MAX_SCALE)
      if (Math.abs(next - z.scale) < 0.001) return
      const rect = el.getBoundingClientRect()
      const c0x = rect.left + rect.width / 2 - z.x
      const c0y = rect.top + rect.height / 2 - z.y
      const k = next / z.scale
      applyPzoom(next, k * z.x + (1 - k) * (clientX - c0x), k * z.y + (1 - k) * (clientY - c0y))
    },
    [applyPzoom],
  )

  const resetPzoom = useCallback(() => setPzoom({ scale: 1, x: 0, y: 0 }), [])

  // 滚轮 / 触控板：横向滑＝翻页，纵向滚＝缩放当前作品
  useEffect(() => {
    if (state !== 'ready' || activeIdx != null) return
    const el = trackRef.current
    if (!el) return
    let snapTimer = 0
    const settle = () => {
      window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(() => {
        goTo(Math.round(el.scrollLeft / Math.max(1, stepOf())))
        holdSnap()
      }, 130)
    }
    const onWheel = (e: WheelEvent) => {
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1
      const dx = e.deltaX * unit
      const dy = e.deltaY * unit
      // 横向滚动更明显时，让长条跟着滑，停下再吸附
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > 1) {
        e.preventDefault()
        el.classList.add('is-glide')
        el.scrollLeft += dx
        schedulePaint()
        settle()
        return
      }
      e.preventDefault()
      if (Math.abs(dy) < 0.5) return
      // 指数映射：滚轮一格与触控板一次滑动的手感接近
      pzoomAt(e.clientX, e.clientY, clamp(Math.exp(-dy * 0.0018), 0.75, 1.3))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      window.clearTimeout(snapTimer)
      el.removeEventListener('wheel', onWheel)
    }
  }, [state, activeIdx, pzoomAt, goTo, stepOf, schedulePaint, holdSnap])

  // 换作品时回到原始比例
  useEffect(() => {
    resetPzoom()
  }, [idx, resetPzoom])

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    if (!el) return
    const slide = (e.target as HTMLElement).closest<HTMLElement>('.wk-slide')
    const z = pzoomRef.current
    drag.current = {
      down: true,
      // 放大状态：拖动是平移看图；未放大：拖动是翻页
      mode: z.scale > 1 ? 'pan' : 'flip',
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      startScroll: el.scrollLeft,
      moved: false,
      slide: slide ? Array.from(el.querySelectorAll('.wk-slide')).indexOf(slide) : -1,
      ox: z.x,
      oy: z.y,
    }
    el.setPointerCapture(e.pointerId)
    el.classList.add('is-drag')
    schedulePaint()
  }

  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.down) return
    d.lastX = e.clientX
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) d.moved = true
    if (d.mode === 'pan') {
      applyPzoom(pzoomRef.current.scale, d.ox + dx, d.oy + dy)
      return
    }
    if (trackRef.current) trackRef.current.scrollLeft = d.startScroll - dx
  }

  const endDrag = () => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    const el = trackRef.current
    if (!el) return
    // 先读位置：一旦恢复 scroll-snap 重新布局，浏览器会立刻把长条吸回原处
    const landed = el.scrollLeft
    el.classList.remove('is-drag')
    if (d.mode === 'pan') {
      if (d.moved) suppressClick.current = Date.now()
      return
    }
    // 连续长条：轻轻一推就翻页——位移超过 14% 按方向翻一张，推得远就多翻几张
    const stepLen = Math.max(1, stepOf())
    const from = Math.round(d.startScroll / stepLen)
    const ratio = (landed - d.startScroll) / stepLen
    const pages = Math.round(ratio) || (Math.abs(ratio) > 0.14 ? Math.sign(ratio) : 0)
    if (pages !== 0) holdSnap()
    goTo(from + pages)
    if (d.moved) suppressClick.current = Date.now()
    schedulePaint()
  }

  // pointer capture 会把 click 重定向到轨道，用按下时记的卡片兜底
  const onTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (Date.now() - suppressClick.current < 150) return
    // 放大状态下点击不跳转，避免看着细节时突然被踢进全屏预览
    if (pzoomRef.current.scale > 1) return
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
      } else if (e.key === '0') {
        resetPzoom()
      } else if (e.key === 'Enter') {
        setActiveIdx(idxRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, activeIdx, goTo, resetPzoom])

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
            className={`wk-track ${pzoom.scale > 1 ? 'is-zoomed' : ''}`}
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
                  ref={i === idx ? slideImgRef : undefined}
                  className="wk-slide-img"
                  src={`${baseUrl}${p.cover}`}
                  alt={p.title}
                  draggable={false}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  style={
                    i === idx
                      ? { transform: `translate3d(${pzoom.x}px, ${pzoom.y}px, 0) scale(${pzoom.scale})` }
                      : undefined
                  }
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

          <div className="wk-edges" aria-hidden="true" />

          {pzoom.scale > 1.005 && (
            <button
              type="button"
              className="wk-zoom-pill"
              onClick={resetPzoom}
              aria-label="还原为原始大小"
              title="还原为原始大小"
            >
              {Math.round(pzoom.scale * 100)}%
            </button>
          )}

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
