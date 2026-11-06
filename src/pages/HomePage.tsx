import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { LEI_H, LEI_LEFT, LEI_LETTERS, LEI_TOP, LEI_W } from './leiStrokes'
import lumuUrl from '../assets/lumu.webp'
import './HomePage.css'

const baseUrl = import.meta.env.BASE_URL

/* ---------- 首屏字标：玻璃上按笔顺一笔一笔写出来的 Lei，字里透出来的就是底图 ---------- */
const WORD = 'Lei'

// 底图（插画）的宽高比，用来按字标尺寸算取景
const ART_RATIO = 1000 / 1213
// 底图宽度 ≈ 字标宽度：两个人物正好落在三个字母里
const ART_SPAN = 0.78
// 底图落在字标里的对焦点（0~1），正对两张脸
const ART_FOCUS_X = 0.5
const ART_FOCUS_Y = 0.45

// 笔尖：走多快（字体单位/秒）、两个字母之间停多久、最后把剩下的一点抹匀要多久
const PEN_SPEED = 720
const PEN_GAP = 150
const PEN_SETTLE = 420

// 底图在字体坐标系里的铺法：比字标宽一圈，居中对着两张脸
const ART_W = LEI_W / ART_SPAN
const ART_H = ART_W / ART_RATIO
const ART_X = LEI_LEFT + LEI_W * 0.5 - ART_W * ART_FOCUS_X
const ART_Y = LEI_TOP + LEI_H * 0.5 - ART_H * ART_FOCUS_Y

/* ---------- 动态壁纸：玻璃上一直有水在往下淌 ---------- */
// 跟笔画无关的常驻水：视口里永远有几道水痕在慢慢往下走，走走停停，末端坠着一颗水珠。
// 水痕是“长出来”的（顶端留在原地、底端往下延伸），所以看着是水在流，不是一坨雾在平移。
type WetFlow = {
  /** 横向位置（%） */
  x: number
  /** 水痕粗细（px） */
  w: number
  /** 走完全程要多久（s） */
  dur: number
  delay: number
  /** 水痕有多长（px）：固定长度的一截水流，整条往下滑，比拉满全屏的线像水 */
  len: number
  /** 整体浓淡：中间那片压淡，别跟字抢 */
  o: number
  /** 轻微倾斜：绝对笔直的水痕一眼假 */
  skew: number
}

// 主水流：12 道，横跨整屏，慢的二十几秒、快的十几秒，延时错开，任何时刻都有六七道在走
const WET_STREAMS: WetFlow[] = [
  { x: 3.5, w: 3.0, dur: 22, delay: 0, len: 340, o: 1, skew: 0.55 },
  { x: 6.2, w: 1.9, dur: 15, delay: 6.4, len: 210, o: 0.8, skew: -0.35 },
  { x: 9.4, w: 2.4, dur: 19, delay: 2.8, len: 295, o: 0.92, skew: 0.7 },
  { x: 15.5, w: 1.5, dur: 13, delay: 10.2, len: 160, o: 0.64, skew: -0.5 },
  { x: 24, w: 1.8, dur: 11, delay: 5.8, len: 200, o: 0.7, skew: 0.9 },
  { x: 33, w: 1.8, dur: 17, delay: 4.1, len: 240, o: 0.62, skew: 0.28 },
  { x: 39.5, w: 2.0, dur: 9.4, delay: 14.6, len: 150, o: 0.72, skew: -0.8 },
  { x: 47, w: 1.8, dur: 24, delay: 12.8, len: 370, o: 0.62, skew: -0.6 },
  { x: 54, w: 1.6, dur: 12.5, delay: 2.2, len: 230, o: 0.6, skew: 0.75 },
  { x: 61, w: 1.9, dur: 14, delay: 7.6, len: 185, o: 0.64, skew: 0.4 },
  { x: 66.5, w: 1.9, dur: 10.5, delay: 16.9, len: 178, o: 0.66, skew: -0.9 },
  { x: 72, w: 2.6, dur: 26, delay: 1.6, len: 320, o: 0.96, skew: -0.45 },
  { x: 83, w: 1.8, dur: 16, delay: 9.4, len: 225, o: 0.72, skew: 0.35 },
  { x: 88.5, w: 2.2, dur: 12, delay: 3.3, len: 175, o: 0.85, skew: -0.7 },
  { x: 91.8, w: 3.4, dur: 21, delay: 8.1, len: 350, o: 1, skew: 0.5 },
  { x: 95.5, w: 2.0, dur: 18, delay: 5.2, len: 265, o: 0.82, skew: -0.3 },
]

