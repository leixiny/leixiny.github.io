import { GROWTH, HOBBIES, NOW, PROFILE, TIMELINE } from '../data/growth'

/**
 * 「个人成长」：学习经历 + 爱好，白纸一页。
 *
 * 原先它长在首页中段、末尾直接接黑色留言块；现在拆成独立页面（#/growth），
 * 首页只留开屏标题和联系方式 + 留言框。这一节只管内容，版式由自己那页负责。
 */
export default function GrowthSection() {
  return (
    <section id="growth" className="hp-growth" aria-labelledby="hp-growth-title">
      <div className="hp-wrap">
        <header className="hp-growth-head">
          <p className="hp-growth-kicker">{GROWTH.kicker}</p>
          <h2 id="hp-growth-title">{GROWTH.title}</h2>
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
