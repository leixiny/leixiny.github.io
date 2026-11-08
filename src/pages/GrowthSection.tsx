import { GROWTH, HOBBIES, NOW, TIMELINE } from '../data/growth'

/**
 * 首页的「个人成长」：左边是学习经历的时间线，右边是爱好。
 * 版式跟着站点走 —— 白纸底、细线、深墨色字，只靠间距和字重分层。
 */
export default function GrowthSection() {
  return (
    <section id="growth" className="hp-growth" aria-labelledby="hp-growth-title">
      <div className="hp-wrap">
        <header className="hp-growth-head">
          <p className="hp-growth-kicker">{GROWTH.kicker}</p>
          <h2 id="hp-growth-title">{GROWTH.title}</h2>
          <p className="hp-growth-lead">{GROWTH.lead}</p>
        </header>

        <div className="hp-growth-grid">
          <div className="hp-growth-col">
            <h3 className="hp-growth-label">学习经历</h3>
            <ol className="hp-timeline">
              {TIMELINE.map((item) => (
                <li key={item.period + item.title}>
                  <p className="hp-tl-period">{item.period}</p>
                  <h4 className="hp-tl-title">{item.title}</h4>
                  <p className="hp-tl-note">{item.note}</p>
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
          </div>

          <div className="hp-growth-col">
            <h3 className="hp-growth-label">爱好</h3>
            <ul className="hp-hobbies">
              {HOBBIES.map((hobby) => (
                <li className="hp-hobby" key={hobby.title}>
                  <span className="hp-hobby-mark" aria-hidden="true">{hobby.mark}</span>
                  <h4>{hobby.title}</h4>
                  <p>{hobby.note}</p>
                </li>
              ))}
            </ul>

            <dl className="hp-now">
              {NOW.map((item) => (
                <div key={item.key}>
                  <dt>{item.key}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
