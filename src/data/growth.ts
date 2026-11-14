/**
 * 个人成长：数字概览 → 学习路径 → 能力 → 做事的方法 → 业余与现在。
 * 文案和结构都写在这两个文件里，改内容只改这里。
 */

export interface TimelineItem {
  period: string
  title: string
  note: string
  /** 这一段真正带走的东西，一句话 */
  takeaway?: string
  tags?: string[]
}

export interface Stat {
  value: string
  unit?: string
  label: string
  note: string
}

export interface Skill {
  name: string
  /** 常用 / 在用 / 了解：写清用到什么程度，不画假的进度条 */
  level: string
  evidence: string
}

export interface SkillGroup {
  key: string
  label: string
  intro: string
  items: Skill[]
}

export interface Principle {
  mark: string
  title: string
  note: string
  example: string
}

export interface NowItem {
  key: string
  value: string
}

export interface Hobby {
  mark: string
  title: string
  note: string
  /** 这件事给我什么，一句 */
  gain: string
}

export interface ProfileItem {
  key: string
  value: string
}

export const GROWTH = {
  kicker: '个人成长',
  title: '把学过的东西，慢慢变成能做的事。',
  lead: '本科在武汉理工大学读数字经济，真正上手的是数据、产品和一点点前端。这一页记的是走过的那条路：学过什么、能做什么、怎么做，以及还愿意花时间的那几件事。',
  close: '不着急一次做完，但每一件都要能拿出手。',
}

/** 标题下面那行小字：一行读完，不铺成简历 */
export const PROFILE: ProfileItem[] = [
  { key: '学历', value: '武汉理工大学 · 数字经济' },
  { key: '方向', value: '数据分析 · 产品' },
  { key: '籍贯', value: '安徽安庆宿松' },
]

/** 四个数字：先让人知道做过什么规模的事，再往下看细节 */
export const STATS: Stat[] = [
  { value: '4', unit: '件', label: '作品做到能用', note: '系统、网站、看板、调研，都在线上' },
  { value: '312', unit: '份', label: '问卷收回并清洗', note: '从设计题目到交叉分析走完全程' },
  { value: '31', unit: '省', label: '数据合成一张看板', note: '三份公开数据先统一口径' },
  { value: '3', unit: '条', label: '建议进了排期', note: '按影响面和成本排序，首条已上线' },
]

export const TIMELINE: TimelineItem[] = [
  {
    period: '2025.09 — 至今',
    title: '武汉理工大学 · 数字经济',
    note: '本科在读。宏微观经济学、统计学、计量经济学打底，课程之外补了 Python 和数据库。写作业时习惯把结论放在第一句，证据放后面 —— 分数没变高，但读的人轻松了很多。',
    takeaway: '先有判断，再找证据。',
    tags: ['经济学', '统计学', 'Python'],
  },
  {
    period: '2026.03 — 2026.08',
    title: '自学前端与数据库',
    note: '从 HTML/CSS 一路写到 React + TypeScript，再用 Supabase 把数据接上。学法是边做边查：手上有一个想做出来的东西，卡在哪里就补哪一块，不为学而学。',
    takeaway: '技术是手段，能交付才算学会。',
    tags: ['React', 'TypeScript', 'Supabase'],
  },
  {
    period: '2026.06',
    title: '区域消费差异数据看板',
    note: '三份公开数据口径各不相同：命名不一致、缺失值不一致、统计范围也不一致。先把口径统一，再拆出人均消费和消费结构两条分析线，最后做成覆盖 31 个省份的联动看板。',
    takeaway: '八成时间在清洗，两成时间在讲清楚。',
    tags: ['Power BI', '数据清洗', '可视化'],
  },
  {
    period: '2026.09 — 至今',
    title: '用真实数据练分析',
    note: '找真实数据集做题：问卷、消费、留存。SQL 取数、Python 清洗，交付物固定是一页结论。练的是完整链条：问题 → 口径 → 证据 → 建议，中间一步都省不掉。',
    takeaway: '一页结论比十张图难写，也更有用。',
    tags: ['SQL', '数据清洗', '结论表达'],
  },
  {
    period: '2026.10 — 至今',
    title: '把作品做成能上线的东西',
    note: '客户任务管理系统的客户、任务、看板三个视图联动，带登录鉴权，数据跑在 Supabase 上；这个个人站点也长在同一套架构里。第一次完整走完从想法、到上线、到收到反馈再改的循环。',
    takeaway: '上线不是终点，是开始收到真实反馈的地方。',
    tags: ['全栈', '部署', '迭代'],
  },
]

