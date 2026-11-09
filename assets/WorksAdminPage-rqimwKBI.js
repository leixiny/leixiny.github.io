import{m as e,n as t,o as n,p as r,r as i,s as a}from"./index-DFvGhYMX.js";import{a as o,c as s,d as c,i as l,l as u,n as d,o as f,r as p,s as m}from"./ui-FdX3XEfO.js";import{n as h,r as g}from"./cache-DGEZeqQu.js";var _=e(r(),1),v=`./`;function y(e){return e?/^(https?:|data:|blob:)/i.test(e)?e:new URL(`${v}${e}`,document.baseURI).href:``}var b=e=>typeof e==`string`?e:void 0;function x(e){return{id:String(e.id),title:b(e.title)??`未命名作品`,cover:b(e.cover)??``,uploadedAt:b(e.uploaded_at)??``,period:b(e.period),role:b(e.role),summary:b(e.summary),result:b(e.result),tags:Array.isArray(e.tags)?e.tags:[],url:b(e.url),milestones:Array.isArray(e.milestones)?e.milestones:[],sort:typeof e.sort==`number`?e.sort:0,published:e.published!==!1}}function S(e){return{title:e.title.trim(),cover:e.cover?.trim()||null,uploaded_at:e.uploadedAt||new Date().toISOString().slice(0,10),period:e.period?.trim()||null,role:e.role?.trim()||null,summary:e.summary?.trim()||null,result:e.result?.trim()||null,tags:e.tags.filter(Boolean),url:e.url?.trim()||null,milestones:e.milestones??[],sort:e.sort,published:e.published}}function C(e){return[...e].sort((e,t)=>e.sort===t.sort?(t.uploadedAt||``).localeCompare(e.uploadedAt||``):e.sort-t.sort)}async function w(){if(!n)return{works:[],error:`还没有配置 Supabase`};let{data:e,error:t}=await a.from(`works`).select(`*`).order(`sort`,{ascending:!0}).order(`uploaded_at`,{ascending:!1}).returns();return t?{works:[],error:t.message}:{works:C((e??[]).map(x))}}function T(e){let t=e.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g,`-`).replace(/^-+|-+$/g,``).slice(0,40),n=Date.now().toString(36);return`${t||`work`}-${n}`}async function E(e){let t=S(e);if(!t.title)return{error:`标题不能为空`};if(e.id){let{error:n}=await a.from(`works`).update(t).eq(`id`,e.id);return{error:n?.message}}let{error:n}=await a.from(`works`).insert({...t,id:T(t.title)});return{error:n?.message}}async function D(e){let{error:t}=await a.from(`works`).delete().eq(`id`,e);return{error:t?.message}}async function O(e,t,n){let r=C(e),i=r.findIndex(e=>e.id===t),o=i+n;if(i<0||o<0||o>=r.length)return{};let s=[...r],[c]=s.splice(i,1);return s.splice(o,0,c),{error:(await Promise.all(s.map((e,t)=>a.from(`works`).update({sort:t}).eq(`id`,e.id)))).find(e=>e.error)?.error?.message}}async function k(e){let t=(e.name.split(`.`).pop()||`jpg`).toLowerCase().replace(/[^a-z0-9]/g,``),n=`works/${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}.${t||`jpg`}`,{error:r}=await a.storage.from(`covers`).upload(n,e,{cacheControl:`31536000`,contentType:e.type||void 0,upsert:!1});if(r)return{error:r.message};let{data:i}=a.storage.from(`covers`).getPublicUrl(n);return{url:i.publicUrl}}var A=`-- 作品集改成数据库驱动：登录后在 /app/works 编辑，游客只看到 published = true 的\r
-- 用法：Supabase Dashboard -> SQL Editor -> 粘贴全部 -> Run\r
--（可重复执行：表、策略、种子数据都带 if not exists / drop policy if exists / on conflict）\r
\r
create table if not exists works (\r
  id text primary key,\r
  title text not null,\r
  cover text,\r
  uploaded_at date not null default current_date,\r
  period text,\r
  role text,\r
  summary text,\r
  result text,\r
  tags text[] not null default '{}',\r
  url text,\r
  milestones jsonb not null default '[]'::jsonb,\r
  sort int not null default 0,\r
  published boolean not null default true,\r
  created_at timestamptz not null default now(),\r
  updated_at timestamptz not null default now()\r
);\r
\r
create index if not exists works_published_sort_idx on works (published, sort);\r
\r
alter table works enable row level security;\r
\r
-- 游客只能读已发布的\r
drop policy if exists "works_public_read" on works;\r
create policy "works_public_read" on works\r
  for select to anon using (published);\r
\r
-- 站点主人（任何登录用户）可以读全部、增删改\r
drop policy if exists "works_owner_read" on works;\r
create policy "works_owner_read" on works\r
  for select to authenticated using (true);\r
\r
drop policy if exists "works_owner_write" on works;\r
create policy "works_owner_write" on works\r
  for all to authenticated using (true) with check (true);\r
\r
-- updated_at 自动维护\r
create or replace function touch_updated_at()\r
returns trigger\r
language plpgsql\r
as $$\r
begin\r
  new.updated_at = now();\r
  return new;\r
end;\r
$$;\r
\r
drop trigger if exists works_touch_updated_at on works;\r
create trigger works_touch_updated_at\r
  before update on works\r
  for each row execute function touch_updated_at();\r
\r
-- 封面图存放：public 桶，读公开、写要登录\r
insert into storage.buckets (id, name, public)\r
values ('covers', 'covers', true)\r
on conflict (id) do update set public = true;\r
\r
drop policy if exists "covers_public_read" on storage.objects;\r
create policy "covers_public_read" on storage.objects\r
  for select to anon, authenticated using (bucket_id = 'covers');\r
\r
drop policy if exists "covers_auth_insert" on storage.objects;\r
create policy "covers_auth_insert" on storage.objects\r
  for insert to authenticated with check (bucket_id = 'covers');\r
\r
drop policy if exists "covers_auth_update" on storage.objects;\r
create policy "covers_auth_update" on storage.objects\r
  for update to authenticated using (bucket_id = 'covers');\r
\r
drop policy if exists "covers_auth_delete" on storage.objects;\r
create policy "covers_auth_delete" on storage.objects\r
  for delete to authenticated using (bucket_id = 'covers');\r
\r
-- 现有四件作品作为初始数据（和 public/projects.json 一致）\r
insert into works (id, title, cover, uploaded_at, period, role, summary, result, tags, url, milestones, sort, published)\r
values\r
  ($q$crm$q$, $q$客户任务管理系统 SupaProject$q$, $q$covers/crm-cut.webp$q$, $q$2026-10-28$q$, $q$2026.10$q$, $q$全栈开发$q$, $q$能真实落地的全栈任务管理系统：客户、任务、看板三视图联动，带登录鉴权。$q$, $q$完整可用的任务管理系统——你现在看到的这个网站，就是由它驱动的。$q$, array[$t$React$t$,$t$TypeScript$t$,$t$Supabase$t$]::text[], $q$#/$q$, $ms$[\r
  {\r
    "date": "2026-10-24",\r
    "title": "想法萌生",\r
    "desc": "想要一个能真实落地的小型 CRM：客户、任务、跟进记录都要能增删改查。"\r
  },\r
  {\r
    "date": "2026-10-25",\r
    "title": "技术选型与建表",\r
    "desc": "确定 React + TypeScript + Vite + Supabase，完成数据库建模。"\r
  },\r
  {\r
    "date": "2026-10-27",\r
    "title": "核心功能完成",\r
    "desc": "客户/任务/看板三视图联动，登录鉴权接入。"\r
  },\r
  {\r
    "date": "2026-10-28",\r
    "title": "上线发布",\r
    "desc": "部署到 GitHub Pages，开放访问。"\r
  }\r
]$ms$::jsonb, 0, true),\r
  ($q$website$q$, $q$把简历做成可访问的网站$q$, $q$covers/website-cut.webp$q$, $q$2026-10-25$q$, $q$2026.10$q$, $q$设计与开发$q$, $q$纸质简历承载不了作品细节，用 Vibe Coding 一个下午完成单页站点并部署。$q$, $q$首屏 3 秒内可读完核心信息，手机端无横向滚动、无需缩放。$q$, array[$t$Vibe Coding$t$,$t$静态部署$t$,$t$内容结构$t$]::text[], null, $ms$[\r
  {\r
    "date": "2026-10-25",\r
    "title": "上午：定结构与文案",\r
    "desc": "内容与代码分离，确定能力/作品/联系三大块。"\r
  },\r
  {\r
    "date": "2026-10-25",\r
    "title": "下午：开发与构建",\r
    "desc": "自然语言驱动开发，构建为静态站点。"\r
  },\r
  {\r
    "date": "2026-10-25",\r
    "title": "当晚：部署上线",\r
    "desc": "托管到 GitHub Pages，生成可分享链接。"\r
  },\r
  {\r
    "date": "2026-10-29",\r
    "title": "迭代：接入互动",\r
    "desc": "接入 Supabase 留言板与点赞，与管理系统合并。"\r
  }\r
]$ms$::jsonb, 1, true),\r
  ($q$dashboard$q$, $q$区域消费差异数据看板$q$, $q$covers/dashboard-cut.webp$q$, $q$2026-06-20$q$, $q$2026.06$q$, $q$数据处理与可视化$q$, $q$合并三份公开数据统一口径，用 Power BI 做出覆盖 31 个省份的联动看板。$q$, $q$被选为课程展示案例，评分 A。$q$, array[$t$Power BI$t$,$t$数据清洗$t$,$t$可视化$t$]::text[], null, $ms$[\r
  {\r
    "date": "2026-06-05",\r
    "title": "领到课题",\r
    "desc": "课程作业要求解释区域消费差异，原始数据分散在三个来源。"\r
  },\r
  {\r
    "date": "2026-06-10",\r
    "title": "数据合并与清洗",\r
    "desc": "统一三份数据口径，处理缺失值与命名差异。"\r
  },\r
  {\r
    "date": "2026-06-15",\r
    "title": "看板搭建",\r
    "desc": "拆出人均消费与消费结构两条分析线，完成联动交互。"\r
  },\r
  {\r
    "date": "2026-06-20",\r
    "title": "课程展示",\r
    "desc": "作为展示案例在课堂演示，评分 A。"\r
  }\r
]$ms$::jsonb, 2, true),\r
  ($q$survey$q$, $q$312 份问卷变成 3 条产品优先级$q$, $q$covers/survey-cut.webp$q$, $q$2026-05-18$q$, $q$2026.03 — 2026.05$q$, $q$独立负责$q$, $q$为校园二手平台做留存诊断：问卷 + 深访交叉分析，把需求按影响面排序。$q$, $q$3 条优先级被采纳进入排期，其中首条已上线，次月留存回升。$q$, array[$t$用户调研$t$,$t$需求排序$t$,$t$问卷设计$t$]::text[], null, $ms$[\r
  {\r
    "date": "2026-03-02",\r
    "title": "发现问题",\r
    "desc": "校园二手平台留存偏低，团队不确定该先改哪一环。"\r
  },\r
  {\r
    "date": "2026-03-10",\r
    "title": "问卷设计",\r
    "desc": "围绕流失环节设计问卷并投放。"\r
  },\r
  {\r
    "date": "2026-04-08",\r
    "title": "回收 312 份",\r
    "desc": "完成回收并开始交叉分析。"\r
  },\r
  {\r
    "date": "2026-04-20",\r
    "title": "12 场深度访谈",\r
    "desc": "对高频流失用户做深访，补充定性洞察。"\r
  },\r
  {\r
    "date": "2026-05-18",\r
    "title": "3 条优先级被采纳",\r
    "desc": "按影响面与实现成本排序，进入产品排期。"\r
  }\r
]$ms$::jsonb, 3, true)\r
on conflict (id) do nothing;\r
`,j=i(),M=e=>({title:``,cover:``,uploadedAt:new Date().toISOString().slice(0,10),period:``,role:``,summary:``,result:``,tags:[],url:``,milestones:[],sort:e,published:!0});function N(){let{session:e}=t(),[n,r]=(0,_.useState)(()=>h(`works`)??[]),[i,a]=(0,_.useState)(()=>!h(`works`)),[c,f]=(0,_.useState)(``),[m,v]=(0,_.useState)(!1),[b,x]=(0,_.useState)(M(0)),[S,C]=(0,_.useState)(!1),T=(0,_.useCallback)(async(e=!1)=>{e||a(!0);let{works:t,error:n}=await w();r(t),g(`works`,t),f(n??``),a(!1)},[]);(0,_.useEffect)(()=>{T()},[T]);function k(){e&&(x(M(n.length)),v(!0))}function A(t){if(!e)return;let{id:n,...r}=t;x({...r,id:n}),v(!0)}async function N(){if(!e)return;if(!b.title.trim()){f(`标题不能为空`);return}C(!0);let{error:t}=await E(b);C(!1),t?f(t):(f(``),v(!1),await T(!0))}async function I(t){if(!e||!window.confirm(`删除「${t.title}」？作品集会立刻少一件，删掉就找不回来了。`))return;let{error:n}=await D(t.id);n?f(n):await T(!0)}async function L(t,r){if(!e)return;let{error:i}=await O(n,t.id,r);i?f(i):await T(!0)}let R=!c;return(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(u,{title:`作品集`,description:`作品档案数据。放映页现在放的是演示片，还没接这张表 —— 等素材齐了再把它接上去。`,action:(0,j.jsxs)(`div`,{className:`page-action-row`,children:[(0,j.jsx)(`a`,{className:`btn-secondary`,href:`showcase.html`,target:`_blank`,rel:`noreferrer`,children:`前台看看`}),(0,j.jsx)(p,{onClick:k,disabled:!R||!e,children:`新增作品`})]})}),R?null:(0,j.jsx)(P,{message:c,onDone:T}),!e&&R?(0,j.jsxs)(l,{className:`guest-card`,children:[(0,j.jsx)(`b`,{children:`游客模式`}),(0,j.jsx)(`p`,{children:`作品库可以随便看。要新增、编辑或删除，先到右上角「登录」一次 —— 这台设备记住你之后，以后进来就再也不用登了。`})]}):null,(0,j.jsx)(l,{children:i&&n.length===0?(0,j.jsx)(o,{title:`正在读取作品…`}):n.length===0?(0,j.jsx)(o,{title:`还没有作品`,description:`新增第一件，它会立刻出现在作品集那一页。`,action:R&&e?(0,j.jsx)(p,{onClick:k,children:`新增作品`}):void 0}):(0,j.jsx)(`div`,{className:`table-wrap`,children:(0,j.jsxs)(`table`,{className:`data-table works-table`,children:[(0,j.jsx)(`thead`,{children:(0,j.jsxs)(`tr`,{children:[(0,j.jsx)(`th`,{children:`作品`}),(0,j.jsx)(`th`,{children:`时间`}),(0,j.jsx)(`th`,{children:`状态`}),(0,j.jsx)(`th`,{children:`顺序`}),(0,j.jsx)(`th`,{})]})}),(0,j.jsx)(`tbody`,{children:n.map((t,r)=>(0,j.jsxs)(`tr`,{children:[(0,j.jsx)(`td`,{children:(0,j.jsxs)(`div`,{className:`work-cell`,children:[t.cover?(0,j.jsx)(`img`,{className:`work-thumb`,src:y(t.cover),alt:``}):(0,j.jsx)(`span`,{className:`work-thumb is-empty`,children:`无封面`}),(0,j.jsxs)(`div`,{children:[(0,j.jsx)(`strong`,{className:`table-primary`,children:t.title}),(0,j.jsx)(`small`,{children:t.summary||t.role||`未填写简介`})]})]})}),(0,j.jsx)(`td`,{children:t.period||t.uploadedAt}),(0,j.jsx)(`td`,{children:(0,j.jsx)(d,{tone:t.published?`green`:`amber`,children:t.published?`已发布`:`草稿`})}),(0,j.jsxs)(`td`,{className:`work-sort`,children:[(0,j.jsx)(`button`,{type:`button`,onClick:()=>L(t,-1),disabled:r===0||!e,"aria-label":`上移`,children:`↑`}),(0,j.jsx)(`button`,{type:`button`,onClick:()=>L(t,1),disabled:r===n.length-1||!e,"aria-label":`下移`,children:`↓`})]}),(0,j.jsx)(`td`,{children:(0,j.jsxs)(`div`,{className:`row-actions`,children:[(0,j.jsx)(`button`,{type:`button`,onClick:()=>A(t),disabled:!e,children:`编辑`}),(0,j.jsx)(`button`,{type:`button`,className:`danger-text`,onClick:()=>I(t),disabled:!e,children:`删除`})]})})]},t.id))})]})})}),(0,j.jsxs)(s,{open:m,title:b.id?`编辑作品`:`新增作品`,onClose:()=>v(!1),children:[(0,j.jsx)(F,{draft:b,onChange:x}),(0,j.jsxs)(`div`,{className:`modal-actions`,children:[(0,j.jsx)(p,{variant:`secondary`,onClick:()=>v(!1),children:`取消`}),(0,j.jsx)(p,{onClick:N,loading:S,children:`保存`})]})]})]})}function P({message:e,onDone:t}){let[n,r]=(0,_.useState)(!1);async function i(){try{await navigator.clipboard.writeText(A),r(!0),window.setTimeout(()=>r(!1),2200)}catch{r(!1)}}return(0,j.jsxs)(l,{className:`setup-card`,children:[(0,j.jsx)(`h2`,{children:`还差最后一步：建一张作品表`}),(0,j.jsx)(`p`,{children:`作品现在存在 Supabase 里，这样你在这里改完，网站上的作品集会立刻跟着变。 执行下面这段 SQL 就会建好表、读写权限，并把这四件作品搬进去。`}),(0,j.jsxs)(`ol`,{className:`setup-steps`,children:[(0,j.jsx)(`li`,{children:`复制下面的 SQL`}),(0,j.jsx)(`li`,{children:`到 Supabase 的 SQL Editor 粘贴并 Run`}),(0,j.jsx)(`li`,{children:`回来点「刷新」`})]}),(0,j.jsxs)(`div`,{className:`setup-actions`,children:[(0,j.jsx)(p,{onClick:i,children:n?`已复制`:`复制 SQL`}),(0,j.jsx)(`a`,{className:`btn-secondary`,href:`https://supabase.com/dashboard/project/bkiqrhlthjodswqivdsn/sql/new`,target:`_blank`,rel:`noreferrer`,children:`打开 SQL Editor`}),(0,j.jsx)(p,{variant:`ghost`,onClick:()=>void t(),children:`刷新`})]}),(0,j.jsxs)(`details`,{className:`setup-sql`,children:[(0,j.jsx)(`summary`,{children:`看看要执行什么`}),(0,j.jsx)(`pre`,{children:A})]}),(0,j.jsxs)(`small`,{className:`setup-error`,children:[`数据库返回：`,e]})]})}function F({draft:e,onChange:t}){let[n,r]=(0,_.useState)(!1),[i,a]=(0,_.useState)(``),o=(n,r)=>t({...e,[n]:r});async function s(e){r(!0),a(``);let{url:t,error:n}=await k(e);r(!1),n||!t?a(n??`上传失败`):o(`cover`,t)}return(0,j.jsxs)(`div`,{className:`work-form`,children:[(0,j.jsx)(f,{label:`标题`,children:(0,j.jsx)(m,{value:e.title,onChange:e=>o(`title`,e.target.value),placeholder:`作品名称`})}),(0,j.jsxs)(f,{label:`封面`,hint:`竖图/横图都行，前台会按比例裁切`,children:[(0,j.jsxs)(`div`,{className:`cover-row`,children:[e.cover?(0,j.jsx)(`img`,{className:`cover-preview`,src:y(e.cover),alt:``}):(0,j.jsx)(`span`,{className:`cover-preview is-empty`,children:`无`}),(0,j.jsxs)(`div`,{className:`cover-actions`,children:[(0,j.jsxs)(`label`,{className:`btn-secondary cover-upload`,children:[n?`上传中…`:`上传图片`,(0,j.jsx)(`input`,{type:`file`,accept:`image/*`,hidden:!0,onChange:e=>{let t=e.target.files?.[0];t&&s(t),e.target.value=``}})]}),(0,j.jsx)(m,{value:e.cover??``,onChange:e=>o(`cover`,e.target.value),placeholder:`或直接填图片地址`})]})]}),i?(0,j.jsx)(`small`,{className:`danger-text`,children:i}):null]}),(0,j.jsxs)(`div`,{className:`form-grid-2`,children:[(0,j.jsx)(f,{label:`时间`,children:(0,j.jsx)(m,{value:e.period??``,onChange:e=>o(`period`,e.target.value),placeholder:`2026.10`})}),(0,j.jsx)(f,{label:`角色`,children:(0,j.jsx)(m,{value:e.role??``,onChange:e=>o(`role`,e.target.value),placeholder:`独立完成 / 全栈开发`})})]}),(0,j.jsx)(f,{label:`简介`,children:(0,j.jsx)(c,{value:e.summary??``,onChange:e=>o(`summary`,e.target.value),rows:2,placeholder:`一句话说清这件事是什么`})}),(0,j.jsx)(f,{label:`结果`,children:(0,j.jsx)(c,{value:e.result??``,onChange:e=>o(`result`,e.target.value),rows:2,placeholder:`做成了什么，有没有被用起来`})}),(0,j.jsx)(f,{label:`标签`,hint:`用逗号分开，比如：React, 数据可视化`,children:(0,j.jsx)(m,{value:e.tags.join(`, `),onChange:e=>o(`tags`,e.target.value.split(/[,，]/).map(e=>e.trim()).filter(Boolean))})}),(0,j.jsxs)(`div`,{className:`form-grid-2`,children:[(0,j.jsx)(f,{label:`链接`,hint:`站内用 #/ 开头，站外用 https://`,children:(0,j.jsx)(m,{value:e.url??``,onChange:e=>o(`url`,e.target.value),placeholder:`#/app 或 https://…`})}),(0,j.jsx)(f,{label:`日期`,hint:`影响同类作品的先后`,children:(0,j.jsx)(m,{type:`date`,value:e.uploadedAt,onChange:e=>o(`uploadedAt`,e.target.value)})})]}),(0,j.jsxs)(`label`,{className:`check-row`,children:[(0,j.jsx)(`input`,{type:`checkbox`,checked:e.published,onChange:e=>o(`published`,e.target.checked)}),(0,j.jsx)(`span`,{children:`发布到作品集（取消勾选就只在后台可见）`})]})]})}export{N as default};