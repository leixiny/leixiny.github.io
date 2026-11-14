import { Link } from 'react-router-dom'
import {
  GROWTH,
  HOBBIES,
  NOW,
  PRINCIPLES,
  PROFILE,
  SKILLS,
  STATS,
  TIMELINE,
} from '../data/growth'

/**
 * 「个人成长」正文：数字概览 → 学习路径 → 能力 → 做事的方法 → 业余与现在。
 *
 * 内容全在 data/growth.ts，这一节只管结构。
 * 用 HashRouter，目录不能用 #锚点（会被当成路由），所以点击是滚到对应区块。
 */
const SECTIONS = [
  { id: 'path', label: '学习路径' },
  { id: 'skills', label: '能力' },
  { id: 'principles', label: '做事的方法' },
  { id: 'life', label: '业余与现在' },
]

function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function GrowthSection() {
  return (
    <section id="growth" className="hp-growth" aria-labelledby="hp-growth-title">
      <div className="hp-wrap">
        <header className="hp-growth-head">
          <p className="hp-growth-kicker">{GROWTH.kicker}</p>
          <h1 id="hp-growth-title">{GROWTH.title}</h1>
          <p className="hp-growth-lead">{GROWTH.lead}</p>
          <dl className="hp-growth-meta">
            {PROFILE.map((item) => (
              <div key={item.key}>
                <dt>{item.key}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <ul className="hp-growth-stats">
          {STATS.map((s) => (
            <li key={s.label}>
              <p className="hp-gstat-value">
                {s.value}
                {s.unit ? <span>{s.unit}</span> : null}
              </p>
              <p className="hp-gstat-label">{s.label}</p>
              <p className="hp-gstat-note">{s.note}</p>
            </li>
          ))}
        </ul>

        <nav className="hp-toc" aria-label="本页目录">
          {SECTIONS.map((s, i) => (
            <button key={s.id} type="button" onClick={() => jumpTo(s.id)}>
              <i aria-hidden="true">{String(i + 1).padStart(2, '0')}</i>
              {s.label}
            </button>
          ))}
        </nav>

        <section className="hp-block" id="path" aria-labelledby="path-h">
          <header className="hp-block-head">
            <p className="hp-block-mark">01 / 学习路径</p>
            <h2 id="path-h">从课程，到能交付的东西</h2>
            <p>
              学校教的部分打底，真正长本事的是把东西做出来那几次。下面按时间排，
              每条末尾写了一句话：这一段到底带走了什么。
            </p>
          </header>

          <ol className="hp-timeline">
            {TIMELINE.map((item) => (
              <li key={item.period + item.title}>
                <p className="hp-tl-period">{item.period}</p>
                <h3 className="hp-tl-title">{item.title}</h3>
                <p className="hp-tl-note">{item.note}</p>
                {item.takeaway ? (
                  <p className="hp-tl-takeaway">
                    <span aria-hidden="true">带走</span>
                    {item.takeaway}
                  </p>
                ) : null}
                {item.tags?.length ? (
                  <ul className="hp-tl-tags">
                    {item.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="hp-block" id="skills" aria-labelledby="skills-h">
          <header className="hp-block-head">
            <p className="hp-block-mark">02 / 能力</p>
            <h2 id="skills-h">会什么，用它做过什么</h2>
            <p>
              不列进度条，只写用到的程度和对应的证据 ——「常用」是反复用过的，
              「在用」是正在当工具的，「了解」是能看懂、还不敢说自己精。
            </p>
          </header>

          <div className="hp-skill-grid">
            {SKILLS.map((g) => (
              <article className="hp-skill-card" key={g.key}>
                <h3>{g.label}</h3>
                <p className="hp-skill-intro">{g.intro}</p>
                <ul className="hp-skill-list">
                  {g.items.map((it) => (
                    <li key={it.name}>
                      <p className="hp-skill-top">
                        <span className="hp-skill-name">{it.name}</span>
                        <span className="hp-skill-level">{it.level}</span>
                      </p>
                      <p className="hp-skill-evidence">{it.evidence}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="hp-block" id="principles" aria-labelledby="principles-h">
          <header className="hp-block-head">
            <p className="hp-block-mark">03 / 做事的方法</p>
            <h2 id="principles-h">三条自己一直在用的规矩</h2>
            <p>不是什么方法论，是踩过坑之后留下的习惯。每条都带一个真实例子。</p>
          </header>

          <ol className="hp-principles">
            {PRINCIPLES.map((p) => (
              <li key={p.mark}>
                <p className="hp-principle-mark">{p.mark}</p>
                <h3>{p.title}</h3>
                <p className="hp-principle-note">{p.note}</p>
                <p className="hp-principle-eg">
                  <span aria-hidden="true">例子</span>
                  {p.example}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="hp-block" id="life" aria-labelledby="life-h">
          <header className="hp-block-head">
            <p className="hp-block-mark">04 / 业余与现在</p>
            <h2 id="life-h">不做事的时候</h2>
            <p>这几件事和效率无关，但它们决定了做事时的手感和耐心。</p>
          </header>

          <ul className="hp-hobbies">
            {HOBBIES.map((h) => (
              <li className="hp-hobby" key={h.title}>
                <span className="hp-hobby-mark" aria-hidden="true">{h.mark}</span>
                <h3>{h.title}</h3>
                <p>{h.note}</p>
                <p className="hp-hobby-gain">{h.gain}</p>
              </li>
            ))}
          </ul>

          <div className="hp-now-wrap">
            <p className="hp-block-mark">现在</p>
            <dl className="hp-now">
              {NOW.map((item) => (
                <div key={item.key}>
                  <dt>{item.key}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="hp-growth-close">
          <p>{GROWTH.close}</p>
          <div className="hp-growth-actions">
            <a className="hp-growth-btn" href="showcase.html">
              看看作品
              <i aria-hidden="true">→</i>
            </a>
            <Link className="hp-growth-btn hp-growth-btn--ghost" to="/home">
              回首页
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
