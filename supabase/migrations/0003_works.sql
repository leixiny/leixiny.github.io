-- 作品集改成数据库驱动：登录后在 /app/works 编辑，游客只看到 published = true 的
-- 用法：Supabase Dashboard -> SQL Editor -> 粘贴全部 -> Run
--（可重复执行：表、策略、种子数据都带 if not exists / drop policy if exists / on conflict）

create table if not exists works (
  id text primary key,
  title text not null,
  cover text,
  uploaded_at date not null default current_date,
  period text,
  role text,
  summary text,
  result text,
  tags text[] not null default '{}',
  url text,
  milestones jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists works_published_sort_idx on works (published, sort);

alter table works enable row level security;

-- 游客只能读已发布的
drop policy if exists "works_public_read" on works;
create policy "works_public_read" on works
  for select to anon using (published);

-- 站点主人（任何登录用户）可以读全部、增删改
drop policy if exists "works_owner_read" on works;
create policy "works_owner_read" on works
  for select to authenticated using (true);

drop policy if exists "works_owner_write" on works;
create policy "works_owner_write" on works
  for all to authenticated using (true) with check (true);

-- updated_at 自动维护
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists works_touch_updated_at on works;
create trigger works_touch_updated_at
  before update on works
  for each row execute function touch_updated_at();

-- 封面图存放：public 桶，读公开、写要登录
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do update set public = true;

drop policy if exists "covers_public_read" on storage.objects;
create policy "covers_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'covers');

drop policy if exists "covers_auth_insert" on storage.objects;
create policy "covers_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'covers');

drop policy if exists "covers_auth_update" on storage.objects;
create policy "covers_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'covers');

drop policy if exists "covers_auth_delete" on storage.objects;
create policy "covers_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'covers');

-- 现有四件作品作为初始数据（和 public/projects.json 一致）
insert into works (id, title, cover, uploaded_at, period, role, summary, result, tags, url, milestones, sort, published)
values
  ($q$crm$q$, $q$客户任务管理系统 SupaProject$q$, $q$covers/crm-cut.webp$q$, $q$2026-10-28$q$, $q$2026.10$q$, $q$全栈开发$q$, $q$能真实落地的全栈任务管理系统：客户、任务、看板三视图联动，带登录鉴权。$q$, $q$完整可用的任务管理系统——你现在看到的这个网站，就是由它驱动的。$q$, array[$t$React$t$,$t$TypeScript$t$,$t$Supabase$t$]::text[], $q$#/$q$, $ms$[
  {
    "date": "2026-10-24",
    "title": "想法萌生",
    "desc": "想要一个能真实落地的小型 CRM：客户、任务、跟进记录都要能增删改查。"
  },
  {
    "date": "2026-10-25",
    "title": "技术选型与建表",
    "desc": "确定 React + TypeScript + Vite + Supabase，完成数据库建模。"
  },
  {
    "date": "2026-10-27",
    "title": "核心功能完成",
    "desc": "客户/任务/看板三视图联动，登录鉴权接入。"
  },
  {
    "date": "2026-10-28",
    "title": "上线发布",
    "desc": "部署到 GitHub Pages，开放访问。"
  }
]$ms$::jsonb, 0, true),
  ($q$website$q$, $q$把简历做成可访问的网站$q$, $q$covers/website-cut.webp$q$, $q$2026-10-25$q$, $q$2026.10$q$, $q$设计与开发$q$, $q$纸质简历承载不了作品细节，用 Vibe Coding 一个下午完成单页站点并部署。$q$, $q$首屏 3 秒内可读完核心信息，手机端无横向滚动、无需缩放。$q$, array[$t$Vibe Coding$t$,$t$静态部署$t$,$t$内容结构$t$]::text[], null, $ms$[
  {
    "date": "2026-10-25",
    "title": "上午：定结构与文案",
    "desc": "内容与代码分离，确定能力/作品/联系三大块。"
  },
  {
    "date": "2026-10-25",
    "title": "下午：开发与构建",
    "desc": "自然语言驱动开发，构建为静态站点。"
  },
  {
    "date": "2026-10-25",
    "title": "当晚：部署上线",
    "desc": "托管到 GitHub Pages，生成可分享链接。"
  },
  {
    "date": "2026-10-29",
    "title": "迭代：接入互动",
    "desc": "接入 Supabase 留言板与点赞，与管理系统合并。"
  }
]$ms$::jsonb, 1, true),
  ($q$dashboard$q$, $q$区域消费差异数据看板$q$, $q$covers/dashboard-cut.webp$q$, $q$2026-06-20$q$, $q$2026.06$q$, $q$数据处理与可视化$q$, $q$合并三份公开数据统一口径，用 Power BI 做出覆盖 31 个省份的联动看板。$q$, $q$被选为课程展示案例，评分 A。$q$, array[$t$Power BI$t$,$t$数据清洗$t$,$t$可视化$t$]::text[], null, $ms$[
  {
    "date": "2026-06-05",
    "title": "领到课题",
    "desc": "课程作业要求解释区域消费差异，原始数据分散在三个来源。"
  },
  {
    "date": "2026-06-10",
    "title": "数据合并与清洗",
    "desc": "统一三份数据口径，处理缺失值与命名差异。"
  },
  {
    "date": "2026-06-15",
    "title": "看板搭建",
    "desc": "拆出人均消费与消费结构两条分析线，完成联动交互。"
  },
  {
    "date": "2026-06-20",
    "title": "课程展示",
    "desc": "作为展示案例在课堂演示，评分 A。"
  }
]$ms$::jsonb, 2, true),
  ($q$survey$q$, $q$312 份问卷变成 3 条产品优先级$q$, $q$covers/survey-cut.webp$q$, $q$2026-05-18$q$, $q$2026.03 — 2026.05$q$, $q$独立负责$q$, $q$为校园二手平台做留存诊断：问卷 + 深访交叉分析，把需求按影响面排序。$q$, $q$3 条优先级被采纳进入排期，其中首条已上线，次月留存回升。$q$, array[$t$用户调研$t$,$t$需求排序$t$,$t$问卷设计$t$]::text[], null, $ms$[
  {
    "date": "2026-03-02",
    "title": "发现问题",
    "desc": "校园二手平台留存偏低，团队不确定该先改哪一环。"
  },
  {
    "date": "2026-03-10",
    "title": "问卷设计",
    "desc": "围绕流失环节设计问卷并投放。"
  },
  {
    "date": "2026-04-08",
    "title": "回收 312 份",
    "desc": "完成回收并开始交叉分析。"
  },
  {
    "date": "2026-04-20",
    "title": "12 场深度访谈",
    "desc": "对高频流失用户做深访，补充定性洞察。"
  },
  {
    "date": "2026-05-18",
    "title": "3 条优先级被采纳",
    "desc": "按影响面与实现成本排序，进入产品排期。"
  }
]$ms$::jsonb, 3, true)
on conflict (id) do nothing;
