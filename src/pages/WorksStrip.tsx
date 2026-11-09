import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './WorksStrip.css'

import { coverSrc, listPublicWorks, type Work } from '../lib/works'

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * 作品集：一屏一件。
 * 没有标题、没有说明、没有进度条 —— 作品直接摆在水面上，
 * 桌面/手机都是「一屏装下尽可能大的一件」，拖拽或方向键翻。
 */
export default function WorksStrip() {
  const [projects, setProjects] = useState<Work[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [open, setOpen] = useState<number | null>(null)
  // 现在停在第几件：只管底下那几点圆点
  const [idx, setIdx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const trackRef = useRef<HTMLDivElement>(null)

  /* ---------- 数据 ---------- */
  // 后台改完就生效：数据库里有就用数据库，没有（或还没建表）才退回 projects.json
  useEffect(() => {
    let cancelled = false
    listPublicWorks()
      .then(({ works }) => {
        if (cancelled) return
        setProjects(works)
        setState(works.length ? 'ready' : 'error')
      })
      .catch(() => !cancelled && setState('error'))
    return () => {
      cancelled = true
    }
  }, [])

  /* ---------- 滚动位置 → 第几件 ---------- */
  const sync = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
  }, [])

  useEffect(() => {
    if (state !== 'ready') return
    const el = trackRef.current
    if (!el) return
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    const t = window.setTimeout(sync, 200)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [state, sync])

  /* ---------- 拖动 / 滚轮 / 方向键：都是一次翻一件 ---------- */
  const idxRef = useRef(0)
  idxRef.current = idx

  /* ---------- 放大看细节：双指捏合 / 双击 / Ctrl+滚轮，放大后能拖着看 ---------- */
  const zRef = useRef({ i: -1, s: 1, x: 0, y: 0 })
  const [zoomed, setZoomed] = useState(false)
  // 拖过 / 缩过之后紧跟着的那下 click 不算点击，别把大图弹出来
  const suppressUntil = useRef(0)
  // 单击要等一下再看是不是双击（双击是缩放，不该顺带打开大图）
  const clickTimer = useRef(0)

  const shotAt = (i: number) =>
    trackRef.current?.querySelectorAll<HTMLElement>('.hpw-shot')[i] ?? null
  const coverAt = (i: number) => shotAt(i)?.querySelector('img') ?? null

  const paintZoom = (animate = false) => {
    const { i, s, x, y } = zRef.current
    const img = i >= 0 ? coverAt(i) : null
    if (!img) return
    img.style.transition = animate ? 'transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none'
    img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
  }

  const zoomTo = (i: number, s: number, x: number, y: number, animate = false) => {
    const scale = clamp(s, 1, 4)
    const img = i >= 0 ? coverAt(i) : null
    // 只在图片比一屏大的那个方向上允许平移
    const mx = img ? (img.offsetWidth * (scale - 1)) / 2 : 0
    const my = img ? (img.offsetHeight * (scale - 1)) / 2 : 0
    zRef.current = { i, s: scale, x: clamp(x, -mx, mx), y: clamp(y, -my, my) }
    paintZoom(animate)
    setZoomed(scale > 1.01)
  }

  const resetZoom = (animate = true) => {
    const { i } = zRef.current
    const img = i >= 0 ? coverAt(i) : null
    zRef.current = { i: -1, s: 1, x: 0, y: 0 }
    setZoomed(false)
    if (!img) return
    if (!animate) {
      img.style.transition = ''
      img.style.transform = ''
      return
    }
    img.style.transition = 'transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)'
    img.style.transform = 'translate3d(0px, 0px, 0) scale(1)'
    window.setTimeout(() => {
      // 复位了才把行内样式摘掉，恢复桌面上的 hover 微放大
      if (zRef.current.s <= 1.01) {
        img.style.transition = ''
        img.style.transform = ''
      }
    }, 340)
  }

  // 翻到别的作品就把上一件的放大收掉，不然会残留在别的屏上
  useEffect(() => {
    if (zRef.current.s > 1.01 && zRef.current.i !== idx) resetZoom(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const go = (i: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const drag = useRef({ down: false, x: 0, left: 0, moved: false, lastX: 0, lastT: 0, vx: 0 })
  const panRef = useRef({ down: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false })
  const blockClick = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const el = trackRef.current
    if (!el) return
    // 已经放大：鼠标拖动是挪画面，不是翻页
    const z = zRef.current
    if (z.i === idxRef.current && z.s > 1.01) {
      panRef.current = { down: true, sx: e.clientX, sy: e.clientY, ox: z.x, oy: z.y, moved: false }
      // 同样不能在这里 setPointerCapture / preventDefault：捕获会把 click 改派到轨道上，
      // 双击复原和点开大图就都失灵了。等真的拖起来再说。
      return
    }
    drag.current = {
      down: true,
      x: e.clientX,
      left: el.scrollLeft,
      moved: false,
      lastX: e.clientX,
      lastT: performance.now(),
      vx: 0,
    }
    // 注意：这里不能立刻 setPointerCapture —— 一旦捕获，后续的 click 会被改派到轨道上，
    // 点图片就再也打不开大图了。等真的拖起来（位移超过阈值）再捕获。
    if (e.target === e.currentTarget) el.focus({ preventScroll: true })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current.down) {
      const z = zRef.current
      const dx = e.clientX - panRef.current.sx
      const dy = e.clientY - panRef.current.sy
      if (!panRef.current.moved) {
        if (Math.abs(dx) + Math.abs(dy) <= 4) return
        panRef.current.moved = true
        trackRef.current?.setPointerCapture(e.pointerId)
      }
      suppressUntil.current = performance.now() + 360
      zoomTo(z.i, z.s, panRef.current.ox + dx, panRef.current.oy + dy)
      return
    }
    const d = drag.current
    const el = trackRef.current
    if (!d.down || !el) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 4) {
      d.moved = true
      setDragging(true)
      el.setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    // 跟手拖：鼠标走多远，画面走多远
    el.scrollLeft = d.left - dx
    // 顺手记一下松手前的速度（px/ms），松手后让它再溜一段
    const now = performance.now()
    if (now - d.lastT > 0) d.vx = (e.clientX - d.lastX) / (now - d.lastT)
    d.lastX = e.clientX
    d.lastT = now
  }

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current.down) {
      panRef.current.down = false
      const el = trackRef.current
      if (el && e && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      return
    }
    const d = drag.current
    if (!d.down) return
    d.down = false
    const el = trackRef.current
    if (d.moved) {
      blockClick.current = true
      window.setTimeout(() => {
        blockClick.current = false
      }, 80)
      // 不再吸附到整件：松手就停在原地，只按最后的速度再滑一小段（鼠标没有原生惯性）
      if (el && Math.abs(d.vx) > 0.15) {
        el.scrollBy({ left: clamp(-d.vx * 320, -el.clientWidth, el.clientWidth), behavior: 'smooth' })
      }
    }
    if (el && e && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  /* ---------- 滚轮 / 触控板：连续推着走，不吸附到整件 ---------- */
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // Ctrl / ⌘ + 滚轮 = 缩放当前这张（和图片查看器的手感一致）
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const i = idxRef.current
        const z = zRef.current
        const base = z.i === i ? z : { i, s: 1, x: 0, y: 0 }
        const next = clamp(base.s * (e.deltaY < 0 ? 1.14 : 1 / 1.14), 1, 4)
        if (next === base.s) return
        const shot = shotAt(i)
        if (!shot) return
        const r = shot.getBoundingClientRect()
        const k = next / base.s
        zoomTo(
          i,
          next,
          k * base.x + (1 - k) * (e.clientX - (r.left + r.width / 2)),
          k * base.y + (1 - k) * (e.clientY - (r.top + r.height / 2)),
        )
        if (next <= 1.01) resetZoom(true)
        return
      }
      // 横滑用 deltaX，竖滚也当横滑用；不再一件一件地翻，滚多少走多少
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (!raw) return
      e.preventDefault()
      const mul = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientWidth : 1
      el.scrollLeft += raw * mul
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [projects.length])

  /* ---------- 触摸：没放大时单指翻页，双指捏合缩放，放大后单指拖着看 ---------- */
  useEffect(() => {
    const track = trackRef.current
    if (!track || state !== 'ready') return

    let mode: 'none' | 'pinch' | 'pan' = 'none'
    let d0 = 1
    let s0 = 1
    let x0 = 0
    let y0 = 0
    let mx0 = 0
    let my0 = 0
    let cx = 0
    let cy = 0
    let sx = 0
    let sy = 0
    let ox = 0
    let oy = 0

    const dist = (t: TouchList) => {
      const a = t[0]
      const b = t[1]
      return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 1
    }
    const midX = (t: TouchList) => (t[0] && t[1] ? (t[0].clientX + t[1].clientX) / 2 : 0)
    const midY = (t: TouchList) => (t[0] && t[1] ? (t[0].clientY + t[1].clientY) / 2 : 0)

    const onDown = (e: TouchEvent) => {
      const z = zRef.current
      const i = idxRef.current
      if (e.touches.length >= 2) {
        const shot = shotAt(i)
        if (!shot) return
        const r = shot.getBoundingClientRect()
        cx = r.left + r.width / 2
        cy = r.top + r.height / 2
        d0 = dist(e.touches)
        s0 = z.i === i ? z.s : 1
        x0 = z.i === i ? z.x : 0
        y0 = z.i === i ? z.y : 0
        mx0 = midX(e.touches)
        my0 = midY(e.touches)
        zRef.current = { i, s: s0, x: x0, y: y0 }
        mode = 'pinch'
        // 双指一落下就掐掉原生手势：页面别跟着缩放，轨道也别横滑
        e.preventDefault()
        return
      }
      if (e.touches.length === 1 && z.i === i && z.s > 1.01) {
        const t = e.touches[0]
        if (!t) return
        mode = 'pan'
        sx = t.clientX
        sy = t.clientY
        ox = z.x
        oy = z.y
        // 这里不 preventDefault：放大状态下靠 .is-zoomed 的 touch-action:none 挡掉原生滚动就够了，
        // 拦了 touchstart 会连带把 click / dblclick 一起掐掉，双击复原和点开大图就没反应了
      }
    }

    const onMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault()
        const z = zRef.current
        const s = clamp(s0 * (dist(e.touches) / d0), 1, 4)
        // 双指中点压住的那块内容不跑：p 是它在图片里的未缩放坐标
        const px = (mx0 - cx - x0) / s0
        const py = (my0 - cy - y0) / s0
        suppressUntil.current = performance.now() + 400
        zoomTo(z.i, s, midX(e.touches) - cx - px * s, midY(e.touches) - cy - py * s)
        return
      }
      if (mode === 'pan') {
        const t = e.touches[0]
        if (!t) return
        const dx = t.clientX - sx
        const dy = t.clientY - sy
        // 手指抖一两个像素不算拖：放过去，让 click / dblclick 还能正常派发
        if (Math.abs(dx) + Math.abs(dy) < 6) return
        e.preventDefault()
        const z = zRef.current
        suppressUntil.current = performance.now() + 400
        zoomTo(z.i, z.s, ox + dx, oy + dy)
      }
    }

    const onEnd = (e: TouchEvent) => {
      const z = zRef.current
      if (e.touches.length === 0) {
        mode = 'none'
        if (z.i >= 0) {
          // 缩得跟原图差不多大就回弹到 1，别停在 1.02 这种尴尬尺寸
          if (z.s <= 1.04) resetZoom(true)
          else zoomTo(z.i, z.s, z.x, z.y, true)
        }
        return
      }
      if (e.touches.length === 1) {
        const t = e.touches[0]
        if (t && z.s > 1.01) {
          mode = 'pan'
          sx = t.clientX
          sy = t.clientY
          ox = z.x
          oy = z.y
        } else {
          mode = 'none'
        }
      }
    }

    track.addEventListener('touchstart', onDown, { passive: false })
    track.addEventListener('touchmove', onMove, { passive: false })
    track.addEventListener('touchend', onEnd)
    track.addEventListener('touchcancel', onEnd)
    return () => {
      track.removeEventListener('touchstart', onDown)
      track.removeEventListener('touchmove', onMove)
      track.removeEventListener('touchend', onEnd)
      track.removeEventListener('touchcancel', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  /* ---------- 键盘：焦点在轨道上时左右方向键翻 ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 详情开着的时候方向键归详情翻页
    if (open != null) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const el = trackRef.current
    if (!el) return
    e.preventDefault()
    const i = clamp(idx + (e.key === 'ArrowRight' ? 1 : -1), 0, projects.length - 1)
    go(i)
  }

  /* ---------- 点开一件：作品介绍 + 链接 ---------- */
  const active = open == null ? null : projects[open]
  const isExternal = !!active?.url && /^https?:/i.test(active.url)

  // 打开时把页面钉住，后面的水不再跟着滚
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') setOpen((i) => (i == null ? i : Math.min(projects.length - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setOpen((i) => (i == null ? i : Math.max(0, i - 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, projects.length])

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
        className={`hpw-track${dragging ? ' is-dragging' : ''}${zoomed ? ' is-zoomed' : ''}`}
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
        aria-label="作品列表，左右方向键翻页"
      >
        {projects.map((p, i) => (
          <article key={p.id} className="hpw-item" style={{ '--hpw-i': i } as CSSProperties}>
            <button
              type="button"
              className="hpw-shot"
              onClick={() => {
                if (blockClick.current) return
                if (performance.now() < suppressUntil.current) return
                // 等一下：水先荡开（那是全局那层在管），如果紧接着是双击就别开详情
                window.clearTimeout(clickTimer.current)
                clickTimer.current = window.setTimeout(() => setOpen(i), 300)
              }}
              onDoubleClick={(e) => {
                window.clearTimeout(clickTimer.current)
                const z = zRef.current
                if (z.i === i && z.s > 1.01) {
                  resetZoom(true)
                  return
                }
                const shot = shotAt(i)
                if (!shot) return
                const r = shot.getBoundingClientRect()
                const s = 2.4
                zoomTo(
                  i,
                  s,
                  (e.clientX - (r.left + r.width / 2)) * (1 - s),
                  (e.clientY - (r.top + r.height / 2)) * (1 - s),
                  true,
                )
              }}
              aria-label={`查看详情：${p.title}`}
            >
              <img src={coverSrc(p.cover)} alt={p.title} loading={i < 2 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
              <span className="hpw-shot-cue" aria-hidden="true">
                详情 <span>›</span>
              </span>
            </button>
          </article>
        ))}
      </div>

      {state === 'ready' && projects.length > 1 && (
        <div className="hpw-dots">
          {projects.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`hpw-dot${i === idx ? ' is-on' : ''}`}
              onClick={() => go(i)}
              aria-label={`第 ${i + 1} 件：${p.title}`}
              aria-current={i === idx || undefined}
            />
          ))}
        </div>
      )}

      {active && (
        <div
          className="hpw-view"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hpw-sheet-title"
          onClick={(e) => {
            // 点卡片外面那圈水才关
            if (e.target === e.currentTarget) setOpen(null)
          }}
        >
          <div className="hpw-sheet">
            <div className="hpw-sheet-art">
              <img className="hpw-sheet-img" src={coverSrc(active.cover)} alt={active.title} draggable={false} />
            </div>

            <div className="hpw-sheet-body">
              {(active.period || active.role) && (
                <p className="hpw-meta">{[active.period, active.role].filter(Boolean).join('  ·  ')}</p>
              )}
              <h2 className="hpw-title" id="hpw-sheet-title">
                {active.title}
              </h2>
              {active.summary && <p className="hpw-desc">{active.summary}</p>}
              {active.result && (
                <div className="hpw-result">
                  <span className="hpw-result-k">结果</span>
                  <p>{active.result}</p>
                </div>
              )}
              {!!active.tags?.length && (
                <ul className="hpw-tags">
                  {active.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <div className="hpw-actions">
                <span className="hpw-count">
                  {String((open ?? 0) + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
                </span>
                {active.url ? (
                  <a
                    className="hpw-cta"
                    href={active.url}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noreferrer' : undefined}
                  >
                    {/* 站内相对路径：指向后台系统的叫「进入系统」，指向网站自己的叫「打开网站」 */}
                    {isExternal ? '打开作品' : active.url.includes('index.html') ? '打开网站' : '进入系统'}
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <a className="hpw-cta is-ghost" href="#/home?to=contact">
                    聊聊这个作品
                    <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="hpw-view-close"
            onClick={() => setOpen(null)}
            aria-label="关闭"
            autoFocus
          >
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
        </div>
      )}
    </section>
  )
}
