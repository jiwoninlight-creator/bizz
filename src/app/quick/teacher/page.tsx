'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import QuickShell from '@/components/quick/QuickShell'
import type { TeacherStatus } from '@/types/database'

export default function QuickTeacherPage() {
  const router = useRouter()
  const { user, profile, loading } = useUser()
  const [unreadCount, setUnreadCount] = useState(0)
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [status, setStatus] = useState<TeacherStatus>('unknown')
  const [dataLoading, setDataLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user || !profile) return
    if (profile.role !== 'teacher' || profile.teacher_status !== 'approved') {
      setDataLoading(false)
      return
    }

    async function loadData() {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user!.id)
        .eq('is_read', false)

      setUnreadCount(count ?? 0)

      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('id, current_status')
        .eq('user_id', user!.id)
        .maybeSingle<{ id: string; current_status: TeacherStatus }>()

      if (teacherRow) {
        setTeacherId(teacherRow.id)
        setStatus(teacherRow.current_status ?? 'unknown')
      }
      setDataLoading(false)
    }
    loadData()
  }, [user, profile])

  const handleStatusChange = async (newStatus: TeacherStatus) => {
    if (!teacherId) return
    setStatus(newStatus)
    await supabase
      .from('teachers')
      .update({ current_status: newStatus })
      .eq('id', teacherId)
  }

  if (loading || dataLoading) {
    return (
      <QuickShell>
        <p className="text-zinc-400 text-sm">불러오는 중...</p>
      </QuickShell>
    )
  }

  if (
    !profile ||
    profile.role !== 'teacher' ||
    profile.teacher_status !== 'approved'
  ) {
    return (
      <QuickShell>
        <p className="text-white text-base font-medium">
          이 화면은 선생님 계정 전용이에요
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
          unreadCount > 0 ? 'text-indigo-400' : 'text-zinc-600'
        }`}
      >
        {unreadCount}
      </div>
      <p className="text-sm text-zinc-400 mt-2">안읽은 메시지</p>

      <div className="w-full border-t border-zinc-800 my-6" />

      <p className="text-sm text-zinc-400 mb-3">지금 상태</p>
      <div className="w-full flex flex-col gap-2">
        <button
          onClick={() => handleStatusChange('available')}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
            status === 'available'
              ? 'bg-white text-zinc-900'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          😌 여유 있음
        </button>
        <button
          onClick={() => handleStatusChange('out')}
          className={`w-full py-3 rounded-xl text-sm font-medium transition-colors ${
            status === 'out'
              ? 'bg-white text-zinc-900'
              : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          🏃 바쁨 · 외출
        </button>
      </div>
    </QuickShell>
  )
}
