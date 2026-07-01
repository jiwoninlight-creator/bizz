'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  UserIcon,
  XIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { getErrorMessage } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import type {
  ClassLeaderType,
  Event,
  Material,
  Teacher,
  User,
} from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

type LeaderApplicant = Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'grade'
  | 'class_number'
  | 'class_leader_type'
  | 'class_leader_status'
>

type TeacherApplicant = Pick<
  User,
  'id' | 'name' | 'email' | 'teacher_status'
> & {
  teacher_profile: Pick<
    Teacher,
    'id' | 'subject' | 'office_location' | 'managed_grades'
  > | null
}

type PendingMaterial = Material & {
  uploader: Pick<User, 'id' | 'name' | 'email'> | null
}

type PendingEvent = Event & {
  author: Pick<User, 'id' | 'name' | 'email'> | null
}

function LeaderTypeChip({ type }: { type: ClassLeaderType | null }) {
  if (!type) return null
  const label = type === 'vice_leader' ? '부반장' : '반장'
  return (
    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
      {label}
    </Badge>
  )
}

function EventTypeChip({ type }: { type: Event['event_type'] }) {
  const map = {
    assignment: { label: '과제', cls: 'bg-blue-100 text-blue-700' },
    exam: { label: '시험', cls: 'bg-red-100 text-red-700' },
    personal: { label: '개인', cls: 'bg-green-100 text-green-700' },
  }
  const meta = map[type]
  return (
    <Badge className={`${meta.cls} hover:${meta.cls}`}>{meta.label}</Badge>
  )
}

function ScopeChip({ scope, event }: { scope: Event['scope']; event: Event }) {
  if (scope === 'class') {
    return (
      <Badge variant="outline" className="border-slate-300">
        {event.grade ?? '?'}학년 {event.class_number ?? '?'}반
      </Badge>
    )
  }
  if (scope === 'grade') {
    return (
      <Badge variant="outline" className="border-slate-300">
        {event.grade ?? '?'}학년 전체
      </Badge>
    )
  }
  return null
}

