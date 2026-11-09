/** 上次登录成功的凭据。存 localStorage（和 Supabase 自己放 session 的位置同一档安全级别）。
 *
 *  这个站就自己一个人用，进管理系统不该再被登录页拦一次：
 *  session 过期或被清掉时，后台用这份凭据静默换一个新 session，
 *  登录页只在「换了设备 / 从没登录过 / 密码改了」时才出现。 */

export const REMEMBER_KEY = 'axon:remember'

export type RememberedCreds = { email: string; password: string }

export function readRemembered(): RememberedCreds | null {
  try {
    const raw = JSON.parse(localStorage.getItem(REMEMBER_KEY) || 'null')
    if (raw && typeof raw.email === 'string' && typeof raw.password === 'string' && raw.email && raw.password) {
      return { email: raw.email, password: raw.password }
    }
  } catch {
    /* 坏了就当没记过 */
  }
  return null
}

export function saveRemembered(creds: RememberedCreds) {
  try {
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(creds))
  } catch {
    /* 隐私模式下写不进去，下次还得敲一次密码 */
  }
}

export function clearRemembered() {
  try {
    localStorage.removeItem(REMEMBER_KEY)
  } catch {
    /* 忽略 */
  }
}
