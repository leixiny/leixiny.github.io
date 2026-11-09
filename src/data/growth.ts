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

export interface ProfileItem {
  key: string
  value: string
}

export const GROWTH = {
  kicker: '个人成长',
  title: '把学过的东西，慢慢变成能做的事。',
  lead: '本科在武汉理工大学读数字经济，真正上手的是数据、产品和一点点前端。下面这些是学过的路径，和让我保持好奇的那几件事。',
}

/** 标题下面那行小字：学历和籍贯，一行读完，不铺成简历 */
export const PROFILE: ProfileItem[] = [
  { key: '学历', value: '武汉理工大学 · 数字经济' },
  { key: '籍贯', value: '安徽安庆宿松' },
]

export const TIMELINE: TimelineItem[] = [
  {
    period: '2025.09 — 至今',
    title: '武汉理工大学 · 数字经济',
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
    title: '羽毛球',
    note: '一周两三场，最喜欢双打里那种来回拉扯的节奏。跑不动的时候才明白，落点比力气重要。',
  },
  {
    mark: '02',
    title: '轮滑',
    note: '傍晚沿着江边刷一段，风大、路也不算平。摔过两次以后学会了把重心放低，和做事的道理差不多。',
  },
]

/** 爱好下面那条「现在」：三行就够，别写成简历 */
export const NOW: NowItem[] = [
  { key: '在学', value: '计量经济学 · SQL 窗口函数' },
  { key: '在做', value: '这个站点的下一版' },
  { key: '在想', value: '怎么把一次分析讲成一句人能记住的话' },
]
