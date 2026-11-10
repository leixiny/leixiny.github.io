import { createPage } from './lazyPage'

/**
 * 后台各页的入口。集中在一处，是为了让「进哪一页要下哪一份包」
 * 在预取和路由两边用的是同一个函数 —— 预取过的那一份不会再下一次。
 */
export const AuthPage = createPage(() => import('../pages/AuthPage'), 'none')
export const GrowthPage = createPage(() => import('../pages/GrowthPage'), 'none')
export const OnboardingPage = createPage(() => import('../pages/OnboardingPage'), 'none')
export const DashboardPage = createPage(() => import('../pages/DashboardPage'))
export const CustomersPage = createPage(() => import('../pages/CustomersPage'))
export const CustomerDetailPage = createPage(() => import('../pages/CustomerDetailPage'))
export const TasksPage = createPage(() => import('../pages/TasksPage'))
export const TeamPage = createPage(() => import('../pages/TeamPage'))
export const ProfilePage = createPage(() => import('../pages/ProfilePage'))
/** 新管理系统：只管作品编辑，旧后台（主页）不再挂它 */
export const WorksStudioPage = createPage(() => import('../pages/WorksStudioPage'))
