import { Fragment, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { LEI_H, LEI_LEFT, LEI_LETTERS, LEI_TOP, LEI_W } from './leiStrokes'
import type { LeiSeg } from './leiStrokes'
import lumuUrl from '../assets/lumu.webp'
import './HomePage.css'
import WaterRipple from '../components/WaterRipple'

const baseUrl = import.meta.env.BASE_URL

interface GuestbookRow {
  id: number
  name: string
  message: string
  created_at: string
}

// 页脚只留一个邮箱：别的都收起来，不留痕
const contacts: { label: string; href?: string; download?: boolean }[] = [
  { label: '3121410697@qq.com', href: 'mailto:3121410697@qq.com' },
]

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })
  } catch {
    return ''
  }
}

/* ---------- 首屏字标：玻璃上按笔顺一笔一笔写出来的 Lei，字里透出来的就是底图 ---------- */
const WORD = 'Lei'

// 底图（插画）的宽高比，用来按字标尺寸算取景
const ART_RATIO = 1000 / 1213
// 底图宽度 ≈ 字标宽度：两个人物正好落在三个字母里
const ART_SPAN = 0.78
// 底图落在字标里的对焦点（0~1），正对两张脸
const ART_FOCUS_X = 0.5
const ART_FOCUS_Y = 0.45

// 笔尖：走多快（字体单位/秒）、两个字母之间停多久
const PEN_SPEED = 1050
const PEN_GAP = 110
// 写完到戴上雾光之间留一点空，让最后一笔落稳
const PEN_HOLD = 160

// 遮罩笔触比量到的笔画直径多出来的部分（字体单位）。遮罩只决定“这一段能不能露出来”，
// 外面还有真实字形做裁剪，所以放宽不会让字变粗；只放宽 8 时，e 最左侧鼓出来的那段
// 弧（相邻两笔的外角）会漏在遮罩外，屏幕上就是一个被切掉的口子
const MASK_PAD = 40

// 笔顺直接用字形里量出来的那一套：e 是一笔连写的
// 「从碗口横着出去 → 绕上去兜过顶部 → 顺着左壁下来 → 沿底部绕到右下收笔」，
// 这正是手写 e 的顺序，笔尖一路往前走，不回头。缺的那块以前是遮罩没盖住，
// 靠最后一块“收笔抹匀”补，现在遮罩已经盖满了（见 MASK_PAD），不需要再补笔

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

// 笔迹 = 一段段带圆头的折线，用 stroke-dashoffset 从尾往头收。
// 以前是几百颗印章各自淡入：印章是整段宽的圆盘，笔尖就成了一个鼓包，
// 相邻两颗没接上还会缺口，看过去像笔画一块块跳出来 —— 字母写到一半最明显。
// 现在整条路径一次性收进来，笔尖是一个干净的圆弧在往前走。
type InkPiece = {
  /** 折线路径（点用 dot 画，没有路径） */
  d: string
  /** 遮罩线宽（比这一截的笔迹再宽一圈） */
  w: number
  /** 路径长度，dash 用 */
  len: number
  /** 在这一笔里的起止位置（0~1），真正的时间由 plan() 换算 */
  t0: number
  t1: number
  /** 一个点：圆心，画成一个从小长大的圆（笔点下去就是这么一下） */
  dot?: { cx: number; cy: number }
}

// 相邻两颗笔触的中心距超过中位数的这么多倍 = 提笔换笔
const PEN_LIFT = 2.4
// 一段“假笔迹”：长度是中位数的这么多倍、速度又是中位速度的这么多倍 ——
// 这就是提笔时从上一笔收笔点直接连到下一笔起笔点的那根长线（i 的点最典型：
// 一根 594 单位的长带从竖笔底端直插到点上）。它只是数据上的连线，不是笔画，
// 整段丢掉，改成“提笔 -> 下一笔另起”
const LIFT_LEN = 2.2
const LIFT_SPEED = 4
// 一截折线最多串多少颗笔触：串多了，这一截里笔宽变化太大，遮罩会鼓出字外
const PIECE_SEGS = 4
// 提笔的空档占这一笔多长
const LIFT_GAP = 0.05
// 短过这个长度的一笔（一个点）按“点一下”算时间，不按弧长
const DOT_ARC = 240

