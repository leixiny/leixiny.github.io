import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import WorksStrip from './WorksStrip'
import './HomePage.css'

const skillTags = ['SQL', 'Python / pandas', 'Excel 建模', 'Power BI', 'Tableau', '用户调研', '指标体系', 'Git']

/**
 * 作品集是一块独立版面：浅绿水底 + 一条技能带 + 可以横向拖的作品轨。
 * 联系方式和留言在个人首页下方，这里只留一行收尾。
 */
export default function WorksPage() {
  // 滚动进入视口时淡入
  useEffect(() => {
    window.scrollTo(0, 0)
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

  return (
    <div className="home-page is-works">
      <header className="hp-nav">
        <Link className="hp-brand" to="/home">
          <span className="hp-brand-dot" />
          雷馨怡
        </Link>
        <nav className="hp-nav-links" aria-label="页面导航">
          <span className="hp-nav-current" aria-current="page">
            作品集
          </span>
          <Link to="/home?to=contact">留言</Link>
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

      <div className="wp-end">
        <div className="hp-wrap wp-end-row">
          <span>© 2026 雷馨怡 · 作品集</span>
          <Link to="/home">回到首页 ↑</Link>
        </div>
      </div>
    </div>
  )
}
