'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import QuickShell from '@/components/quick/QuickShell'

export default function QuickAdminPage() {
  const router = useRouter()
  const { profile, loading } = useUser()
  const [counts, setCounts] = useState({
    leader: 0,
    teacher: 0,
    material: 0,
    event: 0,
  })
  const [dataLoading, setDataLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!profile || profile.role !== 'admin') {
      setDataLoading(false)
      return
    }

    async function loadCounts() {
      const [leaderRes, teacherRes, materialRes, eventRes] = await Promise.all([
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('class_leader_status', 'pending'),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('teacher_status', 'pending'),
        supabase
          .from('materials')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending'),
      ])

      setCounts({
        leader: leaderRes.count ?? 0,
        teacher: teacherRes.count ?? 0,
        material: materialRes.count ?? 0,
        event: eventRes.count ?? 0,
      })
      setDataLoading(false)
    }
    loadCounts()
  }, [profile])

  const total =
    counts.leader + counts.teacher + counts.material + counts.event

  if (loading || dataLoading) {
    return (
      <QuickShell>
        <p className="text-zinc-400 text-sm">불러오는 중...</p>
      </QuickShell>
    )
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <QuickShell>
        <p className="text-white text-base font-medium">
          관리자 전용 화면이에요
        </p>
        <button
          onClick={() => router.push('/quick/today')}
          className="mt-4 text-sm text-zinc-400 underline"
        >
          오늘 일정 보기
        </button>
      </QuickShell>
    )
  }

  return (
    <QuickShell>
      <div
        className={`text-7xl font-bold tracking-tight ${
          total > 0 ? 'text-red-400' : 'text-zinc-600'
        }`}
      >
        {total}
      </div>
      <p className="text-sm text-zinc-400 mt-2">승인 대기</p>

      <div className="w-full border-t border-zinc-800 my-6" />

      <div className="text-xs text-zinc-500 space-y-1">
        <p>
          반장/부반장 {counts.leader} · 선생님 {counts.teacher}
        </p>
        <p>
          자료 {counts.material} · 공지 {counts.event}
        </p>
      </div>

      <button
        onClick={() => router.push('/admin')}
        className="mt-6 text-sm text-indigo-400 underline"
      >
        관리자 페이지에서 처리하기
      </button>
    </QuickShell>
  )
}