const INK: InkPiece[][] = LEI_LETTERS.map((l) => {
  const segs = l.segs
  const segLen = segs.map((s) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1))
  const sorted = [...segLen].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)] || 1

  // 每一段在数据里走多快（长度 / 时间占比）：正常笔迹都差不多，提笔的连线会快出几倍
  const spans = segs.map((s, i) => Math.max(1e-4, (segs[i + 1]?.at ?? 1) - s.at))
  const speeds = segLen.map((len, i) => len / spans[i])
  const medSpeed = [...speeds].sort((a, b) => a - b)[Math.floor(speeds.length / 2)] || 1
  const lift = segs.map(
    (_, i) => segLen[i] > med * LIFT_LEN && speeds[i] > medSpeed * LIFT_SPEED,
  )

  // 1) 断开成 run：丢掉提笔长线，跳过真空白
  const runs: number[][] = []
  let cur: number[] = []
  for (let i = 0; i < segs.length; i++) {
    if (lift[i]) {
      if (cur.length) runs.push(cur)
      cur = []
      continue
    }
    if (cur.length) {
      const prev = segs[cur[cur.length - 1]]
      const gap = Math.hypot(segs[i].x1 - prev.x2, segs[i].y1 - prev.y2)
      if (gap > Math.max(med * PEN_LIFT, 60)) {
        runs.push(cur)
        cur = []
      }
    }
    cur.push(i)
  }
  if (cur.length) runs.push(cur)

  // 2) 笔速：直的地方略快，拐弯处略慢（真人写字就是这样 —— 长竖、长横一气呵成，
  //    转角会顿一下）。差得太狠会让一个角占掉整笔的一半时间，所以只给到 1.7 倍
  const dirOf = (s: LeiSeg) => {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1
    return [(s.x2 - s.x1) / len, (s.y2 - s.y1) / len]
  }
  // 1 = 直，0 = 直角，-1 = 折返
  const straight = (a: LeiSeg, b: LeiSeg) => {
    const [ax, ay] = dirOf(a)
    const [bx, by] = dirOf(b)
    return Math.max(0, (ax * bx + ay * by + 1) / 2)
  }
  const speedOf = (i: number, run: number[], k: number) => {
    const s = segs[i]
    const prev = k > 0 ? segs[run[k - 1]] : null
    const next = k < run.length - 1 ? segs[run[k + 1]] : null
    const st = Math.min(prev ? straight(prev, s) : 1, next ? straight(s, next) : 1)
    return 1 + 0.7 * st
  }

  const weightOf = (run: number[]) => {
    let w = 0
    run.forEach((i, k) => {
      w += segLen[i] / speedOf(i, run, k)
    })
    // 一个点：按“点一下”给个下限，不然零点几毫秒就蹦出来了
    const arc = run.reduce((s, i) => s + segLen[i], 0)
    return arc < DOT_ARC ? Math.max(w, 90 / 2.2) : w
  }
  const weights = runs.map(weightOf)
  const wSum = weights.reduce((a, b) => a + b, 0) || 1
  const gapT = runs.length > 1 ? LIFT_GAP : 0
  const usable = 1 - gapT * (runs.length - 1)

  const n1 = (v: number) => Math.round(v * 10) / 10
  const out: InkPiece[] = []
  let tRun = 0
  runs.forEach((run, ri) => {
    const span = (usable * weights[ri]) / wSum
    const runW = weights[ri] || 1
    const arc = run.reduce((s, i) => s + segLen[i], 0)
    if (arc < DOT_ARC && run.length <= 2) {
      // 点：一句话就写完，别用折线慢慢收，直接一颗圆按下去
      const seg = segs[run[0]]
      out.push({
        d: '',
        w: Math.max(...run.map((i) => segs[i].w)) + MASK_PAD,
        len: 0,
        t0: tRun,
        t1: tRun + span,
        dot: { cx: n1(seg.x1), cy: n1(seg.y1) },
      })
      tRun += span + gapT
      return
    }
    let accW = 0
    for (let s = 0; s < run.length; s += PIECE_SEGS) {
      const part = run.slice(s, s + PIECE_SEGS)
      let d = `M${n1(segs[part[0]].x1)} ${n1(segs[part[0]].y1)}`
      let w = 0
      let len = 0
      let wgt = 0
      part.forEach((i, k) => {
        d += `L${n1(segs[i].x2)} ${n1(segs[i].y2)}`
        w = Math.max(w, segs[i].w)
        len += segLen[i]
        wgt += segLen[i] / speedOf(i, run, s + k)
      })
      accW += wgt
      out.push({
        d,
        w: w + MASK_PAD,
        // 路径两端是圆头，dash 只按中心线算，多给一点保证收满
        len: Math.round(len) + 2,
        t0: tRun + ((accW - wgt) / runW) * span,
        t1: tRun + (accW / runW) * span,
      })
    }
    tRun += span + gapT
  })
  return out
})

