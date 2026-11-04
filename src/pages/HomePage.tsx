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

/* ---------- 首屏字标：leixiny 逐个从右边撞进来，撞得前面的字母往左退 ---------- */
const WORD = 'leixiny'
const LETTER_STAGGER = 255 // 每个字母之间的间隔
const LETTER_DURATION = 760
const LETTER_START = 240
const IMPACT_AT = 0.46 // 撞上的那一瞬在关键帧里的位置
const SLAM = 0.16 // 撞进前一个字母的深度（em）
const KNOCK = 0.15 // 被撞的字母往左退的深度（em）

// 撞进来的那个字母：横向压扁、纵向拉长，再回弹站直
const JELLY_SLAM: Keyframe[] = [
  {
    // 从右边更高处抛进来，落到基线上再撞上去
    transform: `translate(${SLAM * 6.6}em, ${-SLAM * 1.5}em) scale(0.9, 1.08)`,
    opacity: 0,
    offset: 0,
    easing: 'cubic-bezier(.6,0,.92,.35)',
  },
  { transform: `translate(${SLAM * 5.6}em, ${-SLAM * 1.3}em) scale(0.92, 1.06)`, opacity: 1, offset: 0.07 },
  { transform: `translate(${SLAM * 3}em, ${-SLAM * 0.7}em) scale(0.94, 1.04)`, opacity: 1, offset: 0.26 },
  {
    transform: `translateX(${-SLAM}em) scale(0.7, 1.32)`,
    opacity: 1,
    offset: IMPACT_AT,
    easing: 'cubic-bezier(.12,.96,.3,1.16)',
  },
  {
    transform: `translateX(${-SLAM * 0.86}em) scale(0.76, 1.26)`,
    opacity: 1,
    offset: IMPACT_AT + 0.06,
  },
  {
    transform: `translateX(${SLAM * 0.34}em) scale(1.12, 0.9)`,
    opacity: 1,
    offset: 0.7,
    easing: 'cubic-bezier(.3,.9,.4,1)',
  },
  { transform: `translateX(${-SLAM * 0.12}em) scale(0.98, 1.02)`, opacity: 1, offset: 0.86 },
  // 末帧必须显式给 opacity，否则会回落到 CSS 里的 0
  { transform: 'translateX(0) scale(1, 1)', opacity: 1, offset: 1 },
]

// 被撞到的字母：先被顶得往左闪一格、压扁，再弹回原位
function knockFrames(amp: number): Keyframe[] {
  return [
    { transform: 'translateX(0) scale(1, 1)', offset: 0 },
    {
      transform: `translateX(${-amp}em) scale(${1 + amp * 1.8}, ${1 - amp * 1.1})`,
      offset: 0.16,
      easing: 'cubic-bezier(.2,.8,.4,1)',
    },
    {
      transform: `translateX(${amp * 0.36}em) scale(${1 - amp * 0.8}, ${1 + amp * 0.55})`,
      offset: 0.44,
      easing: 'cubic-bezier(.3,.9,.4,1)',
    },
    { transform: `translateX(${-amp * 0.12}em) scale(1.012, 0.99)`, offset: 0.72 },
    { transform: 'translateX(0) scale(1, 1)', offset: 1 },
  ]
}

// 每个字母下缘的压深用它自己那一端的颜色，而不是一律压黑，果冻才有颜色
const SHADE_BLUE = [74, 148, 198]
const SHADE_PINK = [224, 138, 156]

function shadeAt(t: number) {
  return SHADE_BLUE.map((b, k) => Math.round(b + (SHADE_PINK[k] - b) * t)).join(', ')
}

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

    // 一个一个撞进来：每个字母从右侧滑入，撞上前一个，再被弹回自己的格子
    letters.forEach((el, i) => {
      el.animate(JELLY_SLAM, {
        duration: LETTER_DURATION,
        delay: LETTER_START + i * LETTER_STAGGER,
        easing: 'linear',
        fill: 'both',
      })
    })

    // 撞击的力沿着这一行往左传：越远越轻、越晚，像多米诺
    letters.forEach((_, i) => {
      if (i === 0) return
      const impact = LETTER_START + i * LETTER_STAGGER + LETTER_DURATION * IMPACT_AT
      for (let d = 1; d <= 4; d++) {
        const j = i - d
        if (j < 0) break
        const amp = KNOCK * Math.pow(0.68, d - 1)
        letters[j].animate(knockFrames(amp), {
          duration: 620 - d * 60,
          delay: impact + (d - 1) * 38,
          easing: 'linear',
          // 叠加在字母自己的入场动画上：入场管“站到哪”，这一下管“被撞退多少”
          composite: 'add',
        })
      }

    })

    // 鼠标扫过某个字母，它就软软地弹一下
    const started = performance.now()
    const onEnter = (el: HTMLElement) => () => {
      if (performance.now() - started < LETTER_START + letters.length * LETTER_STAGGER + 500) return
      el.animate(JELLY_TAP, { duration: 560, easing: 'cubic-bezier(.3,.9,.4,1)' })
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
