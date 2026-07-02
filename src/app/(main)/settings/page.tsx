'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ClockIcon,
  GraduationCapIcon,
  Loader2Icon,
  PlusIcon,
  SaveIcon,
  ShieldIcon,
  Trash2Icon,
  UserMinusIcon,
  XCircleIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { CLASS_OPTIONS } from '@/lib/school-schedule'
import { isNonStudentEmail } from '@/lib/grade-utils'
import type {
  ClassLeaderType,
  Teacher,
  TeacherSchedule,
  TeacherStatus,
  User,
  WeekType,
} from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const WEEK_TYPE_OPTIONS: { value: WeekType; label: string; short: string }[] = [
  { value: 'all', label: '매주', short: '' },
  { value: 'odd', label: '홀수주', short: '홀' },
  { value: 'even', label: '짝수주', short: '짝' },
]

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

  const isTeacherRole = profile?.role === 'teacher'
  const isPendingTeacher =
    profile?.role === 'teacher' && profile?.teacher_status === 'pending'

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
    profile.role === 'student' && profile.teacher_status === 'none'

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">
          설정
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          계정 정보와 프로필을 한 곳에서 관리해요.
        </p>
      </div>

      <ProfileInfoCard user={user} profile={profile} refresh={refresh} />

      <RoleCard profile={profile} refresh={refresh} />

      {isTeacherRole && (
        <TeacherProfileCard
          user={user}
          profile={profile}
          teacher={teacher}
          loading={teacherLoading}
          isPending={isPendingTeacher}
          refresh={refresh}
          onUpdated={fetchTeacher}
        />
      )}

      {isTeacherRole && teacher && (
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

      <DangerZoneCard user={user} profile={profile} />
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
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    setName(profile.name)
  }, [profile.name])

  const showClassInfo = profile.role !== 'admin'
  const canRequestGradeChange =
    profile.role !== 'admin' && isNonStudentEmail(user.email ?? '')
  const canRequestClassChange = showClassInfo
  const showChangeRequest = canRequestGradeChange || canRequestClassChange

  const trimmedName = name.trim()
  const nameChanged = trimmedName !== profile.name && trimmedName.length > 0

  const saveName = async () => {
    if (!trimmedName) {
      toast.error('이름을 입력해주세요.')
      return
    }
    setSavingName(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ name: trimmedName })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      toast.success('이름이 저장되었습니다.')
    } catch (err) {
      console.error('save name failed:', err)
      toast.error(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingName(false)
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
          <div className="flex gap-2">
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              maxLength={40}
              className="flex-1"
            />
            <Button
              onClick={saveName}
              disabled={!nameChanged || savingName}
              className="shrink-0 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {savingName ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <SaveIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" value={user.email ?? ''} disabled readOnly />
        </div>

        {showChangeRequest && (
          <ProfileChangeSection
            profile={profile}
            canGrade={canRequestGradeChange}
            canClass={canRequestClassChange}
            refresh={refresh}
          />
        )}
      </CardContent>
    </Card>
  )
}