// 每个字母遮罩只围住它自己：以前三块遮罩全都开成整词大小，
// 字每帧都在变，遮罩就得每帧重栅格三倍大的面积
const LETTER_BOX = LEI_LETTERS.map((l) => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of l.segs) {
    const r = s.w / 2 + 12
    x0 = Math.min(x0, s.x1 - r, s.x2 - r)
    y0 = Math.min(y0, s.y1 - r, s.y2 - r)
    x1 = Math.max(x1, s.x1 + r, s.x2 + r)
    y1 = Math.max(y1, s.y1 + r, s.y2 + r)
  }
  // 留一圈余量：笔锋和圆头不吃到遮罩边
  const pad = 40
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
})

// 鼠标扫过时，整块字软软弹一下
const JELLY_TAP: Keyframe[] = [
  { transform: 'translateY(0) scale(1, 1)' },
  { transform: 'translateY(4px) scale(1.05, 0.94)' },
  { transform: 'translateY(0) scale(0.975, 1.025)' },
  { transform: 'translateY(0) scale(1.01, 0.99)' },
  { transform: 'translateY(0) scale(1, 1)' },
]

/* 点击字标：字先抖成水波，再往下沉、化成一条条水淌掉，最后重新写一遍 */
type MeltDrop = {
  /** 起滴点（字标盒子内的百分比坐标） */
  x: number
  y: number
  /** 水痕粗细（em，跟着字标字号缩放） */
  w: number
  /** 要淌多远（em） */
  travel: number
  /** 下滑时长（s）、延迟（ms）、轻微倾角（deg） */
  dur: number
  delay: number
  rot: number
}

