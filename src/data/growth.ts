/**
 * 个人成长：学习经历 + 爱好。
 * 内容都写在这里，改文案只改这个文件，页面结构不用动。
 */

export interface TimelineItem {
  period: string
  title: string
  note: string
  tags?: string[]
}

export interface NowItem {
  key: string
  value: string
}

export interface Hobby {
  mark: string
  title: string
  note: string
}

export const GROWTH = {
  kicker: '个人成长',
  title: '把学过的东西，慢慢变成能做的事。',
  lead: '本科学的是数字经济，真正上手的是数据、产品和一点点前端。下面这些是学过的路径，和让我保持好奇的那几件事。',
}

export const TIMELINE: TimelineItem[] = [
  {
    period: '2025.09 — 至今',
    title: '汕头大学 · 数字经济',
    note: '本科在读。宏微观经济学、统计学、计量经济学打底，课程之外补了 Python 和数据库，习惯把结论写成别人看得懂的话。',
    tags: ['经济学', '统计学', 'Python'],
  },
  {
    period: '2026.03 — 2026.08',
    title: '自学前端与数据库',
    note: '从 HTML/CSS 一路写到 React + TypeScript，再用 Supabase 把数据接上。学的方式是边做边查：想做一个东西，缺什么补什么。',
    tags: ['React', 'TypeScript', 'Supabase'],
  },
  {
    period: '2026.09 — 至今',
    title: '用真实数据练分析',
    note: '找真实数据集做题：问卷、消费数据、留存数据。SQL 取数、Python 清洗，最后交付的是一页结论，不是一堆图表。',
    tags: ['SQL', '数据清洗', '可视化'],
  },
]

export const HOBBIES: Hobby[] = [
  {
    mark: '01',
    title: '摄影',
    note: '爱拍水面、光斑和城市里的边角，这个站点的背景图就是自己拍的。',
  },
  {
    mark: '02',
    title: '排版与设计',
    note: '对留白、字距和动效的节奏有强迫症，喜欢把界面做得安静一点。',
  },
  {
    mark: '03',
    title: '游泳',
    note: '水里最不需要想事情，一次两千米，上来之后问题往往就有答案了。',
  },
  {
    mark: '04',
    title: '阅读',
    note: '商业和人文交替读，读完会写几行笔记，偶尔变成一篇文章。',
  },
]

/** 爱好下面那条「现在」：三行就够，别写成简历 */
export const NOW: NowItem[] = [
  { key: '在学', value: '计量经济学 · SQL 窗口函数' },
  { key: '在做', value: '这个站点的下一版' },
  { key: '在想', value: '怎么把一次分析讲成一句人能记住的话' },
]
