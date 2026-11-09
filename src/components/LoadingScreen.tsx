import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import ribbonPoster from '../assets/loading-ribbon.webp'
import './LoadingScreen.css'

/**
 * 首屏加载页：一段黑丝带视频打底 + 一块液态玻璃，玻璃里是会翻字的 Loading。
 *
 * 视频原先是收尾那一屏（留言）的背景，现在挪到开场：6 秒循环，
 * 上下都是纯黑，中间一条青绿高光横向淌过去 —— 正好衬得住一块横向的胶囊玻璃。
 *
 * 这一段是本地 157KB 的 mp4（从 mux 那支 6 秒片的最低档分片拼出来的单个 fMP4，
 * 480×270，本来就压在 blur 和暗色蒙版底下，看不清分辨率）。
 * 早先直接挂 mux 的 m3u8：manifest 要 1.1s 才回来，加载页 1.5s 就淡出了 ——
 * 用户实际只看到一张静止封面，还白搭了 362KB 的 hls.js。
 * 换成同源小文件后首帧几十毫秒就出来，整条 hls 依赖也一起删了。
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

/* 同一条黑丝带，本地一份。放在 public/ 是为了路径固定 —— index.html 里提前
   preload 它，下载就能和 bundle 解析并行，不必等 React 挂载才问 CDN 要。
   封面是同一支片截的一帧 webp：视频还在解码的那几十毫秒里先顶上，不至于闪一下黑 */
const VIDEO_SRC = '/loading-ribbon.mp4'

export default function LoadingScreen({ leaving = false }: { leaving?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    // 关了动效，或手机开了省流量：这一屏只是过场，静帧就够
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      v.pause()
      v.removeAttribute('autoplay')
      return
    }
    if (conn?.saveData) {
      v.preload = 'none'
      v.pause()
      return
    }

    void v.play().catch(() => {})
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
          src={VIDEO_SRC}
          poster={ribbonPoster}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          disablePictureInPicture
        />
        <span className="ld-grade" />
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
