import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Organization, Profile, Role } from '../types'

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

  async function loadProfile(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null)
      setOrganization(null)
      setRole(null)
      writeSnapshot(null)
      return
    }

    const { data: nextProfile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', nextSession.user.id)
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
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      // 有快照就先放行：页面立刻能画出侧栏和分区，档案在背后校准
      if (snapshot.current && data.session) setLoading(false)
      await loadProfile(data.session)
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
      refreshProfile: () => loadProfile(session),
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
