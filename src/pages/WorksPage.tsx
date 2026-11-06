import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import WorksStrip from './WorksStrip'
import './HomePage.css'

/**
 * 作品集：一进来就只有作品 —— 没有标题、没有说明文字。
 * 浅绿水底上一条横向轨道，可以拖动/滚轮快速滑，双指捏合或 Ctrl+滚轮缩放。
 * 联系方式和留言在个人首页下方。
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
    <div className="home-page is-works hp-works-page">
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

      <main className="hp-works-main">
        <WorksStrip />
      </main>
    </div>
  )
}
