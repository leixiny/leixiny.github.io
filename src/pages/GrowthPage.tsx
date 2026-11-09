import { Link } from 'react-router-dom'
import GrowthSection from './GrowthSection'
import './HomePage.css'

/**
 * 「个人成长」独立页（#/growth）。
 *
 * 原先它长在首页中段，末尾直接接黑色的留言块；现在拆开：
 * 首页只留开屏标题 + 联系方式 + 留言框，时间线和爱好搬到这里，
 * 白纸一页，跟首页同一套头尾，来回都有路。
 */
export default function GrowthPage() {
  return (
    <div className="home-page growth-page">
      <header className="hp-nav">
        <Link className="hp-brand" to="/home">
          <span className="hp-brand-dot" />
          雷馨怡
        </Link>
        <nav className="hp-nav-links" aria-label="页面导航">
          <a href="showcase.html">作品集</a>
          <Link to="/home?to=contact">留言</Link>
        </nav>
        <Link className="hp-nav-enter" to="/app">
          进入管理系统
          <i aria-hidden="true">→</i>
        </Link>
      </header>

      <GrowthSection />

      <footer className="hp-end">
        <div className="hp-wrap hp-end-row">
          <p>© 2026 雷馨怡 · 武汉理工大学</p>
          <nav className="hp-end-links" aria-label="页脚导航">
            <Link to="/home">首页</Link>
            <a href="showcase.html">作品集</a>
            <Link to="/app">管理系统</Link>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              回到顶部 ↑
            </button>
          </nav>
        </div>
      </footer>
    </div>
  )
}
