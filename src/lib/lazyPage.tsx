import { useReducer } from 'react'
import type { ComponentType } from 'react'

/**
 * 按路由拆包之后的页面加载器 —— 不用 React.lazy。
 *
 * React.lazy 在首次挂起以后，会按普通优先级延后一拍再重试，
 * 实测这一拍是 300ms：包早就下完了，页面还要空白小半秒。
 * 这里自己管：渲染时就发起 import，模块一到就重渲染；
 * 页面预热过（鼠标划过胶囊、或者后台静置时预取）就是同步渲染，一帧都不等。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Loader = () => Promise<{ default: ComponentType<any> }>

export function createPage(load: Loader, fallback: 'skeleton' | 'none' = 'skeleton') {
  let Comp: ComponentType<any> | null = null
  let started: Promise<void> | null = null

  const start = () => {
    if (!started) {
      started = load()
        .then((mod) => {
          Comp = mod.default
        })
        .catch((error) => {
          // 断网、稍后重试：把 started 放掉，下一次渲染会重新发
          started = null
          throw error
        })
    }
    return started
  }

  function Page() {
    const [, bump] = useReducer((n: number) => n + 1, 0)

    if (!Comp) {
      start().then(bump, bump)
      // 登录、引导这类整屏页面本来就空着等，硬塞几条灰杠反而更跳
      return fallback === 'none' ? null : <PageSkeleton />
    }

    const Ready = Comp
    return <Ready />
  }

  return Object.assign(Page, { preload: () => start().catch(() => {}) })
}

/** 分块还在路上时的占位：几条和正文同宽的灰条，位置跟真内容差不多 */
export function PageSkeleton() {
  return (
    <div className="axon-skel" aria-hidden="true">
      <span className="axon-skel-title" />
      <span className="axon-skel-line" />
      <span className="axon-skel-block" />
      <span className="axon-skel-block short" />
    </div>
  )
}
