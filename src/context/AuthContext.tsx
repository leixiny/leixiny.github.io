import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { readRemembered } from '../lib/remember'
import type { Organization, Profile, Role } from '../types'

/** 一次页面加载只静默试一次：失败就认账，别再反复打登录接口 */
let silentAttempted = false

/**
 * 拿到一个能用的 session。
 *
 * 本地存着的 session 可能是过期的（access token 一小时就废），刷新失败时 supabase 只留个空壳，
 * 这时候用户点「进入管理系统」就被丢回登录页 —— 明明上次已经登录过。
 * 所以：过期的先就地刷新一次，刷不动就用上次记住的账号密码静默换一个新的，全过程不给登录页露脸。
 * 没过期就直接信本地那一个 —— 不额外发请求，进后台还是上次那种秒开。
 */
async function resolveSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  let current = error ? null : data.session

  if (current) {
    const exp = current.expires_at ?? 0
    const stale = exp > 0 && exp * 1000 < Date.now() + 30_000
    if (stale) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError || !refreshed.session) {
        // 空壳 session 留着只会让后台查询一路 401，先清掉
        await supabase.auth.signOut({ scope: 'local' })
        current = null
      } else {
        current = refreshed.session
      }
    }
  }

  if (current || silentAttempted) return current
  silentAttempted = true

  const creds = readRemembered()
  if (!creds) return null

  const { data: signIn } = await supabase.auth.signInWithPassword(creds)
  return signIn.session ?? null
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  organization: Organization | null
  role: Role | null
  loading: boolean
  configured: boolean
  refreshProfile: () => Promise<void>
}

/**
 * 上次登录时留下的档案快照。
 *
 * 进后台要等查档案、查组织、查角色三个来回，线上就是半秒多的整屏加载页 ——
 * 从首页点「进入管理系统」时那半秒最刺眼。先把上次的档案铺上去（本地读，零等待），
 * 请求回来再校准；档案错了、角色变了都会在下一拍纠正过来。
 * 只存档案，不存 token —— 认证仍然完全交给 supabase。
 */
const SNAPSHOT_KEY = 'axon:auth-snapshot'

type Snapshot = { profile: Profile; organization: Organization | null; role: Role | null }

function readSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    return raw ? (JSON.parse(raw) as Snapshot) : null
  } catch {
    return null
  }
}

function writeSnapshot(next: Snapshot | null) {
  try {
    if (next) localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next))
    else localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    /* 隐私模式下写不进去就算了，只是少一次秒开 */
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useRef<Snapshot | null>(readSnapshot())
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(snapshot.current?.profile ?? null)
  const [organization, setOrganization] = useState<Organization | null>(snapshot.current?.organization ?? null)
  const [role, setRole] = useState<Role | null>(snapshot.current?.role ?? null)
  const [loading, setLoading] = useState(true)
  // 同一个人的档案只查一次，且两次调用共享同一个 promise
  const inflight = useRef<{ id: string; promise: Promise<void> } | null>(null)

  function loadProfile(nextSession: Session | null): Promise<void> {
    if (!nextSession) {
      setProfile(null)
      setOrganization(null)
      setRole(null)
      writeSnapshot(null)
      return Promise.resolve()
    }

    const id = nextSession.user.id
    // 静默登录会连发 SIGNED_IN，别为同一个人查两遍；
    // 共享 promise 还有个用处：谁都不能在档案落地前就把 loading 关掉，否则会被弹去 onboarding
    if (inflight.current?.id === id) return inflight.current.promise

    const promise = (async () => {
      const { data: nextProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single<Profile>()

      if (error) {
        setProfile(null)
        setOrganization(null)
        setRole(null)
        writeSnapshot(null)
        return
      }

      setProfile(nextProfile)

      if (!nextProfile.organization_id) {
        setOrganization(null)
        setRole(null)
        writeSnapshot({ profile: nextProfile, organization: null, role: null })
        return
      }

      const [{ data: nextOrganization }, { data: membership }] = await Promise.all([
        supabase
          .from('organizations')
          .select('*')
          .eq('id', nextProfile.organization_id)
          .single<Organization>(),
        supabase
          .from('organization_members')
          .select('role')
          .eq('organization_id', nextProfile.organization_id)
          .eq('profile_id', nextProfile.id)
          .single<{ role: Role }>(),
      ])

      setOrganization(nextOrganization)
      setRole(membership?.role ?? null)
      writeSnapshot({ profile: nextProfile, organization: nextOrganization, role: membership?.role ?? null })
    })()

    inflight.current = { id, promise }
    promise.finally(() => {
      if (inflight.current?.promise === promise) inflight.current = null
    })
    return promise
  }

  useEffect(() => {
    let active = true

    resolveSession().then(async (next) => {
      if (!active) return
      setSession(next)
      // 有快照就先放行：页面立刻能画出侧栏和分区，档案在背后校准
      if (snapshot.current && next) setLoading(false)
      await loadProfile(next)
      if (active) setLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      await loadProfile(nextSession)
      if (active) setLoading(false)
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      organization,
      role,
      loading,
      configured: isSupabaseConfigured,
      refreshProfile: () => {
        // 改完资料要拿最新的，绕开上面那层缓存
        inflight.current = null
        return loadProfile(session)
      },
    }),
    [session, profile, organization, role, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用')
  }
  return context
}