// 小水珠：被主水流带着一路滚下去，短、快、落在主水流旁边，像从那条水里甩出来的
const WET_BEADS: WetFlow[] = [
  { x: 4.8, w: 2.2, dur: 5.4, delay: 1.1, len: 96, o: 0.7, skew: 0.4 },
  { x: 7.8, w: 1.8, dur: 4.6, delay: 7.3, len: 72, o: 0.58, skew: -0.5 },
  { x: 18, w: 2.4, dur: 6.2, delay: 3.6, len: 112, o: 0.62, skew: 0.3 },
  { x: 27, w: 2.0, dur: 4.2, delay: 2.7, len: 88, o: 0.62, skew: 0.6 },
  { x: 44, w: 1.7, dur: 5.0, delay: 9.8, len: 84, o: 0.55, skew: -0.4 },
  { x: 58, w: 1.9, dur: 3.8, delay: 6.1, len: 76, o: 0.58, skew: -0.7 },
  { x: 79, w: 2.1, dur: 5.6, delay: 0.5, len: 104, o: 0.62, skew: 0.45 },
  { x: 86, w: 2.2, dur: 4.4, delay: 8.9, len: 92, o: 0.64, skew: 0.5 },
  { x: 93.4, w: 2.5, dur: 6.6, delay: 4.8, len: 120, o: 0.68, skew: -0.35 },
]

/* ---------- 水从字上淌下来 ---------- */
// 水是跟着笔走的：笔尖刚擦过哪块墨，那里就攒出一颗水珠顺着玻璃往下淌。
// 坐标用字体单位（和笔迹同一套），时刻由 plan() 里那一笔的时间轴推出来，
// 所以“字长出来”和“水流下来”是同一条时间线，不是两段各自播的动画。
type WordDrip = {
  /** 属于第几个字母 */
  letter: number
  /** 笔尖写到这一位置时（0~1）开始积水 */
  at: number
  /** 积完水到真的往下滑，中间停一下（ms） */
  lag: number
  /** 起滴点（字体单位） */
  x: number
  y: number
  /** 水痕粗细（em，跟着字标字号缩放） */
  w: number
  /** 往下淌多久（s）、横向漂移（px）、水痕的倾角 */
  dur: number
  drift: number
  rot: number
  /** 水膜是被擦向哪一侧聚起来的（em，正=从右推来，负=从左推来） */
  from: number
  /** 那一段水带的长度（em）：顺着笔画方向铺开，才像被推出来的一条水 */
  pw: number
  /** 笔画在这一点的走向（deg）：水带要顺着它，不能横着插在笔画上 */
  pAng: number
}

