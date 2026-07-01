'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  CheckCircle2Icon,
  ClockIcon,
  GraduationCapIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  ShieldIcon,
  Trash2Icon,
  XCircleIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { CLASS_OPTIONS } from '@/lib/school-schedule'
import type {
  ClassLeaderType,
  Teacher,
  TeacherSchedule,
  TeacherStatus,
  User,
} from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const TEACHER_SUBJECTS = [
  '국어',
  '영어',
  '수학',
  '과학',
  '사회',
  '역사',
  '물리',
  '화학',
  '생물',
  '지구과학',
  '기타',
] as const

const GRADES = [1, 2, 3] as const
const DAY_LABELS = ['월', '화', '수', '목', '금'] as const
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const

const STATUS_OPTIONS: {
  value: TeacherStatus
  label: string
  activeCls: string
}[] = [
  { value: 'available', label: '자리 있음', activeCls: 'bg-emerald-500' },
  { value: 'in_class', label: '수업 중', activeCls: 'bg-amber-500' },
  { value: 'meeting', label: '회의 중', activeCls: 'bg-red-500' },
  { value: 'out', label: '외출', activeCls: 'bg-zinc-500' },
]

type Refresh = () => Promise<void>

export default function SettingsPage() {
  const { user, profile, loading, refresh } = useUser()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [teacherLoading, setTeacherLoading] = useState(false)

  const isApprovedTeacher =
    profile?.role === 'teacher' && profile?.teacher_status === 'approved'

  const fetchTeacher = useCallback(async () => {
    if (!user?.id) return
    setTeacherLoading(true)
    try {
      const supabase = createClient()
      const { data: t } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle<Teacher>()
      setTeacher(t ?? null)
      if (t) {
        const { data: s } = await supabase
          .from('teacher_schedules')
          .select('*')
          .eq('teacher_id', t.id)
        setSchedules((s ?? []) as TeacherSchedule[])
      } else {
        setSchedules([])
      }
    } finally {
      setTeacherLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) fetchTeacher()
  }, [user?.id, fetchTeacher])

  if (loading || !profile || !user) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    )
  }

  const canApplyTeacher =
    profile.role !== 'teacher' && profile.role !== 'admin'

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          설정
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          계정 정보와 프로필을 한 곳에서 관리해요.
        </p>
      </div>

      <ProfileInfoCard user={user} profile={profile} refresh={refresh} />

      <RoleCard profile={profile} refresh={refresh} />

      {isApprovedTeacher && (
        <TeacherProfileCard
          user={user}
          profile={profile}
          teacher={teacher}
          loading={teacherLoading}
          onUpdated={fetchTeacher}
        />
      )}

      {isApprovedTeacher && teacher && (
        <TeacherScheduleCard
          teacherId={teacher.id}
          schedules={schedules}
          onUpdated={fetchTeacher}
        />
      )}

      {canApplyTeacher && (
        <TeacherApplyCard
          user={user}
          profile={profile}
          teacher={teacher}
          refresh={refresh}
          onUpdated={fetchTeacher}
        />
      )}
    </div>
  )
}

/* ================================ Section 1 =============================== */