export default function AdminDashboardPage() {
  const { user } = useUser()

  const [leaders, setLeaders] = useState<LeaderApplicant[]>([])
  const [teacherApplicants, setTeacherApplicants] = useState<TeacherApplicant[]>(
    []
  )
  const [materials, setMaterials] = useState<PendingMaterial[]>([])
  const [events, setEvents] = useState<PendingEvent[]>([])

  const [loadingLeaders, setLoadingLeaders] = useState(true)
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const setItemBusy = (id: string, v: boolean) =>
    setBusy((b) => ({ ...b, [id]: v }))

  const fetchLeaders = useCallback(async () => {
    setLoadingLeaders(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, name, email, grade, class_number, class_leader_type, class_leader_status'
      )
      .eq('class_leader_status', 'pending')
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    setLeaders((data ?? []) as LeaderApplicant[])
    setLoadingLeaders(false)
  }, [])

  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, name, email, teacher_status, teacher_profile:teachers!user_id(id, subject, office_location, managed_grades)'
      )
      .eq('teacher_status', 'pending')
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    const shaped = (data ?? []).map((row) => {
      const r = row as unknown as {
        id: string
        name: string
        email: string
        teacher_status: TeacherApplicant['teacher_status']
        teacher_profile:
          | TeacherApplicant['teacher_profile']
          | TeacherApplicant['teacher_profile'][]
          | null
      }
      const tp = Array.isArray(r.teacher_profile)
        ? r.teacher_profile[0] ?? null
        : r.teacher_profile ?? null
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        teacher_status: r.teacher_status,
        teacher_profile: tp,
      } as TeacherApplicant
    })
    setTeacherApplicants(shaped)
    setLoadingTeachers(false)
  }, [])

  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('materials')
      .select('*, uploader:users!uploaded_by(id, name, email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    setMaterials((data ?? []) as PendingMaterial[])
    setLoadingMaterials(false)
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('events')
      .select('*, author:users!user_id(id, name, email)')
      .eq('approval_status', 'pending')
      .in('scope', ['class', 'grade'])
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    setEvents((data ?? []) as PendingEvent[])
    setLoadingEvents(false)
  }, [])

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchLeaders(),
      fetchTeachers(),
      fetchMaterials(),
      fetchEvents(),
    ])
  }, [fetchLeaders, fetchTeachers, fetchMaterials, fetchEvents])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const approveLeader = async (a: LeaderApplicant) => {
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ role: 'class_leader', class_leader_status: 'approved' })
        .eq('id', a.id)
      if (error) throw error
      await fetchLeaders()
    } catch (err) {
      console.error('Approve leader failed:', err)
      alert(`승인 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const rejectLeader = async (a: LeaderApplicant) => {
    if (!confirm(`${a.name} 님의 신청을 반려할까요?`)) return
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ class_leader_status: 'rejected', class_leader_type: null })
        .eq('id', a.id)
      if (error) throw error
      await fetchLeaders()
    } catch (err) {
      console.error('Reject leader failed:', err)
      alert(`반려 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const approveTeacher = async (a: TeacherApplicant) => {
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ role: 'teacher', teacher_status: 'approved' })
        .eq('id', a.id)
      if (error) throw error
      await fetchTeachers()
    } catch (err) {
      console.error('Approve teacher failed:', err)
      alert(`승인 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const rejectTeacher = async (a: TeacherApplicant) => {
    if (!confirm(`${a.name} 님의 선생님 신청을 반려할까요?`)) return
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      const { error: uErr } = await supabase
        .from('users')
        .update({ teacher_status: 'rejected', role: 'student' })
        .eq('id', a.id)
      if (uErr) throw uErr
      if (a.teacher_profile?.id) {
        const { error: tErr } = await supabase
          .from('teachers')
          .delete()
          .eq('id', a.teacher_profile.id)
        if (tErr) throw tErr
      }
      await fetchTeachers()
    } catch (err) {
      console.error('Reject teacher failed:', err)
      alert(`반려 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const approveMaterial = async (m: PendingMaterial) => {
    if (!user) return
    setItemBusy(m.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('materials')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', m.id)
      if (error) throw error
      await fetchMaterials()
    } catch (err) {
      console.error('Approve material failed:', err)
      alert(`승인 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(m.id, false)
    }
  }

  const rejectMaterial = async (m: PendingMaterial) => {
    if (!confirm(`"${m.title}" 자료를 반려할까요?`)) return
    setItemBusy(m.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('materials')
        .update({ status: 'rejected' })
        .eq('id', m.id)
      if (error) throw error
      await fetchMaterials()
    } catch (err) {
      console.error('Reject material failed:', err)
      alert(`반려 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(m.id, false)
    }
  }

  const approveEvent = async (e: PendingEvent) => {
    if (!user) return
    setItemBusy(e.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('events')
        .update({ approval_status: 'approved', approved_by: user.id })
        .eq('id', e.id)
      if (error) throw error
      await fetchEvents()
    } catch (err) {
      console.error('Approve event failed:', err)
      alert(`승인 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(e.id, false)
    }
  }

  const rejectEvent = async (e: PendingEvent) => {
    if (!confirm(`"${e.title}" 공지를 반려할까요?`)) return
    setItemBusy(e.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('events')
        .update({ approval_status: 'rejected' })
        .eq('id', e.id)
      if (error) throw error
      await fetchEvents()
    } catch (err) {
      console.error('Reject event failed:', err)
      alert(`반려 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(e.id, false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">승인 대시보드</h1>
        <p className="text-sm text-slate-500">
          반장 · 자료 · 공지 승인 요청을 처리하세요.
        </p>
      </div>

      <Tabs defaultValue="leaders">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-4">
          <TabsTrigger value="leaders">
            <span className="flex items-center gap-1.5">
              반장
              <CountBadge n={leaders.length} />
            </span>
          </TabsTrigger>
          <TabsTrigger value="teachers">
            <span className="flex items-center gap-1.5">
              선생님
              <CountBadge n={teacherApplicants.length} />
            </span>
          </TabsTrigger>
          <TabsTrigger value="materials">
            <span className="flex items-center gap-1.5">
              자료
              <CountBadge n={materials.length} />
            </span>
          </TabsTrigger>
          <TabsTrigger value="events">
            <span className="flex items-center gap-1.5">
              공지
              <CountBadge n={events.length} />
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaders" className="space-y-2">
          {loadingLeaders ? (
            <LoadingState />
          ) : leaders.length === 0 ? (
            <EmptyState message="반장 승인 대기 신청이 없어요" />
          ) : (
            leaders.map((a) => (
              <Card key={a.id} size="sm" className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-slate-900">
                        {a.name}
                      </span>
                      <LeaderTypeChip type={a.class_leader_type} />
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {a.email}
                    </div>
                    <div className="mt-1 text-xs text-slate-700">
                      {a.grade ?? '?'}학년 {a.class_number ?? '?'}반
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => approveLeader(a)}
                      disabled={busy[a.id]}
                    >
                      <CheckIcon />
                      <span className="ml-1">승인</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectLeader(a)}
                      disabled={busy[a.id]}
                    >
                      <XIcon />
                      <span className="ml-1">반려</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="teachers" className="space-y-2">
          {loadingTeachers ? (
            <LoadingState />
          ) : teacherApplicants.length === 0 ? (
            <EmptyState message="선생님 승인 대기 신청이 없어요" />
          ) : (
            teacherApplicants.map((a) => (
              <Card key={a.id} size="sm" className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4 text-purple-500" />
                      <span className="font-semibold text-slate-900">
                        {a.name}
                      </span>
                      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                        선생님 신청
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {a.email}
                    </div>
                    {a.teacher_profile && (
                      <div className="mt-1.5 space-y-0.5 rounded-md bg-purple-50 px-2 py-1.5 text-xs text-slate-700">
                        <div>
                          <strong className="font-semibold">과목:</strong>{' '}
                          {a.teacher_profile.subject}
                        </div>
                        <div>
                          <strong className="font-semibold">담당 학년:</strong>{' '}
                          {a.teacher_profile.managed_grades
                            ?.map((g) => `${g}학년`)
                            .join(', ') || '없음'}
                        </div>
                        <div>
                          <strong className="font-semibold">연구실:</strong>{' '}
                          {a.teacher_profile.office_location || '미입력'}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => approveTeacher(a)}
                      disabled={busy[a.id]}
                    >
                      <CheckIcon />
                      <span className="ml-1">승인</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectTeacher(a)}
                      disabled={busy[a.id]}
                    >
                      <XIcon />
                      <span className="ml-1">반려</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="materials" className="space-y-2">
          {loadingMaterials ? (
            <LoadingState />
          ) : materials.length === 0 ? (
            <EmptyState message="자료 승인 대기가 없어요" />
          ) : (
            materials.map((m) => (
              <Card key={m.id} size="sm" className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {m.title}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {m.subject}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {m.grade}학년
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {m.file_type}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {m.uploader?.name ?? '알 수 없음'} ·{' '}
                      {m.uploader?.email ?? ''}
                    </div>
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLinkIcon className="h-3 w-3" />
                      파일 확인
                    </a>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => approveMaterial(m)}
                      disabled={busy[m.id]}
                    >
                      <CheckIcon />
                      <span className="ml-1">승인</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMaterial(m)}
                      disabled={busy[m.id]}
                    >
                      <XIcon />
                      <span className="ml-1">반려</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="events" className="space-y-2">
          {loadingEvents ? (
            <LoadingState />
          ) : events.length === 0 ? (
            <EmptyState message="공지 승인 대기가 없어요" />
          ) : (
            events.map((e) => (
              <Card key={e.id} size="sm" className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {e.title}
                      </span>
                      <EventTypeChip type={e.event_type} />
                      <ScopeChip scope={e.scope} event={e} />
                    </div>
                    <div className="mt-1 text-xs text-slate-700">
                      {e.event_date}
                      {e.subject ? ` · ${e.subject}` : ''}
                    </div>
                    {e.memo && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-600">
                        {e.memo}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-slate-500">
                      {e.author?.name ?? '알 수 없음'} ·{' '}
                      {e.author?.email ?? ''}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => approveEvent(e)}
                      disabled={busy[e.id]}
                    >
                      <CheckIcon />
                      <span className="ml-1">승인</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectEvent(e)}
                      disabled={busy[e.id]}
                    >
                      <XIcon />
                      <span className="ml-1">반려</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CountBadge({ n }: { n: number }) {
  return (
    <span
      className={
        n > 0
          ? 'rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700'
          : 'rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500'
      }
    >
      {n}
    </span>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10 text-slate-400">
      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
      <span className="text-sm">불러오는 중…</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
      {message}
    </div>
  )
}