const WORD_DRIPS: WordDrip[] = [
  // 起滴点就压在笔画外缘上：水是被擦着推到边上的，一半压在字上（看不见）、
  // 一半摊在雾面那一侧（看得见）—— 那个被笔画切掉的半月形才是“水从字上挤出来”的证据
  // L 的竖笔：笔锋一路往下，水就顺着笔杆往下淌
  { letter: 0, at: 0.3, lag: 60, x: 39.0037, y: -374.249, w: 0.00408, dur: 3.6, drift: 8, rot: -1.4, from: 0.050, pw: 0.0965, pAng: -76.0 },
  { letter: 0, at: 0.52, lag: 150, x: 229.475, y: -152.506, w: 0.00456, dur: 3.2, drift: -10, rot: 1.6, from: -0.045, pw: 0.0924, pAng: -76.4 },
  { letter: 0, at: 0.7, lag: 90, x: 73.4132, y: -136.591, w: 0.00360, dur: 2.8, drift: 6, rot: -0.9, from: 0.045, pw: 0.0940, pAng: -12.1 },
  // L 的横笔收尾，水被推到笔画末端坠下去
  { letter: 0, at: 0.99, lag: 220, x: 420.668, y: 5.51762, w: 0.00480, dur: 3.4, drift: 12, rot: 1.2, from: -0.050, pw: 0.0740, pAng: -12.9 },
  // e 的左半个圈
  { letter: 1, at: 0.6, lag: 80, x: 501.219, y: -262.515, w: 0.00408, dur: 3.8, drift: -7, rot: -1.8, from: 0.050, pw: 0.0882, pAng: -79.9 },
  // e 写到圈底，水积在那儿
  { letter: 1, at: 0.79, lag: 120, x: 589.944, y: 53.6722, w: 0.00504, dur: 3.1, drift: 9, rot: 1, from: -0.050, pw: 0.0840, pAng: 23.7 },
  // e 的尾巴
  { letter: 1, at: 0.99, lag: 190, x: 951.497, y: -33.653, w: 0.00384, dur: 3.6, drift: 13, rot: 2, from: -0.050, pw: 0.0740, pAng: -48.0 },
  // i 的竖笔
  { letter: 2, at: 0.74, lag: 70, x: 1067.58, y: -174.084, w: 0.00432, dur: 3.3, drift: -8, rot: -1.2, from: 0.045, pw: 0.0882, pAng: -78.7 },
  // i 的点：点被擦开，水从点边上聚成珠滑下来
  { letter: 2, at: 0.99, lag: 240, x: 1271.5, y: -473.8, w: 0.00360, dur: 4.4, drift: 7, rot: 1.4, from: -0.045, pw: 0.0840, pAng: -80.0 },
]

// 字体单位 -> 字标盒子里的百分比：水滴层和 SVG 用的是同一个 viewBox，换算完就贴着字走
const dripX = (x: number) => ((x - LEI_LEFT) / LEI_W) * 100
const dripY = (y: number) => ((y - LEI_TOP) / LEI_H) * 100
// 字标盒子的高度（em），用来算一颗水珠要淌多远才落到字下面
const WORD_EM = LEI_H / 1000

// 鼠标扫过时，整块字软软弹一下
const JELLY_TAP: Keyframe[] = [
  { transform: 'translateY(0) scale(1, 1)' },
  { transform: 'translateY(4px) scale(1.05, 0.94)' },
  { transform: 'translateY(0) scale(0.975, 1.025)' },
  { transform: 'translateY(0) scale(1.01, 0.99)' },
  { transform: 'translateY(0) scale(1, 1)' },
]

