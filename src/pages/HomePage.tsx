import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import './HomePage.css'

interface GuestbookRow {
  id: number
  name: string
  message: string
  created_at: string
}

const skillTags = ['SQL', 'Python / pandas', 'Excel 建模', 'Power BI', 'Tableau', '用户调研', '指标体系', 'Git']

const contacts = [
  { label: '邮箱', value: 'leixinyi@stu.edu.cn', href: 'mailto:leixinyi@stu.edu.cn' },
  { label: 'GitHub', value: 'github.com/leixiny', href: 'https://github.com/leixiny' },
  { label: '微信', value: 'leixinyi' },
  { label: '简历', value: 'resume.pdf', href: 'resume.pdf', download: true },
]

const baseUrl = import.meta.env.BASE_URL

function formatDateTime(ts: string) {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ---------- 首屏字标：LuMu，被一笔擦出来 ---------- */
const WORD = 'LuMu'

// 与 CSS 里的 hp-sweep / hp-sheen 保持一致
const WIPE_DELAY = 260
const WIPE_DURATION = 1400
const WIPE_EASE = [0.25, 0.35, 0.35, 1] as const
// 笔触前沿蒙版 240% 宽，边缘在蒙版 60% 处；位移 104% → 24% 扫过整屏
const MASK_SCALE = 2.4
const MASK_EDGE = 0.6
const WIPE_FROM = 1.04
const WIPE_TO = 0.24

// 蒙版位移 → 笔触前沿在屏幕上的横向位置（以屏宽为 1）
const edgeAt = (position: number) => (1 - MASK_SCALE) * position + MASK_SCALE * MASK_EDGE
// 反过来：前沿扫到 x 时，蒙版位移走到哪儿了
const positionAt = (x: number) => (edgeAt(0) - x) / (MASK_SCALE - 1)

// 缓动曲线采样表：把「进度」反查成「时间」，字母才能踩在笔触路过它的那一刻
const EASE_TABLE = Array.from({ length: 97 }, (_, i) => {
  const t = i / 96
  const [x1, y1, x2, y2] = WIPE_EASE
  const bx = 3 * (x2 - x1) - 3 * x1
  const ax = 1 - 3 * x1 - bx
  const by = 3 * (y2 - y1) - 3 * y1
  const ay = 1 - 3 * y1 - by
  const x = ax * t ** 3 + bx * t ** 2 + 3 * x1 * t
  const y = ay * t ** 3 + by * t ** 2 + 3 * y1 * t
  return { x, y }
})

function timeAt(progress: number) {
  const p = Math.min(1, Math.max(0, progress))
  for (let i = 1; i < EASE_TABLE.length; i += 1) {
    const a = EASE_TABLE[i - 1]
    const b = EASE_TABLE[i]
    if (p <= b.y) {
      const k = b.y === a.y ? 0 : (p - a.y) / (b.y - a.y)
      return a.x + (b.x - a.x) * k
    }
  }
  return 1
}

// 每个字母下缘的压深用它自己那一端的颜色，而不是一律压黑，果冻才有颜色
const SHADE_BLUE = [74, 148, 198]
const SHADE_PINK = [224, 138, 156]

function shadeAt(t: number) {
  return SHADE_BLUE.map((b, k) => Math.round(b + (SHADE_PINK[k] - b) * t)).join(', ')
}

// 每个字母字形自己占多高（em）：高光与沉底要贴着字形铺，不能按行框均分
const GLYPH_H: Record<string, number> = { L: 0.723, u: 0.532, M: 0.723 }

// 字母被擦过的那一下：从雾里的虚影收成实体（糊 → 清）
const LETTER_FILTER =
  'saturate(1.28) drop-shadow(0 2px 0 rgba(6, 20, 46, 0.44)) drop-shadow(0 12px 22px rgba(3, 12, 26, 0.5)) drop-shadow(0 0 22px rgba(150, 214, 255, 0.16))'

const WIPE_POP: Keyframe[] = [
  {
    filter: `blur(5px) saturate(1.1) drop-shadow(0 2px 0 rgba(6, 20, 46, 0.3)) drop-shadow(0 10px 20px rgba(3, 12, 26, 0.4)) drop-shadow(0 0 30px rgba(190, 238, 255, 0.5))`,
    transform: 'scale(1.035, 0.99)',
    offset: 0,
  },
  {
    filter: `blur(1.2px) saturate(1.24) drop-shadow(0 2px 0 rgba(6, 20, 46, 0.4)) drop-shadow(0 12px 22px rgba(3, 12, 26, 0.46)) drop-shadow(0 0 24px rgba(170, 226, 255, 0.28))`,
    transform: 'scale(1.01, 0.997)',
    offset: 0.45,
  },
  { filter: LETTER_FILTER, transform: 'scale(1, 1)', offset: 1 },
]

const JELLY_TAP: Keyframe[] = [
  { transform: 'translateY(0) scale(1, 1)' },
  { transform: 'translateY(3px) scale(1.12, 0.86)' },
  { transform: 'translateY(0) scale(.94, 1.07)' },
  { transform: 'translateY(0) scale(1.02, .98)' },
  { transform: 'translateY(0) scale(1, 1)' },
]

function JellyWord() {
  const wrapRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const letters = Array.from(wrap.querySelectorAll<HTMLElement>('.hp-letter'))
    const hero = wrap.closest('.hp-hero') as HTMLElement | null
    const heroLeft = hero ? hero.getBoundingClientRect().left : 0
    const width = (hero ? hero.clientWidth : window.innerWidth) || 1

    // 笔触前沿扫到哪个字母，那个字母就在那一刻从雾里浮出来
    letters.forEach((el) => {
      const r = el.getBoundingClientRect()
      const cx = (r.left - heroLeft) / width
      const p = Math.min(WIPE_FROM, Math.max(WIPE_TO, positionAt(cx)))
      const progress = (WIPE_FROM - p) / (WIPE_FROM - WIPE_TO)
      const at = WIPE_DELAY + WIPE_DURATION * timeAt(progress) * 0.97

      // 透明度单独一条（带 fill），动画结束后仍保留，悬停的 filter 才不被顶掉
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200,
        delay: at,
        fill: 'both',
        easing: 'linear',
      })
      el.animate(WIPE_POP, {
        duration: 470,
        delay: at,
        easing: 'cubic-bezier(.2,.7,.3,1)',
      })
    })

    // 鼠标扫过某个字母，它就软软地弹一下（擦拭期间不响应）
    const readyAt = performance.now() + WIPE_DELAY + WIPE_DURATION + 300
    const onEnter = (el: HTMLElement) => () => {
      if (performance.now() < readyAt) return
      el.animate(JELLY_TAP, { duration: 620, easing: 'cubic-bezier(.3,.9,.4,1)' })
    }
    const handlers = letters.map((el) => {
      const fn = onEnter(el)
      el.addEventListener('pointerenter', fn)
      return [el, fn] as const
    })
    return () => handlers.forEach(([el, fn]) => el.removeEventListener('pointerenter', fn))
  }, [])

  const n = WORD.length - 1

  return (
    <h1 className="hp-word" ref={wrapRef} aria-label={WORD}>
      {WORD.split('').map((ch, i) => (
        <span
          key={i}
          className="hp-letter"
          data-ch={ch}
          aria-hidden="true"
          style={
            {
              '--bp': `${(i / n) * 100}%`,
              '--lm-shade': shadeAt(i / n),
              '--lm-gh': GLYPH_H[ch] ?? 0.72,
            } as React.CSSProperties
          }
        >
          {ch}
        </span>
      ))}
    </h1>
  )
}