function ProfileChangeSection({
  profile,
  canGrade,
  canClass,
  refresh,
}: {
  profile: User
  canGrade: boolean
  canClass: boolean
  refresh: Refresh
}) {
  const status = profile.profile_change_status
  const [open, setOpen] = useState(false)
  const [gradeSel, setGradeSel] = useState<string>('')
  const [classSel, setClassSel] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const openForm = () => {
    setGradeSel(
      profile.pending_grade
        ? String(profile.pending_grade)
        : profile.grade
          ? String(profile.grade)
          : ''
    )
    setClassSel(
      profile.pending_class_number
        ? String(profile.pending_class_number)
        : profile.class_number
          ? String(profile.class_number)
          : ''
    )
    setOpen(true)
  }

  const submitRequest = async () => {
    const nextGrade =
      canGrade && gradeSel ? Number(gradeSel) : profile.grade ?? null
    const nextClass =
      canClass && classSel ? Number(classSel) : profile.class_number ?? null

    if (canClass && !classSel) {
      toast.error('새로운 반을 선택해주세요.')
      return
    }

    const changed =
      (canGrade && nextGrade !== profile.grade) ||
      (canClass && nextClass !== profile.class_number)
    if (!changed) {
      toast.error('현재와 다른 값을 선택해주세요.')
      return
    }

    if (!confirm('정보 변경을 요청할까요? 관리자 승인 후 반영돼요.')) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          pending_grade: canGrade ? nextGrade : null,
          pending_class_number: canClass ? nextClass : null,
          profile_change_status: 'pending',
        })
        .eq('id', profile.id)
      if (error) throw error
      await refresh()
      setOpen(false)
      toast('요청이 접수되었어요. 관리자 승인을 기다려주세요.')
    } catch (err) {
      console.error('profile change request failed:', err)
      toast.error(`요청 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const cancelRequest = async () => {
    if (!confirm('변경 요청을 취소할까요?')) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          pending_grade: null,
          pending_class_number: null,
          profile_change_status: 'none',
        })
        .eq('id', profile.id)
      if (error) throw error
      await refresh()
    } catch (err) {
      console.error('cancel profile change failed:', err)
      toast.error(`취소 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const currentLabel = `${profile.grade ? `${profile.grade}학년` : '학년 미지정'}${profile.class_number ? ` ${profile.class_number}반` : ''}`
  const pendingLabel = `${
    profile.pending_grade
      ? `${profile.pending_grade}학년`
      : profile.grade
        ? `${profile.grade}학년`
        : '학년 미지정'
  }${
    profile.pending_class_number
      ? ` ${profile.pending_class_number}반`
      : profile.class_number
        ? ` ${profile.class_number}반`
        : ''
  }`

  return (
    <div className="space-y-2 border-t border-zinc-100 pt-4">
      <div className="flex items-center justify-between">
        <Label>학년 · 반 정보</Label>
        {!open && status === 'none' && (
          <button
            type="button"
            onClick={openForm}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            변경 요청
          </button>
        )}
      </div>

      <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
        {currentLabel}
        <span className="ml-auto text-[10px] text-zinc-400">
          {isNonStudentEmail(profile.email)
            ? '수동 입력'
            : '학년은 이메일 기반'}
        </span>
      </div>

      {status === 'pending' && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex items-center gap-1 font-medium">
            변경 요청 중
            <ArrowRightIcon className="h-3 w-3" />
            <span className="font-semibold">{pendingLabel}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={cancelRequest}
            disabled={saving}
            className="ml-auto h-6 border-amber-300 bg-white px-2 text-[11px] text-amber-800 hover:bg-amber-100"
          >
            취소
          </Button>
        </div>
      )}

      {status === 'rejected' && !open && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <XCircleIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">변경 요청이 반려되었습니다</span>
          <Button
            variant="outline"
            size="sm"
            onClick={openForm}
            className="ml-auto h-6 border-red-300 bg-white px-2 text-[11px] text-red-800 hover:bg-red-100"
          >
            다시 요청
          </Button>
        </div>
      )}

      {open && status !== 'pending' && (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
          <div
            className={cn(
              'grid gap-2',
              canGrade && canClass ? 'grid-cols-2' : 'grid-cols-1'
            )}
          >
            {canGrade && (
              <div className="space-y-1.5">
                <Label htmlFor="pc-grade" className="text-xs">
                  새 학년
                </Label>
                <Select value={gradeSel} onValueChange={setGradeSel}>
                  <SelectTrigger id="pc-grade" className="h-9 w-full">
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
            )}
            {canClass && (
              <div className="space-y-1.5">
                <Label htmlFor="pc-class" className="text-xs">
                  새 반
                </Label>
                <Select value={classSel} onValueChange={setClassSel}>
                  <SelectTrigger id="pc-class" className="h-9 w-full">
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
            )}
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
              onClick={submitRequest}
              disabled={saving}
              className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800"
            >
              {saving ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1.5">요청 중…</span>
                </>
              ) : (
                '변경 요청'
              )}
            </Button>
          </div>
          <p className="text-[11px] text-zinc-500">
            관리자 승인 후 반영돼요. 승인 대기 중에는 다시 요청할 수 없어요.
          </p>
        </div>
      )}
    </div>
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
      toast('신청이 접수되었어요. 관리자 승인을 기다려주세요.')
    } catch (err) {
      console.error('apply leader failed:', err)
      toast.error(`신청 실패: ${getErrorMessage(err)}`)
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
      toast.error(`취소 실패: ${getErrorMessage(err)}`)
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
      toast.error(`반납 실패: ${getErrorMessage(err)}`)
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
              {profile.teacher_status === 'pending_downgrade' && (
                <StatusChip
                  variant="amber"
                  icon={<UserMinusIcon className="h-3 w-3" />}
                >
                  학생 전환 승인 대기
                </StatusChip>
              )}
            </>
          ) : (
            <>
              {profile.teacher_status === 'pending' && (
                <StatusChip
                  variant="amber"
                  icon={<ClockIcon className="h-3 w-3" />}
                >
                  선생님 승인 대기
                </StatusChip>
              )}
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
              ) : profile.teacher_status !== 'pending' ? (
                <StatusChip variant="neutral">학생 계정</StatusChip>
              ) : null}
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

        {!isAdmin && !isTeacher && profile.teacher_status === 'pending' && (
          <p className="text-xs text-zinc-500">
            선생님 계정 승인은 관리자 페이지에서 처리돼요. 승인 전까지는 학생
            화면으로 이용할 수 있어요.
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
  isPending,
  refresh,
  onUpdated,
}: {
  user: SupabaseUser
  profile: User
  teacher: Teacher | null
  loading: boolean
  isPending: boolean
  refresh: Refresh
  onUpdated: Refresh
}) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [office, setOffice] = useState('')
  const [grades, setGrades] = useState<number[]>([])
  const [status, setStatus] = useState<TeacherStatus>('unknown')
  const [saving, setSaving] = useState(false)
  const [downgradeSaving, setDowngradeSaving] = useState(false)

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
      toast.error('이름을 입력해주세요.')
      return
    }
    if (!subject) {
      toast.error('담당 과목을 선택해주세요.')
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
      toast.success('저장되었습니다.')
    } catch (err) {
      console.error('save teacher profile failed:', err)
      toast.error(`저장 실패: ${getErrorMessage(err)}`)
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
      toast.error(`상태 변경 실패: ${getErrorMessage(err)}`)
      setStatus(prev)
    }
  }

  const requestDowngrade = async () => {
    if (
      !confirm(
        '선생님 계정을 포기하고 학생으로 전환하시겠어요?\n\n관리자 승인이 필요하며, 승인 시 자료 등록·공지 권한이 해제됩니다.'
      )
    )
      return
    setDowngradeSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ teacher_status: 'pending_downgrade' })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      toast('학생 계정 전환 요청이 접수되었어요.')
    } catch (err) {
      console.error('downgrade request failed:', err)
      toast.error(`요청 실패: ${getErrorMessage(err)}`)
    } finally {
      setDowngradeSaving(false)
    }
  }

  const cancelDowngrade = async () => {
    if (!confirm('학생 전환 요청을 취소할까요?')) return
    setDowngradeSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ teacher_status: 'approved' })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
    } catch (err) {
      console.error('cancel downgrade failed:', err)
      toast.error(`취소 실패: ${getErrorMessage(err)}`)
    } finally {
      setDowngradeSaving(false)
    }
  }

  const isPendingDowngrade = profile.teacher_status === 'pending_downgrade'

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
        {isPending && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1 leading-tight">
              <div className="font-semibold">관리자 승인 대기 중</div>
              <p className="mt-0.5 text-xs text-amber-700/90">
                미리 프로필을 채워두면 승인 후 바로 학생들에게 표시돼요.
              </p>
            </div>
          </div>
        )}
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

            {/* 학생 전환: pending 상태에서는 표시하지 않음 */}
            {!isPending && (
              <div className="border-t border-zinc-100 pt-3">
                {isPendingDowngrade ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <ClockIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium">
                      학생 전환 승인 대기 중
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelDowngrade}
                      disabled={downgradeSaving}
                      className="ml-auto h-6 border-amber-300 bg-white px-2 text-[11px] text-amber-800 hover:bg-amber-100"
                    >
                      취소
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestDowngrade}
                    disabled={downgradeSaving}
                    className="w-full text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                  >
                    {downgradeSaving ? (
                      <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <UserMinusIcon className="h-3.5 w-3.5" />
                        <span className="ml-1.5">학생 계정으로 전환</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
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
  const [editing, setEditing] = useState<{
    day: number
    period: number
  } | null>(null)

  // (day-period-week_type) 단위로 조회 가능하도록 인덱싱
  const schedulesByCell = useMemo(() => {
    const map = new Map<string, TeacherSchedule[]>()
    for (const s of schedules) {
      const key = `${s.day_of_week}-${s.period}`
      const arr = map.get(key) ?? []
      arr.push(s)
      map.set(key, arr)
    }
    return map
  }, [schedules])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight">
          내 시간표
        </CardTitle>
        <CardDescription>
          빈 셀을 눌러 수업을 추가하세요. 격주(홀/짝)로 다른 수업이 있으면 하나의
          셀에 두 개까지 등록할 수 있어요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-blue-200 bg-blue-50" />
            매주
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded bg-zinc-900" />
            홀수주
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-5 rounded border border-zinc-900 bg-white" />
            짝수주
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-6 gap-1">
              <div className="h-7" />
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="flex h-7 items-center justify-center text-[11px] font-semibold text-zinc-500"
                >
                  {d}
                </div>
              ))}
            </div>
            {PERIODS.map((p) => (
              <div key={p} className="mt-1 grid grid-cols-6 gap-1">
                <div className="flex h-16 items-center justify-center text-[10px] font-medium tabular-nums text-zinc-400">
                  {p}교시
                </div>
                {DAY_LABELS.map((_, dayIdx) => {
                  const day = dayIdx + 1
                  const cellItems =
                    schedulesByCell.get(`${day}-${p}`) ?? []
                  return (
                    <ScheduleCell
                      key={day}
                      items={cellItems}
                      onOpen={() => setEditing({ day, period: p })}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {editing && (
        <ScheduleCellDialog
          teacherId={teacherId}
          day={editing.day}
          period={editing.period}
          existing={schedulesByCell.get(`${editing.day}-${editing.period}`) ?? []}
          open={!!editing}
          onOpenChange={(v) => {
            if (!v) setEditing(null)
          }}
          onSaved={async () => {
            await onUpdated()
          }}
        />
      )}
    </Card>
  )
}

function ScheduleCell({
  items,
  onOpen,
}: {
  items: TeacherSchedule[]
  onOpen: () => void
}) {
  if (items.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="group flex h-16 items-center justify-center rounded-md border border-zinc-100 bg-zinc-50 text-zinc-300 transition-colors duration-150 hover:bg-zinc-100"
        aria-label="시간표 추가"
      >
        <PlusIcon
          className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
          strokeWidth={1.75}
        />
      </button>
    )
  }

  const all = items.find((i) => i.week_type === 'all')
  const odd = items.find((i) => i.week_type === 'odd')
  const even = items.find((i) => i.week_type === 'even')

  if (all) {
    const name = all.group_name?.trim() || all.classroom
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-16 flex-col items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-1.5 text-center text-blue-700 transition-colors duration-150 hover:border-blue-300"
      >
        <span className="line-clamp-1 text-[10px] font-medium">{name}</span>
        {all.group_name && all.classroom !== all.group_name && (
          <span className="line-clamp-1 text-[9px] opacity-70">
            {all.classroom}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-16 flex-col overflow-hidden rounded-md border border-zinc-200 transition-colors duration-150 hover:border-zinc-300"
    >
      <ScheduleEditHalfCell item={odd} kind="odd" />
      <ScheduleEditHalfCell item={even} kind="even" />
    </button>
  )
}

function ScheduleEditHalfCell({
  item,
  kind,
}: {
  item: TeacherSchedule | undefined
  kind: 'odd' | 'even'
}) {
  const name = item?.group_name?.trim() || item?.classroom

  if (kind === 'odd') {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col justify-center px-1 py-0.5 text-left',
          item ? 'bg-zinc-900 text-white' : 'bg-zinc-100'
        )}
      >
        {item && (
          <>
            <div className="line-clamp-1 text-[10px] font-medium">{name}</div>
            {item.group_name && item.classroom !== item.group_name && (
              <div className="line-clamp-1 text-[9px] opacity-70">
                {item.classroom}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-1 flex-col justify-center border-t border-zinc-200 px-1 py-0.5 text-left',
        item ? 'bg-white text-zinc-900' : 'bg-zinc-50'
      )}
    >
      {item && (
        <>
          <div className="line-clamp-1 text-[10px] font-medium">{name}</div>
          {item.group_name && item.classroom !== item.group_name && (
            <div className="line-clamp-1 text-[9px] opacity-70">
              {item.classroom}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ScheduleCellDialog({
  teacherId,
  day,
  period,
  existing,
  open,
  onOpenChange,
  onSaved,
}: {
  teacherId: string
  day: number
  period: number
  existing: TeacherSchedule[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => Promise<void> | void
}) {
  const editingRecord = existing.length === 1 ? existing[0] : null

  // 새로 추가할 때는 빈 값, 편집 시엔 기존 값
  const [groupName, setGroupName] = useState('')
  const [classroom, setClassroom] = useState('')
  const [weekType, setWeekType] = useState<WeekType>('all')
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // 다중 등록(홀/짝) 케이스: 편집 대상 선택
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editingRecord) {
      setSelectedId(editingRecord.id)
      hydrateFrom(editingRecord)
    } else if (existing.length > 1) {
      // 이미 홀/짝 모두 있음: 첫 항목을 편집 상태로
      setSelectedId(existing[0].id)
      hydrateFrom(existing[0])
    } else {
      setSelectedId(null)
      setGroupName('')
      setClassroom('')
      // 기본 weekType: 아직 없는 것 선호. 아무것도 없으면 all
      const usedTypes = new Set(existing.map((e) => e.week_type))
      if (usedTypes.has('all')) setWeekType('odd')
      else if (usedTypes.has('odd') && !usedTypes.has('even')) setWeekType('even')
      else if (usedTypes.has('even') && !usedTypes.has('odd')) setWeekType('odd')
      else setWeekType('all')
    }
  }, [open, existing, editingRecord])

  const hydrateFrom = (r: TeacherSchedule) => {
    setGroupName(r.group_name ?? '')
    setClassroom(r.classroom)
    setWeekType(r.week_type)
  }

  const selectExistingForEdit = (id: string) => {
    const r = existing.find((e) => e.id === id)
    if (!r) return
    setSelectedId(id)
    hydrateFrom(r)
  }

  const startNew = () => {
    setSelectedId(null)
    setGroupName('')
    setClassroom('')
    const usedTypes = new Set(
      existing
        .filter((e) => e.id !== selectedId)
        .map((e) => e.week_type)
    )
    if (usedTypes.has('all')) setWeekType('odd')
    else if (usedTypes.has('odd') && !usedTypes.has('even')) setWeekType('even')
    else if (usedTypes.has('even') && !usedTypes.has('odd')) setWeekType('odd')
    else setWeekType('all')
  }

  const canSave =
    !saving &&
    groupName.trim().length > 0 &&
    classroom.trim().length > 0

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      const supabase = createClient()

      // 같은 (day, period, week_type=all) 이거나
      // week_type이 'all' + 기존에 홀/짝이 있으면 충돌 안내
      if (!selectedId) {
        const usedTypes = new Set(existing.map((e) => e.week_type))
        if (weekType === 'all' && (usedTypes.has('odd') || usedTypes.has('even'))) {
          if (
            !confirm(
              '이 시간에 격주 수업이 이미 있어요. "매주"로 저장하면 기존 격주 항목이 유지된 채로 추가돼요. 계속할까요?'
            )
          ) {
            setSaving(false)
            return
          }
        }
        if (weekType !== 'all' && usedTypes.has(weekType)) {
          toast.error(
            `이 시간에 이미 ${weekType === 'odd' ? '홀수주' : '짝수주'} 수업이 있어요. 좌측 목록에서 선택해 수정하세요.`
          )
          setSaving(false)
          return
        }
      }

      const payload = {
        teacher_id: teacherId,
        day_of_week: day,
        period,
        classroom: classroom.trim(),
        grade: null,
        class_number: null,
        group_name: groupName.trim() || null,
        week_type: weekType,
      }

      if (selectedId) {
        const { error } = await supabase
          .from('teacher_schedules')
          .update(payload)
          .eq('id', selectedId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('teacher_schedules')
          .insert(payload)
        if (error) throw error
      }

      await onSaved()
      onOpenChange(false)
      toast.success(selectedId ? '시간표가 저장되었어요' : '시간표가 추가되었어요')
    } catch (err) {
      console.error('schedule save failed:', err)
      toast.error(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('이 시간표를 삭제할까요?')) return
    setBusyId(id)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teacher_schedules')
        .delete()
        .eq('id', id)
      if (error) throw error
      await onSaved()
      // 남은 항목이 없으면 닫고, 있으면 새 항목 편집 상태로
      const remain = existing.filter((e) => e.id !== id)
      if (remain.length === 0) {
        onOpenChange(false)
      } else {
        startNew()
      }
    } catch (err) {
      console.error('schedule delete failed:', err)
      toast.error(`삭제 실패: ${getErrorMessage(err)}`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>
            {DAY_LABELS[day - 1]}요일 {period}교시
          </SheetTitle>
          <SheetDescription>
            수업/반/팀 이름, 교실, 주기를 입력하세요. 격주면 홀/짝 각각 등록할 수
            있어요.
          </SheetDescription>
        </SheetHeader>

        {existing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {existing.map((r) => {
              const wt = WEEK_TYPE_OPTIONS.find((o) => o.value === r.week_type)
              const active = selectedId === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => selectExistingForEdit(r.id)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium',
                    active
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                  )}
                >
                  {r.week_type !== 'all' && (
                    <span className="rounded-sm bg-white/20 px-1 text-[9px] font-bold">
                      {wt?.short}
                    </span>
                  )}
                  <span className="max-w-[80px] truncate">
                    {r.group_name || r.classroom}
                  </span>
                </button>
              )
            })}
            {existing.length < 3 && selectedId && (
              <button
                type="button"
                onClick={startNew}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
              >
                <PlusIcon className="h-3 w-3" />
                <span>다른 주기 추가</span>
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cell-group">수업/반/팀 이름</Label>
            <Input
              id="cell-group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder='예: "일반화학I", "2학년 3반", "수강신청반"'
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cell-classroom">교실</Label>
            <Input
              id="cell-classroom"
              value={classroom}
              onChange={(e) => setClassroom(e.target.value)}
              placeholder="예: 3-2 교실 / 물리실 2"
            />
          </div>

          <div className="space-y-1.5">
            <Label>주기</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {WEEK_TYPE_OPTIONS.map((opt) => {
                const active = weekType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWeekType(opt.value)}
                    className={cn(
                      'rounded-md border py-2 text-xs font-medium transition-colors',
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                    )}
                    aria-pressed={active}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {selectedId && (
              <Button
                variant="outline"
                onClick={() => remove(selectedId)}
                disabled={saving || !!busyId}
                className="w-full text-red-600 hover:bg-red-50 sm:w-auto"
              >
                {busyId === selectedId ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2Icon className="h-4 w-4" />
                    <span className="ml-1.5">삭제</span>
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 sm:flex-none"
            >
              취소
            </Button>
            <Button
              onClick={save}
              disabled={!canSave}
              className="flex-1 bg-zinc-900 text-white hover:bg-zinc-800 sm:flex-none"
            >
              {saving ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1.5">저장 중…</span>
                </>
              ) : selectedId ? (
                '저장'
              ) : (
                '추가'
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
      toast.error('담당 과목을 선택해주세요.')
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
      toast('신청이 접수되었어요. 관리자 승인을 기다려주세요.')
    } catch (err) {
      console.error('teacher apply failed:', err)
      toast.error(`신청 실패: ${getErrorMessage(err)}`)
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
      toast.error(`취소 실패: ${getErrorMessage(err)}`)
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

/* ================================ Section 6 =============================== */

function DangerZoneCard({
  user,
  profile,
}: {
  user: SupabaseUser
  profile: User
}) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const deleteAccount = async () => {
    if (
      !confirm(
        '정말 계정을 삭제하시겠어요?\n\n모든 데이터가 삭제되며 복구할 수 없습니다.\n동일한 이메일로 다시 로그인하면 새 계정으로 시작돼요.'
      )
    )
      return
    if (
      !confirm(
        `확인을 위해 한 번 더 물어볼게요.\n\n${profile.name} 님의 계정을 정말 삭제할까요?`
      )
    )
      return

    setDeleting(true)
    try {
      const supabase = createClient()

      // public.users 삭제 (관련 데이터는 FK CASCADE 로 정리됨)
      const { error: delErr } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)
      if (delErr) throw delErr

      // 세션 종료. auth.users 자체는 서버 측에서만 삭제 가능하므로 유지.
      // 동일 이메일로 재로그인하면 public.users 부재 → auth/callback 에서 새 프로필 생성.
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    } catch (err) {
      console.error('delete account failed:', err)
      toast.error(`삭제 실패: ${getErrorMessage(err)}`)
      setDeleting(false)
    }
  }

  return (
    <Card className="border-red-200 bg-red-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-red-700">
          <AlertTriangleIcon className="h-4 w-4" />
          위험 구역
        </CardTitle>
        <CardDescription className="text-red-700/80">
          계정을 삭제하면 프로필 · 자료 · 공지 등 모든 데이터가 사라지며 되돌릴
          수 없어요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-red-200 bg-white p-3 text-xs text-zinc-600">
          <p className="font-medium text-zinc-900">계정 삭제 안내</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            <li>공개된 자료·공지·시간표는 함께 삭제돼요.</li>
            <li>같은 이메일로 재로그인하면 새 계정으로 시작할 수 있어요.</li>
            <li>선생님 프로필도 함께 삭제돼요.</li>
          </ul>
        </div>
        <Button
          variant="destructive"
          onClick={deleteAccount}
          disabled={deleting}
          className="w-full"
        >
          {deleting ? (
            <>
              <Loader2Icon className="h-4 w-4 animate-spin" />
              <span className="ml-1.5">삭제 중…</span>
            </>
          ) : (
            <>
              <Trash2Icon className="h-4 w-4" />
              <span className="ml-1.5">계정 삭제</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
