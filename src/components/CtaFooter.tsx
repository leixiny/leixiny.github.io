import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type HlsPlayer from 'hls.js'
import './CtaFooter.css'

/* 6 秒无缝循环的一段黑丝带：中间一条青色高光和一道细亮边，上下都是纯黑，
   正好在上面压白字。封面图先顶上，进视野了才真的拉流 */
const HLS_SRC = 'https://stream.mux.com/Jwr2RhmsNrd6GEspBNgm02vJsRZAGlaoQIh4AucGdASw.m3u8'
const POSTER =
  'https://image.mux.com/Jwr2RhmsNrd6GEspBNgm02vJsRZAGlaoQIh4AucGdASw/thumbnail.webp?time=2&width=1600'

type Props = {
  onTalk: () => void
  onGrowth: () => void
  children: ReactNode
}

export default function CtaFooter({ onTalk, onGrowth, children }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    // 系统里开了「减少动态」就只留封面：这一屏是装饰，不值得为它动起来
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let hls: HlsPlayer | null = null
    let dead = false
    let booted = false

    async function boot() {
      if (dead || booted || !v) return
      booted = true

      /* 按需加载：hls.js 有 160KB，不该跟着首页首包一起下来。
         必须先问 Hls.isSupported() —— Edge/Chrome 对
         `canPlayType('application/vnd.apple.mpegurl')` 会回一句 "maybe"，
         照那个答案走原生路径，结果就是一张永远不动的封面 */
      const { default: Hls } = await import('hls.js')
      if (dead) return

      if (Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: true,
          maxBufferLength: 8,
        })
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void v?.play().catch(() => {})
        })
        hls.loadSource(HLS_SRC)
        hls.attachMedia(v)
        return
      }

      // Safari 走这条：原生就能放 m3u8
      if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = HLS_SRC
        void v.play().catch(() => {})
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            void boot()
            void v.play().catch(() => {})
          } else {
            // 滚出视野就停：这层模糊视频一直在解码，没必要替它烧电
            v.pause()
          }
        }
      },
      { rootMargin: '320px 0px' },
    )
    io.observe(v)

    return () => {
      dead = true
      io.disconnect()
      hls?.destroy()
    }
  }, [])

  return (
    <section id="contact" className="cta">
      <div className="cta-stage">
        <video
          ref={videoRef}
          className="cta-video"
          poster={POSTER}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* 视频本身是青绿色调，两团 screen 光把它拉到应援色的蓝与粉上 */}
        <span className="cta-tint cta-tint--blue" aria-hidden="true" />
        <span className="cta-tint cta-tint--pink" aria-hidden="true" />
        <span className="cta-veil" aria-hidden="true" />

        <div className="cta-inner">
          <p className="cta-kicker">
            <i aria-hidden="true" />
            一起做点东西
          </p>

          <h2 className="cta-title">
            有想聊的，
            <br />
            <em>随时开口</em>。
          </h2>

          <p className="cta-lead">
            手上有项目、有看不懂的数据，或者只是一个还没想清楚的方向。
            <br />
            留一句话就行
            <span className="cta-lead-more"> —— 不用准备，也不用先想好要问什么</span>。
          </p>

          <div className="cta-actions">
            <button
              type="button"
              className="cta-btn cta-btn--glass liquid-glass-strong"
              onClick={onTalk}
            >
              给我留言
              <ArrowUpRight size={18} strokeWidth={1.7} aria-hidden="true" />
            </button>
            <a className="cta-btn cta-btn--solid" href="showcase.html">
              看作品集
              <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {children}

      <div className="cta-bar">
        <div className="cta-wrap cta-bar-row">
          <p>© 2026 雷馨怡 · 数字经济专业</p>
          <nav className="cta-bar-links" aria-label="页脚导航">
            <a href="showcase.html">作品集</a>
            <button type="button" onClick={onGrowth}>
              个人成长
            </button>
            <Link to="/app">管理系统</Link>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              回到顶部 ↑
            </button>
          </nav>
        </div>
      </div>
    </section>
  )
}
