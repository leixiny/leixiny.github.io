import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './WorksStrip.css'

interface Project {
  id: string
  title: string
  cover: string
  uploadedAt: string
}

const baseUrl = import.meta.env.BASE_URL

// 卡片宽度的两头：最小一屏能看四五件，最大一件几乎铺满
const MIN_W = 280
const MAX_W = 900
const SIZE_KEY = 'hp:works:size'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export default function WorksStrip() {
  const [projects, setProjects] = useState<Project[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [size, setSize] = useState(() => {
    const saved = Number(window.localStorage.getItem(SIZE_KEY))
    return Number.isFinite(saved) && saved >= MIN_W ? clamp(saved, MIN_W, MAX_W) : 620
  })
  const [open, setOpen] = useState<number | null>(null)

  // 滚动条：pos 是进度，size 是可视比例（拇指长度）
  const [bar, setBar] = useState({ pos: 0, size: 1 })
  const [edge, setEdge] = useState({ start: true, end: true })
  const [dragging, setDragging] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)
  const scrubRef = useRef<HTMLDivElement>(null)

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

  /* ---------- 滚动位置 → 进度条 ---------- */
  const sync = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 4) {
      setBar({ pos: 0, size: 1 })
      setEdge({ start: true, end: true })
      return
    }
    setBar({
      pos: el.scrollLeft / max,
      size: Math.max(0.12, el.clientWidth / el.scrollWidth),
    })
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 })
  }, [])

  /* ---------- 尺寸：卡片宽 = 滑杆值，但不超过一屏 ---------- */
  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const gut = parseFloat(getComputedStyle(el).paddingLeft) || 0
    const viewport = Math.max(240, el.clientWidth - gut * 2)
    const gap = window.innerWidth < 760 ? 14 : 26
    // 窄屏再收一点，让下一张露出个边 —— 不然满屏一张，看不出还能横向滚
    const peek = window.innerWidth < 760 ? 46 : 0
    const w = Math.max(200, Math.min(size, viewport - peek))
    el.style.setProperty('--hpw-w', `${Math.round(w)}px`)
    el.style.setProperty('--hpw-gap', `${gap}px`)
    sync()
  }, [size, sync])

  useEffect(() => {
    if (state !== 'ready') return
    measure()
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // 字体、图片落位后 scrollWidth 会再变一次
    const t = window.setTimeout(sync, 200)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [state, measure, sync, projects.length])

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
  }, [state])

  /* ---------- 按住拖动：像拖一张长图，而不是翻页 ---------- */
  const drag = useRef({ down: false, x: 0, left: 0, moved: false })
  const blockClick = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    if (!el) return
    drag.current = { down: true, x: e.clientX, left: el.scrollLeft, moved: false }
    // 注意：这里不能立刻 setPointerCapture —— 一旦捕获，后续的 click 会被改派到轨道上，
    // 点图片就再也打不开大图了。等真的拖起来（位移超过阈值）再捕获。
    // 点在空白处时把焦点收到轨道上，之后就能用左右方向键翻着看
    if (e.target === e.currentTarget) el.focus({ preventScroll: true })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = trackRef.current
    if (!d.down || !el) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true
      setDragging(true)
      el.setPointerCapture(e.pointerId)
    }
    if (d.moved) el.scrollLeft = d.left - dx
  }

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.down) return
    d.down = false
    if (d.moved) {
      blockClick.current = true
      window.setTimeout(() => {
        blockClick.current = false
      }, 80)
    }
    const el = trackRef.current
    if (el && e && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  /* ---------- 底下那根细滚动条：点哪滚哪 ---------- */
  const scrubDrag = useRef(false)

  const seek = (clientX: number) => {
    const el = trackRef.current
    const rail = scrubRef.current
    if (!el || !rail) return
    const r = rail.getBoundingClientRect()
    if (!r.width) return
    const t = clamp((clientX - r.left) / r.width, 0, 1)
    el.scrollLeft = t * (el.scrollWidth - el.clientWidth)
  }

  /* ---------- 键盘：焦点在轨道上时左右方向键滚动 ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    const el = trackRef.current
    if (!el) return
    e.preventDefault()
    const step = el.clientWidth * 0.7
    el.scrollTo({ left: el.scrollLeft + (e.key === 'ArrowRight' ? step : -step), behavior: 'smooth' })
  }

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
  // 两侧化开的宽度：要盖住「露出半张」的那一段，文字才不会硬生生被切
  const fade = 56

  return (
    <section id="works" className="hp-works" aria-label="作品集">
      {state === 'loading' && (
        <div className="hp-wrap">
          <div className="hpw-skeleton" aria-hidden="true" />
        </div>
      )}
      {state === 'error' && (
        <div className="hp-wrap">
          <p className="hp-note">作品数据加载失败，刷新试试。</p>
        </div>
      )}

      <div
        ref={trackRef}
        className={`hpw-track${dragging ? ' is-dragging' : ''}`}
        style={
          {
            '--fade-l': edge.start ? '0px' : `${fade}px`,
            '--fade-r': edge.end ? '0px' : `${fade}px`,
          } as CSSProperties
        }
        onScroll={sync}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        onClickCapture={(e) => {
          if (!blockClick.current) return
          e.preventDefault()
          e.stopPropagation()
          blockClick.current = false
        }}
        tabIndex={0}
        role="group"
        aria-label="作品列表，左右方向键滚动"
      >
        {projects.map((p, i) => (
          <article
            key={p.id}
            className="hpw-item"
            data-reveal
            style={{ '--hpw-i': i } as CSSProperties}
          >
            <button
              type="button"
              className="hpw-shot"
              onClick={() => setOpen(i)}
              aria-label={`放大查看：${p.title}`}
            >
              <img
                src={`${baseUrl}${p.cover}`}
                alt={p.title}
                loading={i < 3 ? 'eager' : 'lazy'}
                decoding="async"
                draggable={false}
              />
              <span className="hpw-shot-cue" aria-hidden="true">
                ⤢
              </span>
            </button>
          </article>
        ))}
      </div>

      {state === 'ready' && (
        <div className="hp-wrap">
          <div className="hpw-foot">
            <div
              ref={scrubRef}
              className="hpw-scrub"
              onPointerDown={(e) => {
                e.preventDefault()
                scrubDrag.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                seek(e.clientX)
              }}
              onPointerMove={(e) => {
                if (scrubDrag.current) seek(e.clientX)
              }}
              onPointerUp={() => {
                scrubDrag.current = false
              }}
              onPointerCancel={() => {
                scrubDrag.current = false
              }}
              aria-hidden="true"
            >
              <span
                className="hpw-thumb"
                style={{
                  left: `${bar.pos * (100 - bar.size * 100)}%`,
                  width: `${bar.size * 100}%`,
                }}
              />
            </div>

            <input
              className="hpw-range"
              type="range"
              min={MIN_W}
              max={MAX_W}
              step={10}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label="调整作品尺寸"
              aria-valuetext={`卡片宽 ${size} 像素`}
              title="调整作品尺寸"
            />
          </div>
        </div>
      )}

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
          {zoom.s > 1.02 && <span className="hpw-view-pct">{Math.round(zoom.s * 100)}%</span>}
        </div>
      )}
    </section>
  )
}
