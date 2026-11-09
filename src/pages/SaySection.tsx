import type { ReactNode } from 'react'

/**
 * 首页的收尾：白纸到此为止，整幅转黑，只留联系方式与留言入口。
 * 留言表单本身由首页传进来 —— 它的状态（昵称、正文、最近几条）都在首页那边，
 * 这一节只负责版式。
 */
export default function SaySection({ children }: { children?: ReactNode }) {
  return (
    <section id="contact" className="hp-say" aria-labelledby="hp-say-title">
      <span className="hp-say-glow hp-say-glow--blue" aria-hidden="true" />
      <span className="hp-say-glow hp-say-glow--pink" aria-hidden="true" />
      <span className="hp-say-rule" aria-hidden="true" />

      <div className="hp-wrap hp-say-inner">
        <header className="hp-say-head">
          <p className="hp-say-kicker">
            <i aria-hidden="true" />
            一起做点东西
          </p>
          <h3 className="hp-say-title" id="hp-say-title">
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
    </section>
  )
}