function ProfileInfoCard({
  user,
  profile,
  refresh,
}: {
  user: SupabaseUser
  profile: User
  refresh: Refresh
}) {
  const [name, setName] = useState(profile.name)
  const [classNumber, setClassNumber] = useState<string>(
    profile.class_number ? String(profile.class_number) : ''
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile.name)
    setClassNumber(profile.class_number ? String(profile.class_number) : '')
  }, [profile])

  const showClassField =
    profile.grade !== null &&
    profile.role !== 'teacher' &&
    profile.role !== 'admin'

  const trimmedName = name.trim()
  const currentClass = profile.class_number ? String(profile.class_number) : ''
  const nameChanged = trimmedName !== profile.name && trimmedName.length > 0
  const classChanged = showClassField && classNumber !== currentClass
  const dirty = nameChanged || classChanged

  const save = async () => {
    if (!trimmedName) {
      alert('이름을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const updates: Record<string, unknown> = { name: trimmedName }
      if (showClassField && classNumber) {
        updates.class_number = Number(classNumber)
      }
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      alert('저장되었습니다.')
    } catch (err) {
      console.error('save profile failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const avatarUrl =
    profile.avatar_url ??
    (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null) ??
    (typeof metadata.picture === 'string' ? metadata.picture : null) ??
    null
  const initial = (trimmedName || profile.name || '?').slice(0, 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          내 정보
        </CardTitle>
        <CardDescription>기본 계정 정보를 관리해요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3">
          <Avatar className="h-14 w-14 ring-1 ring-zinc-200">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={profile.name} />
            ) : null}
            <AvatarFallback className="bg-zinc-100 text-lg font-semibold text-zinc-700">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-zinc-900">
              {profile.name || '이름 없음'}
            </div>
            <div className="mt-0.5 truncate text-xs text-zinc-500">
              {user.email ?? '이메일 없음'}
            </div>
            <div className="mt-1 text-[10px] text-zinc-400">
              프로필 사진은 구글 계정에서 관리해요
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">이름</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            maxLength={40}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" value={user.email ?? ''} disabled readOnly />
        </div>

        {profile.grade !== null && (
          <div
            className={cn(
              'gap-2',
              showClassField ? 'grid grid-cols-2' : 'flex'
            )}
          >
            <div className="space-y-1.5">
              <Label>학년</Label>
              <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                {profile.grade}학년
                <span className="ml-auto text-[10px] text-zinc-400">
                  이메일 기반
                </span>
              </div>
            </div>
            {showClassField && (
              <div className="space-y-1.5">
                <Label htmlFor="class-select">반</Label>
                <Select value={classNumber} onValueChange={setClassNumber}>
                  <SelectTrigger id="class-select" className="h-9 w-full">
                    <SelectValue placeholder="반 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_OPTIONS.map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c}반
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={save}
          disabled={!dirty || saving}
          className="h-10 w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {saving ? (
            <>
              <Loader2Icon className="h-4 w-4 animate-spin" />
              <span className="ml-1.5">저장 중…</span>
            </>
          ) : (
            <>
              <SaveIcon className="h-4 w-4" />
              <span className="ml-1.5">저장</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

/* ================================ Section 2 =============================== */

function RoleCard({
  profile,
  refresh,
}: {
  profile: User
  refresh: Refresh
}) {
  const [choice, setChoice] = useState<ClassLeaderType>(
    profile.class_leader_type ?? 'leader'
  )
  const [saving, setSaving] = useState(false)

  const status = profile.class_leader_status
  const isAdmin = profile.role === 'admin'
  const isTeacher = profile.role === 'teacher'
  const isApprovedLeader =
    profile.role === 'class_leader' && status === 'approved'
  const isPendingLeader = status === 'pending'

  const applyLeader = async () => {
    if (
      !confirm(
        `${choice === 'leader' ? '반장' : '부반장'}으로 신청할까요? 관리자 승인 후 반 공지를 올릴 수 있어요.`
      )
    )
      return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          class_leader_type: choice,
          class_leader_status: 'pending',
        })
        .eq('id', profile.id)
      if (error) throw error
      await refresh()
      alert('신청이 접수되었어요. 관리자 승인을 기다려주세요.')
    } catch (err) {
      console.error('apply leader failed:', err)
      alert(`신청 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const cancelPending = async () => {
    if (!confirm('신청을 취소할까요?')) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          class_leader_type: null,
          class_leader_status: 'none',
        })
        .eq('id', profile.id)
      if (error) throw error
      await refresh()
    } catch (err) {
      console.error('cancel leader failed:', err)
      alert(`취소 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const returnRole = async () => {
    if (!confirm('역할을 반납할까요? 학생 계정으로 돌아갑니다.')) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          role: 'student',
          class_leader_type: null,
          class_leader_status: 'none',
        })
        .eq('id', profile.id)
      if (error) throw error
      await refresh()
    } catch (err) {
      console.error('return role failed:', err)
      alert(`반납 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const leaderLabel =
    profile.class_leader_type === 'vice_leader' ? '부반장' : '반장'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          역할 관리
        </CardTitle>
        <CardDescription>
          계정 역할과 반장 · 부반장 상태를 관리해요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isAdmin ? (
            <StatusChip variant="dark" icon={<ShieldIcon className="h-3 w-3" />}>
              관리자 계정
            </StatusChip>
          ) : isTeacher ? (
            <>
              <StatusChip
                variant="indigo"
                icon={<GraduationCapIcon className="h-3 w-3" />}
              >
                선생님 계정
              </StatusChip>
              {profile.teacher_status === 'pending' && (
                <StatusChip
                  variant="amber"
                  icon={<ClockIcon className="h-3 w-3" />}
                >
                  선생님 승인 대기
                </StatusChip>
              )}
              {profile.teacher_status === 'approved' && (
                <StatusChip
                  variant="emerald"
                  icon={<CheckCircle2Icon className="h-3 w-3" />}
                >
                  승인됨
                </StatusChip>
              )}
            </>
          ) : (
            <>
              {isApprovedLeader ? (
                <StatusChip
                  variant="emerald"
                  icon={<CheckCircle2Icon className="h-3 w-3" />}
                >
                  현재: {leaderLabel}
                </StatusChip>
              ) : isPendingLeader ? (
                <StatusChip
                  variant="amber"
                  icon={<ClockIcon className="h-3 w-3" />}
                >
                  {leaderLabel} 승인 대기 중
                </StatusChip>
              ) : (
                <StatusChip variant="neutral">학생 계정</StatusChip>
              )}
              {status === 'rejected' && (
                <StatusChip
                  variant="red"
                  icon={<XCircleIcon className="h-3 w-3" />}
                >
                  이전 신청 반려됨
                </StatusChip>
              )}
            </>
          )}
        </div>

        {isTeacher && profile.teacher_status === 'pending' && (
          <p className="text-xs text-zinc-500">
            선생님 계정 승인은 관리자 페이지에서 처리돼요.
          </p>
        )}

        {!isAdmin && !isTeacher && (
          <>
            {isApprovedLeader && (
              <Button
                variant="destructive"
                onClick={returnRole}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span className="ml-1.5">처리 중…</span>
                  </>
                ) : (
                  '역할 반납'
                )}
              </Button>
            )}
            {isPendingLeader && (
              <Button
                variant="outline"
                onClick={cancelPending}
                disabled={saving}
                className="w-full"
              >
                {saving ? '처리 중…' : '신청 취소'}
              </Button>
            )}
            {(status === 'none' || status === 'rejected') && !isApprovedLeader && (
              <div className="space-y-2 border-t border-zinc-100 pt-3">
                <Label className="text-xs">반장 · 부반장으로 신청</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['leader', 'vice_leader'] as ClassLeaderType[]).map((v) => {
                    const active = choice === v
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setChoice(v)}
                        className={cn(
                          'rounded-lg border py-2 text-sm font-medium transition-colors',
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        )}
                        aria-pressed={active}
                      >
                        {v === 'leader' ? '반장' : '부반장'}
                      </button>
                    )
                  })}
                </div>
                <Button
                  onClick={applyLeader}
                  disabled={saving}
                  className="h-10 w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
                >
                  {saving ? '신청 중…' : '신청'}
                </Button>
                <p className="text-[11px] text-zinc-500">
                  관리자 승인 후 반 공지를 올릴 수 있어요.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function StatusChip({
  variant,
  icon,
  children,
}: {
  variant: 'dark' | 'indigo' | 'emerald' | 'amber' | 'red' | 'neutral'
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const styles: Record<typeof variant, string> = {
    dark: 'bg-zinc-900 text-white border-zinc-900',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-white text-zinc-700 border-zinc-200',
  }
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium tracking-tight',
        styles[variant]
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/* ================================ Section 3 =============================== */

function TeacherProfileCard({
  user,
  profile,
  teacher,
  loading,
  onUpdated,
}: {
  user: SupabaseUser
  profile: User
  teacher: Teacher | null
  loading: boolean
  onUpdated: Refresh
}) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [office, setOffice] = useState('')
  const [grades, setGrades] = useState<number[]>([])
  const [status, setStatus] = useState<TeacherStatus>('unknown')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (teacher) {
      setName(teacher.name)
      setSubject(teacher.subject)
      setOffice(teacher.office_location ?? '')
      setGrades(teacher.managed_grades ?? [])
      setStatus(teacher.current_status ?? 'unknown')
    } else {
      setName(profile.name)
      setSubject('')
      setOffice('')
      setGrades([])
      setStatus('available')
    }
  }, [teacher, profile])

  const toggleGrade = (g: number) => {
    setGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort()
    )
  }

  const save = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      alert('이름을 입력해주세요.')
      return
    }
    if (!subject) {
      alert('담당 과목을 선택해주세요.')
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      if (teacher) {
        const { error } = await supabase
          .from('teachers')
          .update({
            name: trimmedName,
            subject,
            office_location: office.trim(),
            managed_grades: grades,
            current_status: status,
          })
          .eq('id', teacher.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('teachers').insert({
          user_id: user.id,
          name: trimmedName,
          subject,
          office_location: office.trim(),
          managed_grades: grades,
          current_status: status,
          is_self_registered: false,
        })
        if (error) throw error
      }
      await onUpdated()
      alert('저장되었습니다.')
    } catch (err) {
      console.error('save teacher profile failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const changeStatusQuick = async (next: TeacherStatus) => {
    if (!teacher) {
      setStatus(next)
      return
    }
    const prev = status
    setStatus(next)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teachers')
        .update({ current_status: next })
        .eq('id', teacher.id)
      if (error) throw error
      await onUpdated()
    } catch (err) {
      console.error('quick status update failed:', err)
      alert(`상태 변경 실패: ${getErrorMessage(err)}`)
      setStatus(prev)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          선생님 프로필
        </CardTitle>
        <CardDescription>
          {teacher
            ? '학생들에게 보여지는 프로필과 현재 상태예요.'
            : '아직 프로필이 없어요. 아래 정보를 채워서 프로필을 만들어주세요.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-zinc-400">
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-sm">불러오는 중…</span>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label className="flex items-center justify-between">
                <span>현재 상태</span>
                {!teacher && (
                  <span className="text-[10px] font-normal text-zinc-400">
                    프로필 생성 후 저장돼요
                  </span>
                )}
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTIONS.map((s) => {
                  const active = status === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => changeStatusQuick(s.value)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                        active
                          ? `border-transparent ${s.activeCls} text-white shadow-sm`
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                      )}
                      aria-pressed={active}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-name">표시 이름</Label>
              <Input
                id="t-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="t-subject">담당 과목</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="t-subject" className="h-9 w-full">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEACHER_SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-office">교과 연구실</Label>
                <Input
                  id="t-office"
                  value={office}
                  onChange={(e) => setOffice(e.target.value)}
                  placeholder="예: 3층 국어과"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>담당 학년</Label>
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map((g) => {
                  const active = grades.includes(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGrade(g)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                      )}
                      aria-pressed={active}
                    >
                      {g}학년
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              onClick={save}
              disabled={saving}
              className="h-10 w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {saving ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1.5">저장 중…</span>
                </>
              ) : (
                <>
                  <SaveIcon className="h-4 w-4" />
                  <span className="ml-1.5">
                    {teacher ? '프로필 저장' : '프로필 생성'}
                  </span>
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ================================ Section 4 =============================== */

function TeacherScheduleCard({
  teacherId,
  schedules,
  onUpdated,
}: {
  teacherId: string
  schedules: TeacherSchedule[]
  onUpdated: Refresh
}) {
  const [editingCell, setEditingCell] = useState<{
    day: number
    period: number
    existing: TeacherSchedule | null
  } | null>(null)

  const scheduleMap = useMemo(() => {
    const m = new Map<string, TeacherSchedule>()
    for (const s of schedules) m.set(`${s.day_of_week}-${s.period}`, s)
    return m
  }, [schedules])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          내 시간표
        </CardTitle>
        <CardDescription>
          빈 셀을 눌러 시간을 추가하고, 채워진 셀을 눌러 수정 · 삭제할 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-1 text-[10px]">
          <div />
          {DAY_LABELS.map((d) => (
            <div
              key={d}
              className="py-1 text-center text-xs font-semibold text-zinc-700"
            >
              {d}
            </div>
          ))}
          {PERIODS.map((p) => (
            <Fragment key={p}>
              <div className="flex items-center justify-center py-1 text-xs font-medium text-zinc-500">
                {p}교시
              </div>
              {DAY_LABELS.map((_, dayIdx) => {
                const day = dayIdx + 1
                const s = scheduleMap.get(`${day}-${p}`)
                return (
                  <button
                    key={dayIdx}
                    type="button"
                    onClick={() =>
                      setEditingCell({ day, period: p, existing: s ?? null })
                    }
                    className={cn(
                      'group flex min-h-14 flex-col items-center justify-center rounded-md p-1 text-center transition-colors',
                      s
                        ? 'border border-indigo-100 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                        : 'border border-zinc-100 bg-zinc-50 hover:bg-zinc-100'
                    )}
                  >
                    {s ? (
                      <>
                        <span className="text-[10px] font-semibold leading-tight">
                          {s.classroom}
                        </span>
                        <span className="text-[9px] leading-tight text-indigo-700/70">
                          {s.grade}-{s.class_number}
                        </span>
                        <PencilIcon className="mt-0.5 h-3 w-3 text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100" />
                      </>
                    ) : (
                      <PlusIcon className="h-3.5 w-3.5 text-zinc-400" />
                    )}
                  </button>
                )
              })}
            </Fragment>
          ))}
        </div>
      </CardContent>

      {editingCell && (
        <ScheduleCellDialog
          teacherId={teacherId}
          cell={editingCell}
          onClose={() => setEditingCell(null)}
          onSaved={onUpdated}
        />
      )}
    </Card>
  )
}

function ScheduleCellDialog({
  teacherId,
  cell,
  onClose,
  onSaved,
}: {
  teacherId: string
  cell: { day: number; period: number; existing: TeacherSchedule | null }
  onClose: () => void
  onSaved: Refresh
}) {
  const [classroom, setClassroom] = useState(cell.existing?.classroom ?? '')
  const [grade, setGrade] = useState<string>(
    cell.existing ? String(cell.existing.grade) : ''
  )
  const [classNumber, setClassNumber] = useState<string>(
    cell.existing ? String(cell.existing.class_number) : ''
  )
  const [saving, setSaving] = useState(false)

  const dayLabel = DAY_LABELS[cell.day - 1]

  const save = async () => {
    if (!classroom.trim() || !grade || !classNumber) return
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        teacher_id: teacherId,
        day_of_week: cell.day,
        period: cell.period,
        classroom: classroom.trim(),
        grade: Number(grade),
        class_number: Number(classNumber),
      }
      if (cell.existing) {
        const { error } = await supabase
          .from('teacher_schedules')
          .update(payload)
          .eq('id', cell.existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('teacher_schedules')
          .insert(payload)
        if (error) throw error
      }
      await onSaved()
      onClose()
    } catch (err) {
      console.error('schedule save failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!cell.existing) return
    if (!confirm('이 시간을 삭제할까요?')) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teacher_schedules')
        .delete()
        .eq('id', cell.existing.id)
      if (error) throw error
      await onSaved()
      onClose()
    } catch (err) {
      console.error('schedule delete failed:', err)
      alert(`삭제 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {dayLabel}요일 {cell.period}교시
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cell-classroom">교실</Label>
            <Input
              id="cell-classroom"
              placeholder="예: 3-2"
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="cell-grade">학년</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger id="cell-grade" className="h-9 w-full">
                  <SelectValue placeholder="학년" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {g}학년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cell-class">반</Label>
              <Select value={classNumber} onValueChange={setClassNumber}>
                <SelectTrigger id="cell-class" className="h-9 w-full">
                  <SelectValue placeholder="반" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {cell.existing && (
            <Button
              type="button"
              variant="destructive"
              onClick={remove}
              disabled={saving}
              className="mr-auto"
            >
              <Trash2Icon />
              <span className="ml-1">삭제</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || !classroom.trim() || !grade || !classNumber}
            className="bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {saving ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="ml-1">저장 중…</span>
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

/* ================================ Section 5 =============================== */

function TeacherApplyCard({
  user,
  profile,
  teacher,
  refresh,
  onUpdated,
}: {
  user: SupabaseUser
  profile: User
  teacher: Teacher | null
  refresh: Refresh
  onUpdated: Refresh
}) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [office, setOffice] = useState('')
  const [saving, setSaving] = useState(false)

  const teacherStatus = profile.teacher_status
  const isPending = teacherStatus === 'pending'
  const isRejected = teacherStatus === 'rejected'

  const apply = async () => {
    if (!subject) {
      alert('담당 과목을 선택해주세요.')
      return
    }
    if (!confirm('선생님 계정을 신청할까요? 관리자 승인을 기다려주세요.')) return
    setSaving(true)
    try {
      const supabase = createClient()

      if (teacher) {
        const { error: tErr } = await supabase
          .from('teachers')
          .update({
            name: profile.name,
            subject,
            office_location: office.trim(),
            current_status: 'unknown',
            is_self_registered: true,
          })
          .eq('id', teacher.id)
        if (tErr) throw tErr
      } else {
        const { error: tErr } = await supabase.from('teachers').insert({
          user_id: user.id,
          name: profile.name,
          subject,
          office_location: office.trim(),
          current_status: 'unknown',
          is_self_registered: true,
          managed_grades: [],
          managed_classes: [],
        })
        if (tErr) throw tErr
      }

      const { error: uErr } = await supabase
        .from('users')
        .update({ teacher_status: 'pending' })
        .eq('id', user.id)
      if (uErr) throw uErr

      await Promise.all([refresh(), onUpdated()])
      setOpen(false)
      setSubject('')
      setOffice('')
      alert('신청이 접수되었어요. 관리자 승인을 기다려주세요.')
    } catch (err) {
      console.error('teacher apply failed:', err)
      alert(`신청 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const cancel = async () => {
    if (!confirm('선생님 신청을 취소할까요?')) return
    setSaving(true)
    try {
      const supabase = createClient()

      const { error: uErr } = await supabase
        .from('users')
        .update({ teacher_status: 'none' })
        .eq('id', user.id)
      if (uErr) throw uErr

      if (teacher?.is_self_registered) {
        const { error: tErr } = await supabase
          .from('teachers')
          .delete()
          .eq('id', teacher.id)
        if (tErr) throw tErr
      }

      await Promise.all([refresh(), onUpdated()])
    } catch (err) {
      console.error('teacher cancel failed:', err)
      alert(`취소 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          선생님 계정 전환
        </CardTitle>
        <CardDescription>
          선생님이신가요? 선생님 계정으로 전환하면 자료를 직접 등록하고
          학생들에게 공지를 보낼 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <StatusChip
              variant="amber"
              icon={<ClockIcon className="h-3 w-3" />}
            >
              선생님 계정 승인 대기 중
            </StatusChip>
            <p className="text-xs text-zinc-500">
              관리자가 승인하면 자동으로 선생님 계정으로 전환돼요.
            </p>
            <Button
              variant="outline"
              onClick={cancel}
              disabled={saving}
              className="w-full"
            >
              {saving ? '처리 중…' : '신청 취소'}
            </Button>
          </>
        ) : (
          <>
            {isRejected && (
              <StatusChip
                variant="red"
                icon={<XCircleIcon className="h-3 w-3" />}
              >
                이전 신청이 반려됨
              </StatusChip>
            )}
            {open ? (
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="apply-subject">담당 과목</Label>
                    <Select value={subject} onValueChange={setSubject}>
                      <SelectTrigger id="apply-subject" className="h-9 w-full">
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEACHER_SUBJECTS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="apply-office">교과 연구실</Label>
                    <Input
                      id="apply-office"
                      value={office}
                      onChange={(e) => setOffice(e.target.value)}
                      placeholder="예: 3층 수학과"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button
                    onClick={apply}
                    disabled={saving || !subject}
                    className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    {saving ? '신청 중…' : '신청'}
                  </Button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  관리자가 확인한 뒤 승인하면 선생님 계정으로 전환돼요.
                </p>
              </div>
            ) : (
              <Button
                onClick={() => setOpen(true)}
                className="h-10 w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
              >
                <GraduationCapIcon className="h-4 w-4" />
                <span className="ml-1.5">선생님 계정 신청</span>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
