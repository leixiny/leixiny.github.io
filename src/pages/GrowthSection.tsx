import type { ReactNode } from 'react'
import { GROWTH, HOBBIES, NOW, PROFILE, TIMELINE } from '../data/growth'

/**
 * 首页的「个人成长」：学习经历 + 爱好，末尾直接落到留言。
 *
 * 留言原先是独立的一屏（和联系一起收在页脚），现在并进这一节：
 * 上面是白纸上的时间线与爱好，下面整幅转黑，标题「有想聊的，随时开口」当收尾。
 * 一页只收一次，不再有第二块「给我留言」。留言表单本身由首页传进来 ——
 * 它的状态（昵称、正文、最近几条）都在首页那边，这一节只负责版式。
 */
export default function GrowthSection({ children }: { children?: ReactNode }) {
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

      {/* 白纸到此为止：整幅转黑，接上留言与页脚 */}
      <div className="hp-say" id="contact">
        <span className="hp-say-glow hp-say-glow--blue" aria-hidden="true" />
        <span className="hp-say-glow hp-say-glow--pink" aria-hidden="true" />
        <span className="hp-say-rule" aria-hidden="true" />

        <div className="hp-wrap hp-say-inner">
          <header className="hp-say-head">
            <p className="hp-say-kicker">
              <i aria-hidden="true" />
              一起做点东西
            </p>
            <h3 className="hp-say-title">
              有想聊的，
              <br />
              <em>随时开口</em>。
            </h3>
            <p className="hp-say-lead">
              手上有项目、有看不懂的数据，或者只是一个还没想清楚的方向。留一句话就行 ——
              不用准备，也不用先想好要问什么。
            </p>
          </header>

          {children}
        </div>
      </div>
    </section>
  )
}
