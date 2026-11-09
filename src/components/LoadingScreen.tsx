import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type HlsPlayer from 'hls.js'
import ribbonPoster from '../assets/loading-ribbon.webp'
import './LoadingScreen.css'

/**
 * 首屏加载页：一段黑丝带视频打底 + 一块液态玻璃，玻璃里是会翻字的 Loading。
 *
 * 视频原先是收尾那一屏（留言）的背景，现在挪到开场：6 秒无缝循环，
 * 上下都是纯黑，中间一条青绿高光横向淌过去 —— 正好衬得住一块横向的胶囊玻璃。
 * hls.js 是动态导入的：它 160KB，不该跟着首屏包一起下来；而且是手机流量 / 省流量模式
 * 或者系统里关了动效时，连拉都不拉，只留一张封面。
 *
 * 玻璃本体用的是 index.css 里那套 .liquid-glass-strong（Tailwind `@layer components`）：
 * 几乎全透的底 + blur(50px) + 一圈 1.4px、中段渐隐的描边 —— 描边亮在两头、
 * 在中段化到没有，玻璃的边界才是「光」，不是一圈框。
 * 这里把白描边换成橹穆应援色（顶蓝 #aee4ff / 底粉 #ffccd5），
 * 并在玻璃背后铺一层左蓝右粉的光：blur 会把那团光拉进玻璃里，蓝粉不用涂在玻璃上。
 *
 * 「Loa」先摆在那儿，i / n / g 依次被拎起来、向后翻倒，再拍回字里 ——
 * 落地那一下自己压成扁的，同时把前一个字母撞得往左退一格再弹回来，像果冻。
 * 节奏全写在 LoadingScreen.css：2000ms 一个循环，每 280ms 落一个，
 * 落点（16%）和前一个字母的 --r 对齐。
 */

/** 每一格：被拎起来的时刻，和被撞后回弹的时刻（ms，同一个 2000ms 周期里） */
const LETTERS: { ch: string; flip?: number; hit?: number }[] = [
  { ch: 'L' },
  { ch: 'o' },
  { ch: 'a' },
  { ch: 'd', hit: 320 },
  { ch: 'i', flip: 0, hit: 600 },
  { ch: 'n', flip: 280, hit: 880 },
  { ch: 'g', flip: 560 },
]

/* 同一条黑丝带。封面是本地一张 26KB 的 webp（从视频里截的一帧），
   跟 bundle 一起下来，不用等 mux 的图床 —— 上一版让它走远端，
   窗口 load 被拖到 1.6s，加载页多停了小半秒，还经常来不及显示 */
const HLS_SRC = 'https://stream.mux.com/Jwr2RhmsNrd6GEspBNgm02vJsRZAGlaoQIh4AucGdASw.m3u8'

export default function LoadingScreen({ leaving = false }: { leaving?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    // 关了动效，或手机开了省流量：这一屏只是过场，不值得为它拉一段流
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (conn?.saveData) return

    let hls: HlsPlayer | null = null
    let dead = false
    let timer = 0

    async function boot() {
      if (dead || !v) return

      /* 先让首屏的画面出来（加载页自己的底图和玻璃），再拉流 ——
         它跟首包的字体、底图抢带宽。
         用轻量构建 hls.js/light：字幕、备用音轨这一层背景用不到，体积小一截 */
      const { default: Hls } = await import('hls.js/light')
      if (dead) return

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          // 这层视频压在一块 blur + 暗色蒙版之下，按容器尺寸挑档就够，不必给到最高清；
          // 再从最低一档起播：封面只等它几十毫秒，不是几秒
          capLevelToPlayerSize: true,
          startLevel: 0,
          maxBufferLength: 3,
        })
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void v?.play().catch(() => {})
        })
        hls.loadSource(HLS_SRC)
        hls.attachMedia(v)
        return
      }

      // Safari 原生就能放 m3u8
      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = HLS_SRC
        void v.play().catch(() => {})
      }
    }

    timer = window.setTimeout(() => void boot(), 140)

    return () => {
      dead = true
      window.clearTimeout(timer)
      hls?.destroy()
    }
  }, [])

  return (
    <div
      className={leaving ? 'ld-screen is-out' : 'ld-screen'}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* 底：丝带视频 + 应援色的两团光 + 压暗的蒙版 */}
      <div className="ld-film" aria-hidden="true">
        <video
          ref={videoRef}
          className="ld-video"
          poster={ribbonPoster}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          tabIndex={-1}
          disablePictureInPicture
        />
        <span className="ld-tint ld-tint--blue" />
        <span className="ld-tint ld-tint--pink" />
        <span className="ld-veil" />
      </div>

      <div className="ld-stage">
        {/* 左蓝右粉的一团光：玻璃的大半径 blur 会把它拉进去，成玻璃里的蓝粉 */}
        <span className="ld-glow" aria-hidden="true" />

        <div className="ld-glass liquid-glass-strong rounded-full">
          {/* 斜向折射光带：主光带 + 一道更细的副光，全画面唯一的「斜」 */}
          <span className="ld-band" aria-hidden="true" />

          <p className="ld-word" aria-hidden="true">
            {LETTERS.map((l) => (
              <span
                key={l.ch}
                className={l.flip === undefined ? 'ld-l' : 'ld-l is-flip'}
                style={{ '--d': `${l.flip ?? 0}ms` } as CSSProperties}
              >
                <span
                  className={l.hit === undefined ? 'ld-g' : 'ld-g is-hit'}
                  style={{ '--r': `${l.hit ?? 0}ms` } as CSSProperties}
                >
                  {l.ch}
                </span>
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  )
}
