import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './WorksStrip.css'

interface Project {
  id: string
  title: string
  cover: string
  summary: string
  uploadedAt: string
}

const baseUrl = import.meta.env.BASE_URL

// 卡片宽度的两头：最小是一列能并四五张，最大是整幅铺满
const MIN_W = 280
const MAX_W = 920
const SIZE_KEY = 'hp:works:size'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** 只取能整除作品数的列数：4 件作品就只走 1 / 2 / 4 列，不留一个孤零零的尾巴 */
function columnsFor(count: number, raw: number) {
  const fit = Math.max(1, Math.floor(raw))
  if (count <= 1) return 1
  const divis = Array.from({ length: count }, (_, i) => i + 1).filter((d) => count % d === 0 && d <= fit)
  return divis.length ? divis[divis.length - 1] : 1
}

const yearOf = (ts: string) => (ts || '').slice(0, 4)

export default function WorksStrip() {
  const [projects, setProjects] = useState<Project[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [size, setSize] = useState(() => {
    const saved = Number(window.localStorage.getItem(SIZE_KEY))
    return Number.isFinite(saved) && saved >= MIN_W ? clamp(saved, MIN_W, MAX_W) : 620
  })
  const [cols, setCols] = useState(1)
  const [open, setOpen] = useState<number | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)

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

  /* ---------- 尺寸：一列能排几张，按容器宽度和想要的卡片宽算 ---------- */
  useEffect(() => {
    const el = gridRef.current
    if (!el || state !== 'ready') return
    const measure = () => {
      const w = el.clientWidth
      const gap = w < 640 ? 14 : 26
      el.style.setProperty('--hpw-gap', `${gap}px`)
      setCols(columnsFor(projects.length, (w + gap) / (size + gap)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [size, projects.length, state])

  useEffect(() => {
    window.localStorage.setItem(SIZE_KEY, String(size))
  }, [size])

  /* ---------- 进场淡入（作品是异步来的，得等它有内容再挂观察） ---------- */
  useEffect(() => {
    if (state !== 'ready') return
    const els = Array.from(document.querySelectorAll<HTMLElement>('.hp-works [data-reveal]:not(.is-in)'))
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
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [state, cols])

  /* ---------- 全屏看清一张：滚轮缩放、放大后拖动 ---------- */
  const imgRef = useRef<HTMLImageElement>(null)
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const pan = useRef({ down: false, sx: 0, sy: 0, ox: 0, oy: 0 })
  const [panning, setPanning] = useState(false)

  const applyZoom = useCallback((s: number, x: number, y: number) => {
    const el = imgRef.current
    const scale = clamp(s, 1, 4)
    if (!el) {
      setZoom({ s: scale, x: 0, y: 0 })
      return
    }
    const maxX = (el.offsetWidth * (scale - 1)) / 2
    const maxY = (el.offsetHeight * (scale - 1)) / 2
    setZoom({ s: scale, x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) })
  }, [])

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const el = imgRef.current
      if (!el) return
      const z = zoomRef.current
      const next = clamp(z.s * factor, 1, 4)
      if (next === z.s) return
      const r = el.getBoundingClientRect()
      const c0x = r.left + r.width / 2 - z.x
      const c0y = r.top + r.height / 2 - z.y
      const k = next / z.s
      applyZoom(next, k * z.x + (1 - k) * (cx - c0x), k * z.y + (1 - k) * (cy - c0y))
    },
    [applyZoom],
  )

  useEffect(() => {
    setZoom({ s: 1, x: 0, y: 0 })
  }, [open])

  // 打开时把页面钉住，滚轮全给缩放
  useEffect(() => {
    if (open == null) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (open == null) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.16 : 1 / 1.16)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') setOpen((i) => (i == null ? i : Math.min(projects.length - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setOpen((i) => (i == null ? i : Math.max(0, i - 1)))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, projects.length, zoomAt])

  const active = open == null ? null : projects[open]

  return (
    <section id="works" className="hp-works" aria-label="作品集">
      <div className="hp-wrap">
        <div className="hpw-head" data-reveal>
          <div>
            <p className="hp-sec-label">01 — 作品</p>
            <h2>做过的事，一件接一件</h2>
          </div>

          <div className="hpw-size">
            <label className="hpw-size-label" htmlFor="hpw-size">
              尺寸
            </label>
            <input
              id="hpw-size"
              className="hpw-range"
              type="range"
              min={MIN_W}
              max={MAX_W}
              step={10}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label="调整作品尺寸"
              aria-valuetext={`卡片宽 ${size} 像素，每行 ${cols} 件`}
            />
            <span className="hpw-size-val">{cols} 列</span>
          </div>
        </div>

        {state === 'loading' && <div className="hpw-skeleton" aria-hidden="true" />}
        {state === 'error' && <p className="hp-note">作品数据加载失败，刷新试试。</p>}

        <div
          ref={gridRef}
          className="hpw-grid"
          style={{ '--hpw-cols': String(cols), '--hpw-gap': '26px' } as CSSProperties}
        >
          {projects.map((p, i) => (
            <article key={p.id} className="hpw-item" data-reveal style={{ '--hpw-i': i } as CSSProperties}>
              <button
                type="button"
                className="hpw-shot"
                onClick={() => setOpen(i)}
                aria-label={`放大查看：${p.title}`}
              >
                <img
                  src={`${baseUrl}${p.cover}`}
                  alt={p.title}
                  loading={i < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                />
                <span className="hpw-shot-cue" aria-hidden="true">
                  ⤢
                </span>
              </button>

              <div className="hpw-meta">
                <span className="hpw-no">{String(i + 1).padStart(2, '0')}</span>
                <h3>{p.title}</h3>
                <span className="hpw-year">{yearOf(p.uploadedAt)}</span>
              </div>
              <p className="hpw-sum">{p.summary}</p>
            </article>
          ))}
        </div>
      </div>

      {active && (
        <div className="hpw-view" role="dialog" aria-modal="true" aria-label={active.title}>
          <div
            className={`hpw-view-stage ${zoom.s > 1 ? 'is-zoomed' : ''}`}
            onPointerDown={(e) => {
              if (zoom.s <= 1) return
              pan.current = { down: true, sx: e.clientX, sy: e.clientY, ox: zoom.x, oy: zoom.y }
              setPanning(true)
              e.currentTarget.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const p = pan.current
              if (!p.down) return
              applyZoom(zoom.s, p.ox + e.clientX - p.sx, p.oy + e.clientY - p.sy)
            }}
            onPointerUp={() => {
              pan.current.down = false
              setPanning(false)
            }}
            onPointerCancel={() => {
              pan.current.down = false
              setPanning(false)
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(null)
            }}
            onDoubleClick={(e) => {
              if (zoom.s > 1) applyZoom(1, 0, 0)
              else zoomAt(e.clientX, e.clientY, 2.2)
            }}
          >
            <img
              ref={imgRef}
              className="hpw-view-img"
              src={`${baseUrl}${active.cover}`}
              alt={active.title}
              draggable={false}
              style={{
                transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`,
                transition: panning ? 'none' : undefined,
              }}
            />
          </div>

          <button type="button" className="hpw-view-close" onClick={() => setOpen(null)} aria-label="关闭">
            ×
          </button>
          {open != null && open > 0 && (
            <button
              type="button"
              className="hpw-view-arrow is-prev"
              onClick={() => setOpen((i) => (i == null ? i : i - 1))}
              aria-label="上一件"
            >
              ←
            </button>
          )}
          {open != null && open < projects.length - 1 && (
            <button
              type="button"
              className="hpw-view-arrow is-next"
              onClick={() => setOpen((i) => (i == null ? i : i + 1))}
              aria-label="下一件"
            >
              →
            </button>
          )}
          <div className="hpw-view-cap">
            <span className="hpw-no">{String((open ?? 0) + 1).padStart(2, '0')}</span>
            <strong>{active.title}</strong>
            <span>{yearOf(active.uploadedAt)}</span>
          </div>
          {zoom.s > 1.02 && <span className="hpw-view-pct">{Math.round(zoom.s * 100)}%</span>}
        </div>
      )}
    </section>
  )
}
