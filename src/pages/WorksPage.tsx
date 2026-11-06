import { useEffect, useRef, useState } from 'react'
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

const baseUrl = import.meta.env.BASE_URL

const skillTags = ['SQL', 'Python / pandas', 'Excel 建模', 'Power BI', 'Tableau', '用户调研', '指标体系', 'Git']

const contacts = [
  { label: 'leixinyi@stu.edu.cn', href: 'mailto:leixinyi@stu.edu.cn' },
  { label: 'github.com/leixiny', href: 'https://github.com/leixiny' },
  { label: '微信：leixinyi' },
  { label: '简历 PDF ↓', href: `${baseUrl}resume.pdf`, download: true },
]

function formatDate(ts: string) {
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })
  } catch {
    return ''
  }
}

export default function WorksPage() {
  const [messages, setMessages] = useState<GuestbookRow[]>([])
  const [guestbookState, setGuestbookState] = useState<'loading' | 'ready' | 'offline' | 'error'>('loading')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const sayRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="home-page is-works">
      <header className="hp-nav">
        <Link className="hp-brand" to="/home">
          <span className="hp-brand-dot" />
          雷馨怡
        </Link>
        <nav className="hp-nav-links" aria-label="页面导航">
          <Link to="/works">作品集</Link>
          <button
            type="button"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            联系
          </button>
          <button type="button" onClick={goTalk}>
            留言
          </button>
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
                  <Link to="/home">首页</Link>
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
    </div>
  )
}
