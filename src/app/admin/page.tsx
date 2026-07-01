'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PencilIcon,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type ProfileChangeApplicant = Pick<
  User,
  | 'id'
  | 'name'
  | 'email'
  | 'grade'
  | 'class_number'
  | 'pending_grade'
  | 'pending_class_number'
  | 'profile_change_status'
>

const SUBJECT_OPTIONS = [
  '국어',
  '영어',
  '수학',
  '과학',
  '사회',
  '역사',
  '기타',
] as const

const CATEGORY_OPTIONS = [
  '수업자료',
  '교과서',
  '시험지',
  '참고자료',
  '기타',
] as const

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
    assignment: {
      label: '과제',
      cls: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    },
    exam: {
      label: '시험',
      cls: 'bg-red-50 text-red-700 border border-red-200',
    },
    personal: {
      label: '개인',
      cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    },
  }
  const meta = map[type]
  return (
    <Badge className={`${meta.cls} hover:${meta.cls}`}>{meta.label}</Badge>
  )
}

function ScopeChip({ scope, event }: { scope: Event['scope']; event: Event }) {
  if (scope === 'class') {
    return (
      <Badge variant="outline" className="border-zinc-300">
        {event.grade ?? '?'}학년 {event.class_number ?? '?'}반
      </Badge>
    )
  }
  if (scope === 'grade') {
    return (
      <Badge variant="outline" className="border-zinc-300">
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
  const [profileChanges, setProfileChanges] = useState<ProfileChangeApplicant[]>(
    []
  )

  const [loadingLeaders, setLoadingLeaders] = useState(true)
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [loadingProfileChanges, setLoadingProfileChanges] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const [editingMaterial, setEditingMaterial] = useState<PendingMaterial | null>(
    null
  )

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
      .in('teacher_status', ['pending', 'pending_downgrade'])
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

  const fetchProfileChanges = useCallback(async () => {
    setLoadingProfileChanges(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('users')
      .select(
        'id, name, email, grade, class_number, pending_grade, pending_class_number, profile_change_status'
      )
      .eq('profile_change_status', 'pending')
      .order('created_at', { ascending: true })
    if (error) console.error(error)
    setProfileChanges((data ?? []) as ProfileChangeApplicant[])
    setLoadingProfileChanges(false)
  }, [])

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchLeaders(),
      fetchTeachers(),
      fetchMaterials(),
      fetchEvents(),
      fetchProfileChanges(),
    ])
  }, [
    fetchLeaders,
    fetchTeachers,
    fetchMaterials,
    fetchEvents,
    fetchProfileChanges,
  ])

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
    const isDowngrade = a.teacher_status === 'pending_downgrade'
    if (isDowngrade) {
      if (
        !confirm(
          `${a.name} 님을 학생 계정으로 전환할까요?\n\n선생님 정보(자료·시간표 등)는 익명 형태로 유지되며 계정 연결만 해제됩니다.`
        )
      )
        return
    }
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      if (isDowngrade) {
        const { error } = await supabase
          .from('users')
          .update({ role: 'student', teacher_status: 'none' })
          .eq('id', a.id)
        if (error) throw error
        if (a.teacher_profile?.id) {
          const { error: tErr } = await supabase
            .from('teachers')
            .update({ user_id: null })
            .eq('id', a.teacher_profile.id)
          if (tErr) throw tErr
        }
      } else {
        const { error } = await supabase
          .from('users')
          .update({ role: 'teacher', teacher_status: 'approved' })
          .eq('id', a.id)
        if (error) throw error
      }
      await fetchTeachers()
    } catch (err) {
      console.error('Approve teacher failed:', err)
      alert(`승인 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const rejectTeacher = async (a: TeacherApplicant) => {
    const isDowngrade = a.teacher_status === 'pending_downgrade'
    const msg = isDowngrade
      ? `${a.name} 님의 학생 전환 요청을 반려할까요?`
      : `${a.name} 님의 선생님 신청을 반려할까요?`
    if (!confirm(msg)) return
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      if (isDowngrade) {
        // 반려 = 요청 취소. 선생님 상태로 복귀.
        const { error } = await supabase
          .from('users')
          .update({ teacher_status: 'approved' })
          .eq('id', a.id)
        if (error) throw error
      } else {
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
      }
      await fetchTeachers()
    } catch (err) {
      console.error('Reject teacher failed:', err)
      alert(`반려 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const approveProfileChange = async (a: ProfileChangeApplicant) => {
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          grade: a.pending_grade ?? a.grade,
          class_number: a.pending_class_number ?? a.class_number,
          pending_grade: null,
          pending_class_number: null,
          profile_change_status: 'none',
        })
        .eq('id', a.id)
      if (error) throw error
      await fetchProfileChanges()
    } catch (err) {
      console.error('Approve profile change failed:', err)
      alert(`승인 실패: ${getErrorMessage(err)}`)
    } finally {
      setItemBusy(a.id, false)
    }
  }

  const rejectProfileChange = async (a: ProfileChangeApplicant) => {
    if (!confirm(`${a.name} 님의 정보 변경 요청을 반려할까요?`)) return
    setItemBusy(a.id, true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          pending_grade: null,
          pending_class_number: null,
          profile_change_status: 'rejected',
        })
        .eq('id', a.id)
      if (error) throw error
      await fetchProfileChanges()
    } catch (err) {
      console.error('Reject profile change failed:', err)
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
        <h1 className="text-2xl font-bold text-zinc-900">승인 대시보드</h1>
        <p className="text-sm text-zinc-500">
          반장 · 자료 · 공지 승인 요청을 처리하세요.
        </p>
      </div>

      <Tabs defaultValue="leaders">
        <TabsList className="grid w-full grid-cols-3 gap-1 sm:grid-cols-5">
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
          <TabsTrigger value="profile-changes">
            <span className="flex items-center gap-1.5">
              정보 변경
              <CountBadge n={profileChanges.length} />
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
                      <UserIcon className="h-4 w-4 text-zinc-400" />
                      <span className="font-semibold text-zinc-900">
                        {a.name}
                      </span>
                      <LeaderTypeChip type={a.class_leader_type} />
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {a.email}
                    </div>
                    <div className="mt-1 text-xs text-zinc-700">
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
            teacherApplicants.map((a) => {
              const isDowngrade = a.teacher_status === 'pending_downgrade'
              return (
                <Card key={a.id} size="sm" className="px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <UserIcon
                          className={
                            isDowngrade
                              ? 'h-4 w-4 text-amber-500'
                              : 'h-4 w-4 text-indigo-500'
                          }
                        />
                        <span className="font-semibold text-zinc-900">
                          {a.name}
                        </span>
                        {isDowngrade ? (
                          <span className="inline-flex h-5 items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">
                            학생 전환
                          </span>
                        ) : (
                          <span className="inline-flex h-5 items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 text-[11px] font-medium text-indigo-700">
                            선생님 신청
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {a.email}
                      </div>
                      {a.teacher_profile && !isDowngrade && (
                        <div className="mt-1.5 space-y-0.5 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-xs text-zinc-700">
                          <div>
                            <strong className="font-semibold">과목:</strong>{' '}
                            {a.teacher_profile.subject}
                          </div>
                          <div>
                            <strong className="font-semibold">
                              담당 학년:
                            </strong>{' '}
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
                      {isDowngrade && (
                        <div className="mt-1.5 rounded-md border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                          선생님 → 학생 계정 전환 요청. 승인 시 자료 등록 및
                          공지 권한이 해제되고, 등록된 선생님 프로필의 계정
                          연결만 해제돼요.
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
              )
            })
          )}
        </TabsContent>

        <TabsContent value="profile-changes" className="space-y-2">
          {loadingProfileChanges ? (
            <LoadingState />
          ) : profileChanges.length === 0 ? (
            <EmptyState message="정보 변경 요청이 없어요" />
          ) : (
            profileChanges.map((a) => {
              const before = `${a.grade ?? '?'}학년 ${a.class_number ?? '?'}반`
              const after = `${a.pending_grade ?? a.grade ?? '?'}학년 ${a.pending_class_number ?? a.class_number ?? '?'}반`
              return (
                <Card key={a.id} size="sm" className="px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">
                          {a.name}
                        </span>
                        <span className="inline-flex h-5 items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 text-[11px] font-medium text-amber-700">
                          정보 변경
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {a.email}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-700">
                        <span className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-zinc-600">
                          현재: {before}
                        </span>
                        <ArrowRightIcon className="h-3 w-3 text-zinc-400" />
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">
                          요청: {after}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => approveProfileChange(a)}
                        disabled={busy[a.id]}
                      >
                        <CheckIcon />
                        <span className="ml-1">승인</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectProfileChange(a)}
                        disabled={busy[a.id]}
                      >
                        <XIcon />
                        <span className="ml-1">반려</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })
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
                      <span className="font-semibold text-zinc-900">
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
                    <div className="mt-1 text-xs text-zinc-500">
                      {m.uploader?.name ?? '알 수 없음'} ·{' '}
                      {m.uploader?.email ?? ''}
                    </div>
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
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
                      onClick={() => setEditingMaterial(m)}
                      disabled={busy[m.id]}
                    >
                      <PencilIcon />
                      <span className="ml-1">수정</span>
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
                      <span className="font-semibold text-zinc-900">
                        {e.title}
                      </span>
                      <EventTypeChip type={e.event_type} />
                      <ScopeChip scope={e.scope} event={e} />
                    </div>
                    <div className="mt-1 text-xs text-zinc-700">
                      {e.event_date}
                      {e.subject ? ` · ${e.subject}` : ''}
                    </div>
                    {e.memo && (
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-zinc-600">
                        {e.memo}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-zinc-500">
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

      <MaterialEditDialog
        material={editingMaterial}
        onOpenChange={(v) => {
          if (!v) setEditingMaterial(null)
        }}
        onSaved={async () => {
          setEditingMaterial(null)
          await fetchMaterials()
        }}
      />
    </div>
  )
}

/* ------------------------ Material edit dialog --------------------------- */

type MaterialEditDialogProps = {
  material: PendingMaterial | null
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void> | void
}

function MaterialEditDialog({
  material,
  onOpenChange,
  onSaved,
}: MaterialEditDialogProps) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [grade, setGrade] = useState('')
  const [classNumber, setClassNumber] = useState('')
  const [category, setCategory] = useState('')
  const [teachers, setTeachers] = useState<Pick<Teacher, 'id' | 'name' | 'subject'>[]>(
    []
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!material) return
    setTitle(material.title)
    setSubject(material.subject)
    setTeacherId(material.teacher_id ?? '')
    setGrade(String(material.grade))
    setClassNumber(material.class_number ? String(material.class_number) : '')
    setCategory(material.category ?? '')
  }, [material])

  useEffect(() => {
    if (!material) return
    const supabase = createClient()
    supabase
      .from('teachers')
      .select('id, name, subject')
      .order('name', { ascending: true })
      .then(({ data }) => {
        setTeachers((data ?? []) as Pick<Teacher, 'id' | 'name' | 'subject'>[])
      })
  }, [material])

  if (!material) return null

  const save = async () => {
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }
    if (!subject || !grade) {
      alert('과목과 학년을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('materials')
        .update({
          title: title.trim(),
          subject,
          teacher_id: teacherId || null,
          grade: Number(grade),
          class_number: classNumber ? Number(classNumber) : null,
          category: category || null,
        })
        .eq('id', material.id)
      if (error) throw error
      await onSaved()
    } catch (err) {
      console.error('material edit failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!material} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>자료 수정</DialogTitle>
          <DialogDescription>
            제목·과목·선생님·학년·반·카테고리를 수정할 수 있어요.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="me-title">제목</Label>
            <Input
              id="me-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="me-subject">과목</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="me-subject" className="h-9 w-full">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-category">카테고리</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="me-category" className="h-9 w-full">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="me-grade">학년</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="me-grade" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {g}학년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-class">공개 범위 (반)</Label>
              <Select
                value={classNumber || 'all'}
                onValueChange={(v) => setClassNumber(v === 'all' ? '' : v)}
              >
                <SelectTrigger id="me-class" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">학년 전체</SelectItem>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="me-teacher">선생님 (선택)</Label>
            <Select
              value={teacherId || 'none'}
              onValueChange={(v) => setTeacherId(v === 'none' ? '' : v)}
            >
              <SelectTrigger id="me-teacher" className="h-9 w-full">
                <SelectValue placeholder="선생님" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">공통 · 교과서</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="ml-1.5">저장 중…</span>
              </>
            ) : (
              '저장'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CountBadge({ n }: { n: number }) {
  return (
    <span
      className={
        n > 0
          ? 'inline-flex h-4 min-w-4 items-center justify-center rounded-md border border-red-200 bg-red-50 px-1 text-[10px] font-semibold text-red-600'
          : 'inline-flex h-4 min-w-4 items-center justify-center rounded-md border border-zinc-200 bg-white px-1 text-[10px] font-semibold text-zinc-500'
      }
    >
      {n}
    </span>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-10 text-zinc-400">
      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
      <span className="text-sm">불러오는 중…</span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
      {message}
    </div>
  )
}
