import type { ReactNode } from 'react'

/**
 * 首页的收尾：白纸上直接落联系方式与留言入口。
 * 留言表单本身由首页传进来 —— 它的状态（昵称、正文、最近几条）都在首页那边，
 * 这一节只负责版式。
 */
export default function SaySection({ children }: { children?: ReactNode }) {
  return (
    <section id="contact" className="hp-say">
      <span className="hp-say-rule" aria-hidden="true" />

      <div className="hp-wrap hp-say-inner">{children}</div>
    </section>
  )
}
