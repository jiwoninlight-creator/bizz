'use client'

import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-client'
import type { User } from '@/types/database'

type UseUserResult = {
  user: SupabaseUser | null
  profile: User | null
  loading: boolean
  isAdmin: boolean
  isClassLeader: boolean
  isTeacher: boolean
  refresh: () => Promise<void>
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    async function loadProfile(authUser: SupabaseUser | null) {
      if (!authUser) {
        if (active) {
          setProfile(null)
          setLoading(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single<User>()

      if (!active) return

      if (error) {
        console.error('Failed to load user profile:', error)
        setProfile(null)
      } else {
        setProfile(data)
      }
      setLoading(false)
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      setUser(data.user)
      loadProfile(data.user)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      const nextUser = session?.user ?? null
      setUser(nextUser)
      setLoading(true)
      loadProfile(nextUser)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [refreshTick])

  const refresh = async () => {
    setRefreshTick((t) => t + 1)
  }

  const isAdmin = profile?.role === 'admin'
  const isClassLeader =
    profile?.role === 'class_leader' &&
    profile?.class_leader_status === 'approved'
  const isTeacher =
    profile?.role === 'teacher' && profile?.teacher_status === 'approved'

  return {
    user,
    profile,
    loading,
    isAdmin,
    isClassLeader,
    isTeacher,
    refresh,
  }
}