function WipeWord() {
  const wrapRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const svg = wrap.querySelector('svg')
    if (!svg) return
    const masks = Array.from(svg.querySelectorAll<SVGMaskElement>('.hp-mask'))
    const settles = Array.from(svg.querySelectorAll<SVGRectElement>('.hp-settle'))
    const drips = Array.from(wrap.querySelectorAll<HTMLElement>('.hp-drip--word'))

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 字写完之前不响应鼠标
    let readyAt = Number.POSITIVE_INFINITY

    // 每个字母按笔顺总长算这一笔写多久：长笔画慢一点，短的点一下子
    const plan = () => {
      let t = 130
      const starts: number[] = []
      const spans: number[] = []
      masks.forEach((mask, i) => {
        const dur = Math.max(420, (LEI_LETTERS[i].len / PEN_SPEED) * 1000)
        starts[i] = t
        spans[i] = dur
        mask.style.setProperty('--pen-start', `${Math.round(t)}ms`)
        mask.style.setProperty('--pen-dur', `${Math.round(dur)}ms`)
        const settle = settles[i]
        if (settle) {
          settle.style.setProperty('--settle-delay', `${Math.round(t + dur - 90)}ms`)
          settle.style.setProperty('--settle-dur', `${PEN_SETTLE}ms`)
        }
        t += dur + PEN_GAP
      })
      // 水：笔尖走到那一格才攒水，所以每颗水珠的延迟都挂在自己那一笔上
      drips.forEach((el, k) => {
        const d = WORD_DRIPS[k]
        if (!d) return
        const at = (starts[d.letter] ?? 0) + d.at * (spans[d.letter] ?? 0) + d.lag
        el.style.setProperty('--delay', `${Math.round(at)}ms`)
      })
      return t + PEN_SETTLE
    }

    // 手写体到位才开始“写”：先写默认字体、等字体回来字宽一变会很跳
    const start = () => {
      if (wrap.classList.contains('is-ready')) return
      const total = plan()
      wrap.classList.add('is-ready')
      readyAt = performance.now() + total + 260
    }
    const fonts = document.fonts
    if (fonts) {
      fonts
        .load(`400 120px 'HP Hand'`)
        .then(() => fonts.ready)
        .then(start)
        .catch(start)
      // 兜底：字体迟迟不来也别一直空着
      setTimeout(start, 2200)
    } else {
      start()
    }

    const onEnter = () => {
      if (reduce || performance.now() < readyAt) return
      wrap.animate(JELLY_TAP, { duration: 620, easing: 'cubic-bezier(.3,.9,.4,1)' })
    }
    wrap.addEventListener('pointerenter', onEnter)

    return () => {
      wrap.removeEventListener('pointerenter', onEnter)
    }
  }, [])

  return (
    <h1 className="hp-word" ref={wrapRef} aria-label={WORD} role="img">
      <svg
        className="hp-word-svg"
        viewBox={`${LEI_LEFT} ${LEI_TOP} ${LEI_W} ${LEI_H}`}
        style={{ width: `${LEI_W / 1000}em`, height: `${LEI_H / 1000}em` }}
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="hp-art"
            patternUnits="userSpaceOnUse"
            x={ART_X}
            y={ART_Y}
            width={ART_W}
            height={ART_H}
          >
            {/* pattern 的内容坐标是相对 tile 的，所以图片从 0 0 铺满整块 tile */}
            <image href={lumuUrl} x={0} y={0} width={ART_W} height={ART_H} preserveAspectRatio="none" />
          </pattern>
          {LEI_LETTERS.map((l, i) => (
            <mask
              key={l.ch}
              id={`hp-mask-${i}`}
              className="hp-mask"
              maskUnits="userSpaceOnUse"
              x={LEI_LEFT - 400}
              y={LEI_TOP - 400}
              width={LEI_W + 800}
              height={LEI_H + 800}
            >
              {/* 笔顺：把相邻两颗印章连成一条带圆头的笔迹，按 --at 先后落笔 */}
              {l.segs.map((s, k) => (
                <line
                  key={k}
                  className="hp-seg"
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  strokeWidth={s.w}
                  strokeLinecap="round"
                  style={{ '--at': s.at } as CSSProperties}
                />
              ))}
              {/* 收笔后把笔锋扫不到的边角轻轻抹匀 */}
              <rect
                className="hp-settle"
                x={LEI_LEFT - 400}
                y={LEI_TOP - 400}
                width={LEI_W + 800}
                height={LEI_H + 800}
                fill="#fff"
              />
            </mask>
          ))}
        </defs>
        {LEI_LETTERS.map((l, i) => (
          <text
            key={l.ch}
            x={l.x}
            y={0}
            mask={`url(#hp-mask-${i})`}
            fill="url(#hp-art)"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth={2}
            className="hp-glyph"
          >
            {l.ch}
          </text>
        ))}
      </svg>
      {/* 水层盖在字上面：笔尖刚擦过的地方攒出水珠，顺着玻璃往下淌到字下面 */}
      <div className="hp-wdrips" aria-hidden="true">
        {WORD_DRIPS.map((d, i) => {
          const top = dripY(d.y)
          const travel = ((100 - top) / 100 + 0.2) * WORD_EM
          return (
            <span
              key={i}
              className="hp-drip hp-drip--word"
              style={
                {
                  left: `${dripX(d.x)}%`,
                  top: `${top}%`,
                  '--w': `${d.w}em`,
                  '--travel': `${travel.toFixed(3)}em`,
                  '--dur': `${d.dur}s`,
                  '--drift': `${d.drift}px`,
                  '--rot': `${d.rot}deg`,
                  '--pool-from': `${d.from}em`,
                  '--pw': `${d.pw}em`,
                  '--p-ang': `${d.pAng}deg`,
                } as CSSProperties
              }
            >
              {/* 擦拭会把水雾推到一处：先摊成一小片水膜，再靠表面张力收成珠 */}
              <i className="hp-pool" />
              <i className="hp-bead" />
            </span>
          )
        })}
      </div>
    </h1>
  )
}

