import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import WorksStrip from './WorksStrip'
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

export default function WorksPage() {
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
          <button type="button" onClick={() => scrollToSection('contact')}>联系</button>
          <button type="button" onClick={() => scrollToSection('talk')}>留言</button>
        </nav>
        <Link className="hp-nav-enter" to="/">
          进入管理系统
          <i aria-hidden="true">→</i>
        </Link>
      </header>

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

      <WorksStrip />

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
