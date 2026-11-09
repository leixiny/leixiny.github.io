// 开屏幕布与首页落笔的同步点：幕布散场后才通知首页开始书写
let done = false
const listeners = new Set<() => void>()

export function markIntroDone() {
  if (done) return
  done = true
  listeners.forEach((listener) => listener())
  listeners.clear()
}

export function onIntroDone(callback: () => void): () => void {
  if (done) {
    callback()
    return () => {}
  }
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}
