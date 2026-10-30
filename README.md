# SupaProject — 个人项目与客户管理系统

基于 React + TypeScript + Vite + Supabase 的全栈客户关系管理（CRM）应用。

## 技术栈

- **前端**：React 19 + TypeScript + Vite + React Router（Hash 路由）
- **后端**：Supabase（PostgreSQL + Auth + Storage + RLS + Realtime）
- **样式**：原生 CSS
- **构建**：Vite + TypeScript

## 功能模块

| 模块 | 说明 |
|------|------|
| 认证 | 邮箱注册 / 登录 / 登出，基于 Supabase Auth |
| 组织引导 | 首次登录创建组织，自动成为所有者 |
| 仪表盘 | 客户总数、活跃客户、待办任务、今日到期、逾期任务、文档数、团队人数统计 |
| 客户管理 | 客户列表（筛选/搜索）、新增/编辑客户、客户详情页 |
| 联系人 | 客户下的联系人管理（主联系人标记） |
| 跟进任务 | 任务列表（按状态/优先级筛选）、关联客户、分配负责人、截止日期 |
| 团队管理 | 成员列表、角色（所有者/管理员/成员）、邀请成员 |
| 个人资料 | 头像、姓名、邮箱修改 |
| 实时更新 | 基于 Supabase Realtime 的数据实时同步 |

## 角色与权限

- **所有者 (owner)**：组织创建者，全部权限
- **管理员 (admin)**：管理客户、任务、成员
- **成员 (member)**：查看和操作分配给自己的内容

权限通过 Supabase RLS（行级安全）策略在数据库层强制执行。

## 数据库设计

核心表（见 `supabase/migrations/0001_init_crm.sql`）：

- `organizations` — 组织
- `profiles` — 用户资料
- `organization_members` — 组织成员（含角色）
- `customers` — 客户
- `contacts` — 联系人
- `tags` / `customer_tags` — 标签
- `tasks` — 跟进任务
- `customer_documents` — 客户文档（Storage）
- `activity_logs` — 操作日志（触发器自动记录）

触发器：客户/任务增删改时自动写入 `activity_logs`。

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 环境配置

复制 `.env.example` 为 `.env.local`，填入 Supabase 项目信息：

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 目录结构

```
src/
├── components/        # 通用组件（Layout、表单、UI 组件）
├── context/           # AuthContext 认证上下文
├── lib/               # Supabase 客户端、格式化工具
├── pages/             # 页面组件
│   ├── AuthPage.tsx          # 登录/注册
│   ├── OnboardingPage.tsx    # 组织引导
│   ├── DashboardPage.tsx     # 仪表盘
│   ├── CustomersPage.tsx     # 客户列表
│   ├── CustomerDetailPage.tsx# 客户详情
│   ├── TasksPage.tsx         # 任务列表
│   ├── TeamPage.tsx          # 团队管理
│   └── ProfilePage.tsx       # 个人资料
├── App.tsx            # 路由与权限守卫
├── types.ts           # TypeScript 类型定义
└── main.tsx           # 应用入口
supabase/
├── migrations/        # 数据库迁移 SQL
└── functions/         # Edge Functions
```

## 演示账号

- 邮箱：`demo@test.cn`
- 密码：`demo1234`