export default function HomePage() {
  const [likes, setLikes] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)
  const [justLiked, setJustLiked] = useState(false)
  const wetRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // 老的 /home?to=works 链接：作品集已经是独立页了，直接送过去
  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (q.get('to') === 'works') navigate('/works', { replace: true })
  }, [navigate])

  // 水层是满屏固定的（滚动时也一直淌），出了首屏就淡掉、并停掉动画，别让白底页面上挂着一道水
  useEffect(() => {
    const el = wetRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const span = Math.max(1, window.innerHeight)
      const p = Math.min(1, Math.max(0, window.scrollY / (span * 0.85)))
      el.style.opacity = String(+((1 - p) ** 1.4).toFixed(3))
      el.classList.toggle('is-idle', p > 0.985)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    ;(async () => {
      try {
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
      } catch (err) {
        console.error('互动功能初始化失败', err)
      }
    })()
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
    }
    setTimeout(() => setJustLiked(false), 900)
  }

  return (
    <div className="home-page">
      {/* 动态壁纸的水：满屏一层，一直在往下淌 */}
      <div className="hp-wet" ref={wetRef} aria-hidden="true">
        {WET_STREAMS.map((f, i) => (
          <span
            key={`stream-${i}`}
            className={`hp-flow${f.w >= 2 ? ' hp-flow--glass' : ''}`}
            style={
              {
                '--x': `${f.x}%`,
                '--w': `${f.w}px`,
                '--dur': `${f.dur}s`,
                '--delay': `${f.delay}s`,
                '--len': `${f.len}px`,
                '--o': f.o,
                '--skew': `${f.skew}deg`,
              } as CSSProperties
            }
          >
            <i className="hp-flow-line" />
            <i className="hp-flow-core" />
            <i className="hp-flow-head" />
          </span>
        ))}
        {WET_BEADS.map((f, i) => (
          <span
            key={`bead-${i}`}
            className="hp-flow hp-flow--bead"
            style={
              {
                '--x': `${f.x}%`,
                '--w': `${f.w}px`,
                '--dur': `${f.dur}s`,
                '--delay': `${f.delay}s`,
                '--len': `${f.len}px`,
                '--o': f.o,
                '--skew': `${f.skew}deg`,
              } as CSSProperties
            }
          >
            <i className="hp-flow-line" />
            <i className="hp-flow-core" />
            <i className="hp-flow-head" />
          </span>
        ))}
      </div>

      <header className="hp-nav">
        <Link className="hp-brand" to="/home">
          <span className="hp-brand-dot" />
          雷馨怡
        </Link>
        <nav className="hp-nav-links" aria-label="页面导航">
          <Link to="/works">作品集</Link>
        </nav>
        <Link className="hp-nav-enter" to="/">
          进入管理系统
          <i aria-hidden="true">→</i>
        </Link>
      </header>

      <section className="hp-hero">
        <div className="hp-hero-scrim" aria-hidden="true" />
        <div className="hp-wrap hp-hero-inner">
          <div className="hp-hero-top">
            <p className="hp-kicker">
              <span className="hp-kicker-line" />
              数字经济 · 本科二年级
            </p>

            <div className="hp-stats">
              <button
                type="button"
                className={`hp-stat hp-stat--like ${justLiked ? 'is-liked' : ''}`}
                onClick={handleLike}
                aria-label="点赞"
              >
                <strong>{likes ?? '—'}</strong>
                <span>
                  <i className="hp-heart">{justLiked ? '♥' : '♡'}</i> 点赞
                </span>
              </button>
              <div className="hp-stat">
                <strong>{views ?? '—'}</strong>
                <span>次访问</span>
              </div>
            </div>
          </div>

          <div className="hp-hero-mid">
            <WipeWord />
          </div>

          <div className="hp-hero-foot">
            <p className="hp-lead">
              用数据讲清商业问题，把分析做成能落地的决策。
              这里是我做过的事，以及正在做的事。
            </p>

            <div className="hp-hero-actions">
              <Link className="hp-btn hp-btn--solid" to="/works">
                查看作品集
                <i aria-hidden="true">→</i>
              </Link>
              <Link className="hp-btn hp-btn--ghost" to="/">
                进入管理系统
              </Link>
              <a className="hp-link-quiet" href={`${baseUrl}resume.pdf`} download>
                下载简历 ↓
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