function WipeWord() {
  const wrapRef = useRef<HTMLHeadingElement>(null)
  // 每点一次换一套 SVG/DOM，手写动画就能从头再来
  const [run, setRun] = useState(0)
  const [drops, setDrops] = useState<MeltDrop[]>([])
  const meltingRef = useRef(false)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    wrap.classList.remove('is-ready', 'is-melt', 'is-glow', 'is-written')
    const svg = wrap.querySelector('svg')
    if (!svg) return
    const masks = Array.from(svg.querySelectorAll<SVGMaskElement>('.hp-mask'))
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
        const letter = LEI_LETTERS[i]
        const dur = Math.max(420, (letter.len / PEN_SPEED) * 1000)
        starts[i] = t
        spans[i] = dur
        // 每一截自己收进来：delay 是笔尖走到这一截起点的时刻，dur 是走完这一截的时间。
        // 前收后起在同一个点上交接，整笔就是一条不停的线
        const pieces = INK[i]
        const inks = mask.querySelectorAll<SVGElement>('.hp-ink, .hp-dot')
        inks.forEach((el, k) => {
          const p = pieces[k]
          if (!p) return
          el.style.setProperty('--delay', `${Math.round(t + p.t0 * dur)}ms`)
          el.style.setProperty('--dur', `${Math.max(18, Math.round((p.t1 - p.t0) * dur))}ms`)
        })
        t += dur + PEN_GAP
      })
      // 水：笔尖走到那一格才攒水，所以每颗水珠的延迟都挂在自己那一笔上
      drips.forEach((el, k) => {
        const d = WORD_DRIPS[k]
        if (!d) return
        const at = (starts[d.letter] ?? 0) + d.at * (spans[d.letter] ?? 0) + d.lag
        el.style.setProperty('--delay', `${Math.round(at)}ms`)
      })
      return t + PEN_HOLD
    }

    // 手写体到位才开始“写”：先写默认字体、等字体回来字宽一变会很跳
    let glowTimer = 0
    const start = () => {
      if (wrap.classList.contains('is-ready')) return
      const total = plan()
      // 等两帧再落笔：首屏底图、预热滤镜、字的第一次栅格都在这一两帧里做完，
      // 让它们跟第一笔错开，起笔才不会先顿一下
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          wrap.classList.add('is-ready')
          readyAt = performance.now() + total + 260
          // 雾光等写完再戴：写字这几秒里，外层那三圈 drop-shadow 每帧都要跟着字重算，
          // 是全流程里最贵的一笔；写完字不再变，滤镜只算一次就能缓存住
          glowTimer = window.setTimeout(() => {
            wrap.classList.add('is-glow')
            requestAnimationFrame(() => wrap.classList.add('is-written'))
          }, Math.round(total))
        }),
      )
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
      if (reduce || meltingRef.current || performance.now() < readyAt) return
      wrap.animate(JELLY_TAP, { duration: 620, easing: 'cubic-bezier(.3,.9,.4,1)' })
    }
    wrap.addEventListener('pointerenter', onEnter)

    // 点一下字：化水 -> 淌掉 -> 重写
    let meltTimer = 0
    const onMelt = () => {
      if (reduce || meltingRef.current || performance.now() < readyAt) return
      meltingRef.current = true
      wrap.classList.add('is-melt')

      // 化成几股水流（不是一把细水珠）：每个字母轮流挑起流点，
      // 横向上互相错开，偏向笔画下半段 —— 水是攒到笔画下缘才淌下来的
      const list: MeltDrop[] = []
      const pickedX: number[] = []
      for (let s = 0; s < 4; s++) {
        const l = LEI_LETTERS[s % LEI_LETTERS.length]
        for (let tries = 0; tries < 12; tries++) {
          const seg = l.segs[Math.floor(Math.random() * l.segs.length)]
          // 水是从笔画下缘淌下来的，起流点压在笔画的低处
          const t = 0.72 + Math.random() * 0.28
          const x = dripX(seg.x1 + (seg.x2 - seg.x1) * t)
          // 起流点横向至少错开 10%，太近会糊成一片
          if (pickedX.some((px) => Math.abs(px - x) < 10)) continue
          const top = dripY(seg.y1 + (seg.y2 - seg.y1) * t)
          pickedX.push(x)
          list.push({
            x,
            y: top,
            // 一股水柱约 30px 宽，末端水滴同一尺寸
            w: 0.0058 + Math.random() * 0.0012,
            // 一路流到首屏底下再消失，不是在中途化掉
            travel: ((100 - top) / 100 + 0.3) * WORD_EM * 1.5,
            dur: 1.6 + Math.random() * 0.6,
            delay: s * 90 + Math.random() * 120,
            rot: Math.random() * 3 - 1.5,
          })
          break
        }
      }
      // 股流晚 220ms 才挂上去：字的滤镜要先栅格化一次，两件贵事挤在同一帧就会先顿一下
      window.setTimeout(() => setDrops(list), 220)

      meltTimer = window.setTimeout(() => {
        meltingRef.current = false
        setDrops([])
        setRun((r) => r + 1)
      }, 2850)
    }
    wrap.addEventListener('pointerdown', onMelt)

    return () => {
      wrap.removeEventListener('pointerenter', onEnter)
      wrap.removeEventListener('pointerdown', onMelt)
      if (meltTimer) window.clearTimeout(meltTimer)
      if (glowTimer) window.clearTimeout(glowTimer)
    }
  }, [run])

  return (
    <h1 className="hp-word" ref={wrapRef} aria-label={WORD} role="img">
      {/* run 变一次就换一套 SVG：笔顺动画和水珠都从头再播 */}
      <Fragment key={run}>
        <svg
          className="hp-word-svg"
          viewBox={`${LEI_LEFT} ${LEI_TOP} ${LEI_W} ${LEI_H}`}
          style={{ width: `${LEI_W / 1000}em`, height: `${LEI_H / 1000}em` }}
          aria-hidden="true"
        >
          <defs>
            {/* 化水用的湍流置换：字边被噪声搅出水波，baseFrequency 自己轻微起伏 */}
            <filter id="hp-melt-f" x="-15%" y="-15%" width="130%" height="150%">
              <feTurbulence type="fractalNoise" baseFrequency="0.02 0.07" numOctaves="1" seed="8" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G" />
            </filter>
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
          {/* 预热：同一个滤镜先在 1px 的小方块上走一遍，点字时才不会临时编译着色器 */}
          <rect className="hp-warm" x={LEI_LEFT} y={LEI_TOP} width={LEI_W} height={LEI_H} filter="url(#hp-melt-f)" opacity={0.004} />
          {LEI_LETTERS.map((l, i) => (
            /* 遮罩只围住这个字母自己（外加一圈余量）：面积小了，每帧重栅格才跟得上 */
            <mask
              key={l.ch}
              id={`hp-mask-${i}`}
              className="hp-mask"
              maskUnits="userSpaceOnUse"
              x={LETTER_BOX[i].x}
              y={LETTER_BOX[i].y}
              width={LETTER_BOX[i].w}
              height={LETTER_BOX[i].h}
            >
              {/* 笔顺：一截折线用 dash 收进来，按 --delay 先后落笔。
                  线宽比量到的笔画直径多 PAD 个字体单位：遮罩只负责“放行”，
                  放开不会让字变粗（外面还有字形裁剪），只是把笔画外凸的弧
                  和相邻两笔的外角一起盖住 —— 只多 8 时 e 最左侧鼓出来的那块
                  会露在遮罩外，看起来像被谁切了个口子 */}
              {INK[i].map((p, k) =>
                p.dot ? (
                  <circle
                    key={k}
                    className="hp-dot"
                    cx={p.dot.cx}
                    cy={p.dot.cy}
                    r={p.w / 2}
                  />
                ) : (
                  <path
                    key={k}
                    className="hp-ink"
                    d={p.d}
                    strokeWidth={p.w}
                    style={{ '--len': p.len } as CSSProperties}
                  />
                ),
              )}
            </mask>
          ))}
        </defs>
        {LEI_LETTERS.map((l, i) => (
          <g key={l.ch} className="hp-glyph-move">
            <text
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
          </g>
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
        {/* 化水时刻的水：从笔画上冒出来，直接进入下滑 */}
        {drops.length > 0 && (
          <div className="hp-wdrips hp-wdrips--melt" aria-hidden="true">
            {drops.map((d, i) => (
              <span
                key={i}
                className="hp-stream"
                style={
                  {
                    left: `${d.x.toFixed(2)}%`,
                    top: `${d.y.toFixed(2)}%`,
                    '--w': `${d.w.toFixed(4)}em`,
                    '--travel': `${d.travel.toFixed(3)}em`,
                    '--dur': `${d.dur.toFixed(2)}s`,
                    '--delay': `${Math.round(d.delay)}ms`,
                    '--rot': `${d.rot.toFixed(1)}deg`,
                  } as CSSProperties
                }
              >
                {/* 一股水 = 一根有圆柱感的水柱（两边亮、中间透）+ 末端水滴 */}
                <i className="hp-stream-body">
                  <i className="hp-stream-shine" />
                </i>
                <i className="hp-bead hp-stream-bead" />
              </span>
            ))}
          </div>
        )}
      </Fragment>
    </h1>
  )
}

export default function HomePage() {
  const [likes, setLikes] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)
  const [justLiked, setJustLiked] = useState(false)
  const wetRef = useRef<HTMLDivElement>(null)

  // 作品页的「留言」带 ?to=contact 过来：落到位后滚到页脚，并把光标放进输入框
  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] || '')
    if (q.get('to') !== 'contact') return
    const t = window.setTimeout(() => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      window.setTimeout(() => sayRef.current?.focus({ preventScroll: true }), 420)
    }, 260)
    return () => window.clearTimeout(t)
  }, [])

  // 水层是满屏固定的（滚动时也一直淌），出了首屏就淡掉、并停掉动画，别让白底页面上挂着一道水
  useEffect(() => {
    const el = wetRef.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const span = Math.max(1, window.innerHeight)
      const p = Math.min(1, Math.max(0, window.scrollY / (span * 0.85)))
      el.style.setProperty('--wet-o', String(+((1 - p) ** 1.4).toFixed(3)))
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

  // 页脚留言：读写 guestbook，实时订阅新留言
  const [messages, setMessages] = useState<GuestbookRow[]>([])
  const [guestbookState, setGuestbookState] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const sayRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setGuestbookState('offline')
      return
    }
    let channel: ReturnType<typeof supabase.channel> | undefined

    ;(async () => {
      try {
        const gb = await supabase
          .from('guestbook')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (gb.error) throw gb.error
        setMessages(gb.data ?? [])
        setGuestbookState('ready')
      } catch (err) {
        console.error('留言功能初始化失败', err)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) {
      setNotice('先写一句话再发布')
      sayRef.current?.focus()
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
      setNotice('发布失败，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  // 导航里的「留言」：滚到底部那块，顺手把光标放进输入框
  function goTalk() {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    window.setTimeout(() => sayRef.current?.focus({ preventScroll: true }), 420)
  }

  const interactDisabled = guestbookState === 'offline' || guestbookState === 'error'

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
            /* 只有最粗的三道做“背景折射”：backdrop-filter 的元素每帧都要重读背后的画面再模糊一遍，
               十来道一起动，GPU 会被吃光，字就跟着掉帧 */
            className={`hp-flow${f.w >= 2.6 ? ' hp-flow--glass' : ''}`}
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
          <button type="button" onClick={goTalk}>
            留言
          </button>
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

      {/* 联系与留言收进页脚：小字、浅色，不占版块 */}
      <footer id="contact" className="hp-foot">
        <div className="hp-wrap">
          <div className="hp-foot-grid">
            <div className="hp-foot-brand">
              <Link to="/home" className="hp-foot-name">
                雷馨怡
              </Link>
              <p>
                数字经济 · 本科二年级
                <br />
                用数据讲清商业问题，把分析做成能落地的决策。
              </p>
            </div>

            <nav className="hp-foot-col" aria-label="联系">
              <h3>联系</h3>
              <ul>
                {contacts.map((c) =>
                  c.href ? (
                    <li key={c.label}>
                      <a href={c.href} download={c.download}>
                        {c.label}
                      </a>
                    </li>
                  ) : (
                    <li key={c.label}>
                      <span>{c.label}</span>
                    </li>
                  ),
                )}
              </ul>
            </nav>

            <div className="hp-foot-col hp-foot-say">
              <h3>留言</h3>
              <form className="hp-say" onSubmit={handleSubmit}>
                <input
                  className="hp-say-name"
                  value={name}
                  maxLength={24}
                  disabled={interactDisabled}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="昵称"
                  aria-label="昵称，可留空"
                />
                <input
                  ref={sayRef}
                  className="hp-say-text"
                  value={message}
                  maxLength={200}
                  disabled={interactDisabled}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    if (notice) setNotice('')
                  }}
                  placeholder="留一句话…"
                  aria-label="留言内容"
                />
                <button type="submit" disabled={submitting || interactDisabled} aria-label="发布留言">
                  {submitting ? '…' : '↑'}
                </button>
              </form>

              {(notice || interactDisabled) && (
                <p className="hp-say-note">
                  {notice
                    || (guestbookState === 'offline' ? '留言暂未接通，配好数据库就活' : '留言暂时不可用')}
                </p>
              )}

              <ul className="hp-say-log">
                {messages.slice(0, 2).map((m) => (
                  <li key={m.id}>
                    <strong>{m.name || '访客'}</strong>
                    <span>{m.message}</span>
                    <time>{formatDate(m.created_at)}</time>
                  </li>
                ))}
                {guestbookState === 'loading' && <li className="is-empty">正在读取留言…</li>}
                {guestbookState === 'ready' && !messages.length && <li className="is-empty">还没有留言</li>}
              </ul>
              {messages.length > 2 && <p className="hp-say-count">共 {messages.length} 条</p>}
            </div>

            <nav className="hp-foot-col" aria-label="更多">
              <h3>更多</h3>
              <ul>
                <li>
                  <Link to="/works">作品集</Link>
                </li>
                <li>
                  <Link to="/">管理系统</Link>
                </li>
                <li>
                  <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                    回到顶部 ↑
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          <div className="hp-foot-base">
            <span>© 2026 雷馨怡</span>
            <span>数字经济专业</span>
            <span className="hp-foot-base-end">React · Supabase</span>
          </div>
        </div>
      </footer>

      <WaterRipple />
    </div>
  )
}
