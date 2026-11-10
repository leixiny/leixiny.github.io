/**
 * 路由分块预取。
 *
 * 页面按路由拆包以后，点「项目」要先把那份 JS 拉下来才开始渲染 ——
 * 本地看不出，线上一慢就是一拍空白。鼠标移到胶囊上就开始拉，
 * 手指按住到松开那一两百毫秒也就够下载了；真到了要渲染的时候，包已经在内存里。
 *
 * 静置三秒后再把后台几个常用页一次性预取，第一次进后台就都是热的。
 */
import {
  AuthPage,
  CustomersPage,
  DashboardPage,
  ProfilePage,
  TasksPage,
  TeamPage,
  WorksStudioPage,
} from './pages'

const loaders: Record<string, () => Promise<void>> = {
  '/app': DashboardPage.preload,
  '/manage': WorksStudioPage.preload,
  '/app/customers': CustomersPage.preload,
  '/app/tasks': TasksPage.preload,
  '/app/team': TeamPage.preload,
  '/app/profile': ProfilePage.preload,
  '/login': AuthPage.preload,
}

const started = new Set<string>()

export function prefetch(path: string) {
  const load = loaders[path]
  if (!load || started.has(path)) return
  started.add(path)
  // 失败就算了：真点进去时再拉一次，loader 会重新发请求
  load().catch(() => started.delete(path))
}

/** 空闲时把后台页面都捂热；首屏不跟它抢带宽 */
export function prefetchAdmin() {
  const run = () => {
    for (const path of ['/app', '/app/customers', '/app/tasks', '/manage']) prefetch(path)
  }
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
  if (idle) idle(run)
  else window.setTimeout(run, 1500)
}