/** 能力按「拿它做过什么」写，比星级和百分比诚实 */
export const SKILLS: SkillGroup[] = [
  {
    key: 'data',
    label: '数据',
    intro: '从取数到结论，工具只是中间那一段。',
    items: [
      { name: 'SQL', level: '常用', evidence: '取数、多表关联、窗口函数；看板和问卷分析的数据都从这里出来。' },
      { name: 'Python · pandas', level: '在用', evidence: '清洗 312 份问卷，处理缺失值、重复项和口径不一致的选项。' },
      { name: 'Excel · Power BI', level: '常用', evidence: '31 个省份的消费看板，人均消费与消费结构两条线联动。' },
      { name: '统计学基础', level: '在用', evidence: '描述统计与显著性判断，知道一个结论最多能说到哪一步。' },
    ],
  },
  {
    key: 'front',
    label: '前端',
    intro: '够用就好：能把想法做成别人点得开的页面。',
    items: [
      { name: 'HTML · CSS', level: '常用', evidence: '布局、响应式、细节动效；这个站点的版式是手写出来的。' },
      { name: 'React · TypeScript', level: '在用', evidence: '管理系统的客户 / 任务 / 看板三视图，状态和类型都自己管。' },
      { name: 'Supabase', level: '在用', evidence: '数据表设计、登录鉴权、行级权限，游客可看、登录才能改。' },
      { name: '构建与部署', level: '了解', evidence: 'Vite 构建、环境变量、GitHub Pages 发布，改完能自己上线。' },
    ],
  },
  {
    key: 'product',
    label: '产品与调研',
    intro: '问题先问对，方案才有意义。',
    items: [
      { name: '问卷设计', level: '常用', evidence: '围绕流失环节设计题目并投放，回收 312 份有效问卷。' },
      { name: '用户访谈', level: '常用', evidence: '12 场深度访谈，补问卷问不到的那个「为什么」。' },
      { name: '需求排序', level: '常用', evidence: '影响面 × 实现成本，把一堆想法排成能执行的先后。' },
      { name: '指标体系', level: '在用', evidence: '留存、转化这些词先定义清楚，再谈涨跌，避免各说各话。' },
    ],
  },
  {
    key: 'voice',
    label: '表达',
    intro: '分析的最后一步，是让别人听懂。',
    items: [
      { name: '数据可视化', level: '常用', evidence: '一页里只留支撑结论的那几张图，其余进附录。' },
      { name: '写结论', level: '常用', evidence: '标题即结论，正文只放证据和边界条件。' },
      { name: '文档与复盘', level: '在用', evidence: '每个作品都留一份过程记录，下次少走同一段弯路。' },
      { name: '公开讲述', level: '在用', evidence: '课程展示、作品讲解，练到不看稿也能说清来龙去脉。' },
    ],
  },
]

export const PRINCIPLES: Principle[] = [
  {
    mark: '01',
    title: '先交付一页结论',
    note: '数据工作的产物不是图表，是判断。动手之前先问一句：这一页看完，对方能做什么决定？答不上来就先别画图。',
    example: '看板的最后一页收在一句话上：差异主要来自消费结构，而不是收入水平。',
  },
  {
    mark: '02',
    title: '缺什么补什么',
    note: '不按教程顺序学，按手上的问题学。想做的功能卡在哪里，就去补哪一块，学完立刻用掉，用不掉的不算学会。',
    example: '为了做登录鉴权才去读 Supabase 的权限文档，两天后这个功能就上线了。',
  },
  {
    mark: '03',
    title: '排序看影响面',
    note: '资源永远不够，所以先算清楚：改这一处，能让多少人好用多少。排完再动手，比想到哪改到哪快得多。',
    example: '312 份问卷最后只留 3 条建议进排期，第一条上线后次月留存回升。',
  },
]

export const HOBBIES: Hobby[] = [
  {
    mark: '01',
    title: '羽毛球',
    note: '一周两三场，最喜欢双打里那种来回拉扯的节奏。跑不动的时候才明白，落点比力气重要。',
    gain: '提前一步想对手会去哪儿。',
  },
  {
    mark: '02',
    title: '轮滑',
    note: '傍晚沿着江边刷一段，风大、路也不算平。摔过两次以后学会了把重心放低。',
    gain: '重心放低，反而滑得远。',
  },
  {
    mark: '03',
    title: '随手拍',
    note: '走路时看到光落在墙上、水面反了一下，就顺手拍下来。不太修图，攒着当素材用。',
    gain: '先看见，再判断。',
  },
  {
    mark: '04',
    title: '做饭',
    note: '照着菜谱做，再按自己的口味改：咸淡、火候、下锅顺序，改到吃着舒服为止。',
    gain: '流程可以拆开重排。',
  },
]

/** 「现在」：四行就够，别写成简历 */
export const NOW: NowItem[] = [
  { key: '在学', value: '计量经济学 · SQL 窗口函数' },
  { key: '在做', value: '这个站点的下一版：作品页和应用层的联动' },
  { key: '在读', value: '数据分析与产品复盘相关的书和长文' },
  { key: '在想', value: '怎么把一次分析讲成一句人能记住的话' },
]
