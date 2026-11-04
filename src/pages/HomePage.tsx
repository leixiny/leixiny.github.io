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

/* ---------- 首屏字标：leixiny 一个个从屏幕右侧滚进来，撞上后自己颤完，下一个才入场 ---------- */
const WORD = 'leixiny'
const LETTER_START = 240 // 第一个字母之前留一点空
const SLAM = 0.16 // 撞上去压进去的深度（em）
const SHAKE_MS = 420 // 撞完自己颤多久
const GAP_MS = 40 // 颤完到下一个字母入场之间的呼吸

type SlamSpec = { startEm: number; rollMs: number; shakeMs: number }

// 一个字母的完整动作：从屏幕右侧滚进来 → 一路摆正 → 撞上去压扁 → 自己颤到停
function slamFrames({ startEm, rollMs, shakeMs }: SlamSpec): Keyframe[] {
  const total = rollMs + shakeMs
  const at = rollMs / total // 撞击点在整体进度上的位置
  const r = (p: number) => +(at * p).toFixed(4) // 滚动段内部比例 → 整体比例
  const s = (p: number) => +(at + (1 - at) * p).toFixed(4) // 颤动段内部比例 → 整体比例
  const pose = (amp: number, sx: number, sy: number) =>
    `translateX(${amp.toFixed(4)}em) rotate(0deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
  return [
    // 滚动段：整块滚过来，竖向几乎不动（贴地滚，不从高处落）
    {
      transform: `translate(${startEm.toFixed(3)}em, ${(-startEm * 0.015).toFixed(3)}em) rotate(-128deg) scale(0.9, 0.97)`,
      opacity: 0,
      offset: 0,
      easing: 'cubic-bezier(.42,0,.9,.42)',
    },
    {
      transform: `translate(${(startEm * 0.8).toFixed(3)}em, ${(-startEm * 0.012).toFixed(3)}em) rotate(-104deg) scale(0.9, 0.98)`,
      opacity: 0.45,
      offset: r(0.14),
    },
    {
      transform: `translate(${(startEm * 0.45).toFixed(3)}em, ${(-startEm * 0.008).toFixed(3)}em) rotate(-72deg) scale(0.91, 0.99)`,
      opacity: 0.9,
      offset: r(0.38),
    },
    {
      transform: `translate(${(startEm * 0.16).toFixed(3)}em, 0em) rotate(-30deg) scale(0.92, 1)`,
      opacity: 1,
      offset: r(0.68),
    },
    // 撞上去：横向压扁、撞进前一个字母一点点
    { transform: pose(-SLAM, 0.68, 1.34), opacity: 1, offset: at, easing: 'cubic-bezier(.14,.94,.3,1.1)' },
    { transform: pose(-SLAM * 0.9, 0.75, 1.27), opacity: 1, offset: s(0.06) },
    // 只有这一个字母自己来回颤，幅度一路衰减，别的字母不动
    { transform: pose(SLAM * 0.42, 1.14, 0.88), opacity: 1, offset: s(0.2), easing: 'cubic-bezier(.3,.9,.4,1)' },
    { transform: pose(-SLAM * 0.34, 0.9, 1.08), opacity: 1, offset: s(0.4), easing: 'cubic-bezier(.3,.9,.4,1)' },
    { transform: pose(SLAM * 0.24, 1.06, 0.95), opacity: 1, offset: s(0.58), easing: 'cubic-bezier(.35,.9,.45,1)' },
    { transform: pose(-SLAM * 0.15, 0.965, 1.03), opacity: 1, offset: s(0.74) },
    { transform: pose(SLAM * 0.085, 1.02, 0.985), opacity: 1, offset: s(0.87) },
    { transform: pose(-SLAM * 0.04, 0.99, 1.01), opacity: 1, offset: s(0.94) },
    // 末帧必须显式给 opacity，否则会回落到 CSS 里的 0
    { transform: 'translateX(0) rotate(0deg) scale(1, 1)', opacity: 1, offset: 1 },
  ]
}

// 每个字母下缘的压深用它自己那一端的颜色，而不是一律压黑，果冻才有颜色
const SHADE_BLUE = [74, 148, 198]
const SHADE_PINK = [224, 138, 156]

function shadeAt(t: number) {
  return SHADE_BLUE.map((b, k) => Math.round(b + (SHADE_PINK[k] - b) * t)).join(', ')
}

// 每个字母字形自己占多高（em）：高光与沉底要贴着字形铺，不能按行框均分，
// 否则光带会落在字形外面的空白里，字就显得平。
const GLYPH_H: Record<string, number> = { l: 0.813, e: 0.576, i: 0.798, x: 0.547, n: 0.561, y: 0.813 }
// 字形下缘到行框底部的距离（em），背景要以基线为底边对齐
const GLYPH_DESC: Record<string, number> = { y: 0.266 }

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
    const letters = Array.from(wrap.querySelectorAll<HTMLElement>('.hp-letter'))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      letters.forEach((el) => { el.style.opacity = '1' })
      return
    }

    // 一个一个来：这个字母从屏幕右侧滚进来 → 撞上 → 自己颤完 → 下一个才滚进来
    const fs = parseFloat(getComputedStyle(wrap).fontSize) || 100
    const vw = window.innerWidth
    let cursor = LETTER_START
    letters.forEach((el) => {
      const r = el.getBoundingClientRect()
      // 起手位置：字母整个停在屏幕右边缘外面（再留 18px 余量）
      const startEm = Math.max(1.6, (vw - r.left + 18) / fs)
      // 距离越远滚得越久，但滚动速度大致一致
      const rollMs = Math.round(Math.min(700, Math.max(380, 210 + startEm * 88)))
      el.animate(slamFrames({ startEm, rollMs, shakeMs: SHAKE_MS }), {
        duration: rollMs + SHAKE_MS,
        delay: cursor,
        easing: 'linear',
        fill: 'both',
      })
      cursor += rollMs + SHAKE_MS + GAP_MS
    })
    const endAt = cursor

    // 鼠标扫过某个字母，它就软软地弹一下
    const started = performance.now()
    const onEnter = (el: HTMLElement) => () => {
      if (performance.now() - started < endAt + 400) return
      el.animate(JELLY_TAP, { duration: 620, easing: 'cubic-bezier(.3,.9,.4,1)' })
    }
    const handlers = letters.map((el) => {
      const fn = onEnter(el)
      el.addEventListener('pointerenter', fn)
      return [el, fn] as const
    })
    return () => handlers.forEach(([el, fn]) => el.removeEventListener('pointerenter', fn))
  }, [])

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
              '--i': i,
              '--lm-shade': shadeAt(i / (WORD.length - 1)),
              '--lm-gh': GLYPH_H[ch] ?? 0.8,
              '--lm-gd': GLYPH_DESC[ch] ?? 0.232,
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
