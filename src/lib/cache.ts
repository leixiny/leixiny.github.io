/**
 * 页面数据的短期缓存（stale-while-revalidate 的最简版）。
 *
 * 后台每个页面一进来就先发请求，回来之前是一块空白 —— 点一下就白一下，
 * 来回切三次就白三次。台账、看板这类数据量小，先拿上次的结果铺上去，
 * 请求回来再覆盖，切页就不再经过「空 → 有」这一下。
 *
 * 只放在内存里：刷新页面就是一次干净的重来，不会读到过期的账。
 */
type Entry = { data: unknown; at: number }

const store = new Map<string, Entry>()

/** 超过这个时间的数据不再用来「先铺一下」；实时订阅会自己把新数据推进来 */
const MAX_AGE = 5 * 60_000

export function peek<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.at > MAX_AGE) {
    store.delete(key)
    return undefined
  }
  return entry.data as T
}

export function put<T>(key: string, data: T) {
  store.set(key, { data, at: Date.now() })
}

export function drop(key: string) {
  store.delete(key)
}

/** 同一批实时事件里连着来三条，只刷一次 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 260) {
  let timer = 0
  const wrapped = (...args: A) => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), wait)
  }
  wrapped.cancel = () => window.clearTimeout(timer)
  return wrapped
}