export default function HomePage() {
  const [likes, setLikes] = useState<number | null>(null)
  const [views, setViews] = useState<number | null>(null)
  const [justLiked, setJustLiked] = useState(false)
  const [messages, setMessages] = useState<GuestbookRow[]>([])
  const [guestbookState, setGuestbookState] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  // 滚动进入视口时淡入
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)'))
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
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setGuestbookState('offline')
      return
    }
    let channel: ReturnType<typeof supabase.channel> | undefined

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

        const gb = await supabase
          .from('guestbook')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)
        if (gb.error) throw gb.error
        setMessages(gb.data ?? [])
        setGuestbookState('ready')
      } catch (err) {
        console.error('互动功能初始化失败', err)
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

  async function handleLike() {
    if (justLiked) return
    setJustLiked(true)
    try {
      const { data, error } = await supabase.rpc('increment_stat', { stat_key: 'likes' })
      if (error) throw error
      if (typeof data === 'number') setLikes(data)
    } catch (err) {
      console.error(err)
      setNotice('点赞失败，请稍后再试')
    }
    setTimeout(() => setJustLiked(false), 900)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) {
      setNotice('先写点内容再发布')
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
      setNotice('发布失败：' + ((err as Error).message || '请稍后再试'))
    } finally {
      setSubmitting(false)
    }
  }

  const interactDisabled = guestbookState === 'offline' || guestbookState === 'error'

  return (
    <div className="home-page">
      <header className="hp-nav">
        <Link className="hp-brand" to="/home">
          <span className="hp-brand-dot" />
          雷馨怡
        </Link>
        <nav className="hp-nav-links" aria-label="页面导航">
          <Link to="/works">作品集</Link>
          <button type="button" onClick={() => scrollToSection('contact')}>联系</button>
          <button type="button" onClick={() => scrollToSection('talk')}>留言</button>
        </nav>
        <Link className="hp-nav-enter" to="/">
          进入管理系统
          <i aria-hidden="true">→</i>
        </Link>
      </header>

      <section className="hp-hero">
        <div className="hp-hero-reveal" aria-hidden="true">
          <div className="hp-hero-window" />
        </div>
        <div className="hp-hero-scrim" aria-hidden="true" />
        <div className="hp-hero-glow" aria-hidden="true" />
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
            <JellyWord />
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

      <section className="hp-skills" aria-label="技能">
        <div className="hp-wrap hp-skills-row">
          <span className="hp-skills-label">技能</span>
          <ul>
            {skillTags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="contact" className="hp-contact">
        <div className="hp-wrap">
          <div className="hp-sec-head" data-reveal>
            <p className="hp-sec-label">01 — 联系</p>
            <h2>随时可以找我</h2>
          </div>

          <div className="hp-contact-list">
            {contacts.map((c) =>
              c.href ? (
                <a key={c.label} className="hp-contact-row" href={c.href} download={c.download} data-reveal>
                  <span className="hp-contact-label">{c.label}</span>
                  <span className="hp-contact-value">{c.value}</span>
                  <span className="hp-contact-arrow" aria-hidden="true">↗</span>
                </a>
              ) : (
                <div key={c.label} className="hp-contact-row is-static" data-reveal>
                  <span className="hp-contact-label">{c.label}</span>
                  <span className="hp-contact-value">{c.value}</span>
                  <span className="hp-contact-arrow" aria-hidden="true">·</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="talk" className="hp-talk">
        <div className="hp-wrap">
          <div className="hp-sec-head" data-reveal>
            <p className="hp-sec-label">02 — 留言</p>
            <h2>这一页是活的，说句话吧</h2>
          </div>

          {interactDisabled && (
            <p className="hp-note">
              {guestbookState === 'offline'
                ? '留言功能尚未接入 Supabase：配置 .env.local 后重启即可激活。'
                : '留言功能暂时不可用：请确认网络可以访问 Supabase。'}
            </p>
          )}

          <div className="hp-talk-grid">
            <form className="hp-form" onSubmit={handleSubmit}>
              <label className="hp-field">
                <span>怎么称呼你？（可留空）</span>
                <input
                  value={name}
                  maxLength={24}
                  disabled={interactDisabled}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="访客"
                />
              </label>
              <label className="hp-field">
                <span>
                  写点什么
                  <em>{message.length} / 200</em>
                </span>
                <textarea
                  value={message}
                  maxLength={200}
                  disabled={interactDisabled}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="留一句想对我说的话…"
                />
              </label>
              {notice && <p className="hp-error">{notice}</p>}
              <button type="submit" className="hp-btn hp-btn--solid" disabled={submitting || interactDisabled}>
                {submitting ? '发布中…' : '发布留言'}
              </button>
            </form>

            <div className="hp-messages">
              {guestbookState === 'loading' && <p className="hp-note">正在加载留言…</p>}
              {guestbookState === 'ready' && messages.length === 0 && (
                <p className="hp-note">还没有留言，来做第一个吧。</p>
              )}
              {messages.map((m) => (
                <article key={m.id} className="hp-msg">
                  <header>
                    <strong>{m.name || '访客'}</strong>
                    <time>{formatDateTime(m.created_at)}</time>
                  </header>
                  <p>{m.message}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="hp-footer">
        <div className="hp-wrap hp-footer-row">
          <span>© 2026 雷馨怡</span>
          <span className="hp-footer-mid">数字经济专业 · SupaProject</span>
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            回到顶部 ↑
          </button>
        </div>
      </footer>
    </div>
  )
}
