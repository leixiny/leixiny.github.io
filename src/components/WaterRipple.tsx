import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './WaterRipple.css'

type Ripple = { id: number; x: number; y: number; over: boolean; compact: boolean }

/** 一圈水波从按下到散尽的时间，跟 CSS 里最外圈那条动画对齐；
    紧凑档第 4/5 圈的动画要到 980ms，所以取 1000 */
const LIFETIME = 1000
/** 双击是两下 click，位置几乎一样：140ms / 24px 内只荡一次 */
const DEDUPE_MS = 140
const DEDUPE_PX = 24
/** 手指/鼠标挪超过这个距离，算拖拽，不算点击（拖作品翻页时不该荡水） */
const DRAG_PX = 8

/**
 * 全站的水：点哪儿，哪儿的水面就荡开一圈。
 * 挂在页面最外层（不能在 portal 到 body：作品页的详情卡是 z 90，
 * 而 .home-page.is-works 自己开了层叠上下文，跑到 body 下面就绕不过去）。
 *
 * 两层：普通点击压在详情卡下面（60），卡片一浮起来正好把水接走；
 * 卡片里面的点击则要用更上面那层（96），否则被卡片自己的底纱挡住看不见。
 */
export default function WaterRipple() {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const seq = useRef(0)
  const timers = useRef<number[]>([])
  const last = useRef({ t: 0, x: 0, y: 0 })
  const press = useRef<{ x: number; y: number } | null>(null)
  const warpRaf = useRef(0)

  /** 让页面那层水面背景真的被推一下：位移量 0 → 峰值 → 0，约 0.6 秒 */
  const warp = useCallback(() => {
    const map = document.getElementById('wrip-warp-map')
    if (!map) return
    cancelAnimationFrame(warpRaf.current)
    const t0 = performance.now()
    const DUR = 620
    const MAX = 22
    let lastSet = 0
    document.documentElement.classList.add('is-warping')
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / DUR)
      // 全屏位移滤镜不便宜：约 30fps 就够看出水在动
      if (t - lastSet > 30) {
        lastSet = t
        map.setAttribute('scale', String((MAX * Math.sin(Math.PI * p)).toFixed(2)))
      }
      if (p < 1) {
        warpRaf.current = requestAnimationFrame(tick)
      } else {
        map.setAttribute('scale', '0')
        document.documentElement.classList.remove('is-warping')
      }
    }
    warpRaf.current = requestAnimationFrame(tick)
  }, [])

  const spawn = useCallback((x: number, y: number, over: boolean, compact: boolean) => {
    const now = performance.now()
    const prev = last.current
    if (now - prev.t < DEDUPE_MS && Math.hypot(x - prev.x, y - prev.y) < DEDUPE_PX) return
    last.current = { t: now, x, y }

    const id = (seq.current += 1)
    // 最多留 4 枚，连点也堆不出一片白
    setRipples((rs) => [...rs.slice(-3), { id, x, y, over, compact }])
    warp()
    const timer = window.setTimeout(() => {
      setRipples((rs) => rs.filter((r) => r.id !== id))
    }, LIFETIME)
    timers.current.push(timer)
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      press.current = { x: e.clientX, y: e.clientY }
    }

    const onClick = (e: MouseEvent) => {
      const from = press.current
      press.current = null
      // 拖着不算点：翻作品、拖滚动条松手时都别荡
      if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_PX) return

      const el = e.target instanceof Element ? e.target : null
      let x: number
      let y: number

      if (from) {
        // 手指/鼠标按下的那一点才是水起来的点：
        // 有些按钮点完立刻重渲染，click 已经漂到别处去了（甚至 detail 变 0）
        x = from.x
        y = from.y
      } else {
        // 键盘回车 / 空格触发的 click 没有按下动作，就拿元素中点
        const r = el?.getBoundingClientRect()
        if (!r || (!r.width && !r.height)) return
        x = r.left + r.width / 2
        y = r.top + r.height / 2
      }

      // 管理系统的界面密：420px 的环会一口气盖住大半张卡片，在那边收小一号
      spawn(x, y, !!el?.closest('.hpw-view'), !!el?.closest('.app-shell, .auth-page'))
    }

    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [spawn])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  const layer = (over: boolean) =>
    ripples
      .filter((r) => r.over === over)
      .map((r) => (
        <span key={r.id} className={r.compact ? 'wrip is-compact' : 'wrip'} style={{ left: r.x, top: r.y } as CSSProperties}>
          {/* 管理系统的环小，三圈看着单薄，多添两道细波才荡得开 */}
          {Array.from({ length: r.compact ? 5 : 3 }, (_, k) => (
            <i key={k} />
          ))}
        </span>
      ))

  return (
    <>
      {/* 背景位移滤镜：湍流噪声把水面背景的像素推开，点击时背景才会真的荡 */}
      <svg className="wrip-defs" aria-hidden="true" focusable="false" width="0" height="0">
        <filter id="wrip-warp" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.007 0.011" numOctaves="1" seed="3" result="noise" />
          <feDisplacementMap
            id="wrip-warp-map"
            in="SourceGraphic"
            in2="noise"
            scale="0"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
      <div className="wrip-layer" aria-hidden="true">
        {layer(false)}
      </div>
      <div className="wrip-layer is-over" aria-hidden="true">
        {layer(true)}
      </div>
    </>
  )
}
