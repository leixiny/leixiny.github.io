import { createContext, useContext, useEffect, useMemo, useState } from 'react'
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null)
      setOrganization(null)
      setRole(null)
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
      return
    }

    setProfile(nextProfile)

    if (!nextProfile.organization_id) {
      setOrganization(null)
      setRole(null)
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
  }

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session)
      setLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession)
      await loadProfile(nextSession)
      setLoading(false)
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
