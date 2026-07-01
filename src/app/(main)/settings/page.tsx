'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
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
import { Badge } from '@/components/ui/badge'
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

type LeaderChoice = 'none' | 'leader' | 'vice_leader'

const LEADER_OPTIONS: { value: LeaderChoice; label: string }[] = [
  { value: 'none', label: '아니오' },
  { value: 'leader', label: '반장' },
  { value: 'vice_leader', label: '부반장' },
]

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

const STATUS_OPTIONS: { value: TeacherStatus; label: string; className: string }[] = [
  { value: 'available', label: '자리 있음', className: 'bg-green-500 text-white' },
  { value: 'in_class', label: '수업 중', className: 'bg-yellow-500 text-white' },
  { value: 'meeting', label: '회의 중', className: 'bg-red-500 text-white' },
  { value: 'out', label: '외출', className: 'bg-slate-500 text-white' },
]

const DAY_LABELS = ['월', '화', '수', '목', '금'] as const
const PERIODS = [1, 2, 3, 4, 5, 6, 7] as const

export default function SettingsPage() {
  const { user, profile, loading, refresh } = useUser()
  const isTeacherAccount = profile?.role === 'teacher'

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">설정</h1>

      {isTeacherAccount ? (
        <TeacherSection user={user!} />
      ) : (
        <StudentSection user={user!} profile={profile} refresh={refresh} />
      )}
    </div>
  )
}

/* -------------------------- Student / Class Leader ------------------------- */

function StudentSection({
  user,
  profile,
  refresh,
}: {
  user: NonNullable<ReturnType<typeof useUser>['user']>
  profile: NonNullable<ReturnType<typeof useUser>['profile']>
  refresh: ReturnType<typeof useUser>['refresh']
}) {
  const [classNumber, setClassNumber] = useState<string>('')
  const [leaderChoice, setLeaderChoice] = useState<LeaderChoice>('none')
  const [savingClass, setSavingClass] = useState(false)
  const [savingLeader, setSavingLeader] = useState(false)

  useEffect(() => {
    setClassNumber(profile.class_number ? String(profile.class_number) : '')
    const currentType: LeaderChoice = profile.class_leader_type
      ? profile.class_leader_type
      : 'none'
    setLeaderChoice(currentType)
  }, [profile])

  const saveClass = async () => {
    if (!classNumber) return
    setSavingClass(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ class_number: Number(classNumber) })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      alert('반 정보를 저장했어요.')
    } catch (err) {
      console.error('Save class failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingClass(false)
    }
  }

  const applyLeader = async () => {
    setSavingLeader(true)
    try {
      const supabase = createClient()
      const leaderType: ClassLeaderType | null =
        leaderChoice === 'none' ? null : leaderChoice
      const leaderStatus = leaderChoice === 'none' ? 'none' : 'pending'
      const { error } = await supabase
        .from('users')
        .update({
          class_leader_type: leaderType,
          class_leader_status: leaderStatus,
        })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      alert(
        leaderChoice === 'none'
          ? '반장/부반장 신청을 취소했어요.'
          : '반장/부반장 신청이 접수되었어요. 관리자 승인을 기다려주세요.'
      )
    } catch (err) {
      console.error('Apply leader failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingLeader(false)
    }
  }

  const cancelApprovedLeader = async () => {
    if (!confirm('반장/부반장 권한을 취소하시겠어요?')) return
    setSavingLeader(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          role: 'student',
          class_leader_type: null,
          class_leader_status: 'none',
        })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      setLeaderChoice('none')
      alert('권한을 취소했어요.')
    } catch (err) {
      console.error('Cancel leader failed:', err)
      alert(`취소 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingLeader(false)
    }
  }

  const status = profile.class_leader_status
  const currentTypeLabel =
    profile.class_leader_type === 'vice_leader' ? '부반장' : '반장'
  const isPending = status === 'pending'
  const isApproved = status === 'approved' && profile.role === 'class_leader'
  const isRejected = status === 'rejected'
  const canReapply = status === 'none' || isRejected

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">반 정보</CardTitle>
          <CardDescription>소속된 반을 변경할 수 있어요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="class-select">학년 · 반</Label>
            <div className="flex gap-2">
              <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                {profile.grade ? `${profile.grade}학년` : '학년 없음'}
              </div>
              <Select value={classNumber} onValueChange={setClassNumber}>
                <SelectTrigger id="class-select" className="flex-1 h-9">
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
          </div>
          <Button
            onClick={saveClass}
            disabled={
              savingClass ||
              !classNumber ||
              Number(classNumber) === profile.class_number
            }
            className="w-full"
          >
            {savingClass ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="ml-1">저장 중…</span>
              </>
            ) : (
              '반 정보 저장'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">반장 · 부반장</CardTitle>
          <CardDescription>
            반장/부반장은 관리자 승인 후 반 공지를 올릴 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isApproved && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2Icon className="h-4 w-4" />
              <span>
                현재 <strong className="font-semibold">{currentTypeLabel}</strong>{' '}
                권한이 있습니다.
              </span>
              <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">
                승인됨
              </Badge>
            </div>
          )}
          {isPending && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <ClockIcon className="h-4 w-4" />
              <span>
                <strong className="font-semibold">{currentTypeLabel}</strong> 신청{' '}
                승인 대기 중이에요.
              </span>
              <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100">
                대기
              </Badge>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <XCircleIcon className="h-4 w-4" />
              <span>이전 신청이 반려되었어요. 다시 신청할 수 있어요.</span>
            </div>
          )}

          {isApproved ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={cancelApprovedLeader}
              disabled={savingLeader}
            >
              {savingLeader ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1">처리 중…</span>
                </>
              ) : (
                '권한 취소'
              )}
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {LEADER_OPTIONS.map((opt) => {
                  const active = leaderChoice === opt.value
                  const disabled = isPending
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setLeaderChoice(opt.value)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <Button
                onClick={applyLeader}
                disabled={
                  savingLeader ||
                  (!canReapply && !isPending && leaderChoice !== 'none') ||
                  (isPending && leaderChoice !== 'none')
                }
                className="w-full"
              >
                {savingLeader ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span className="ml-1">처리 중…</span>
                  </>
                ) : leaderChoice === 'none' ? (
                  isPending ? '신청 취소' : '변경 사항 저장'
                ) : (
                  '신청'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/* --------------------------------- Teacher --------------------------------- */

function TeacherSection({
  user,
}: {
  user: NonNullable<ReturnType<typeof useUser>['user']>
}) {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tName, setTName] = useState('')
  const [tSubject, setTSubject] = useState('')
  const [tOffice, setTOffice] = useState('')
  const [tGrades, setTGrades] = useState<number[]>([])
  const [tStatus, setTStatus] = useState<TeacherStatus>('unknown')

  const [editingCell, setEditingCell] = useState<{
    day: number
    period: number
    existing: TeacherSchedule | null
  } | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: t, error: tErr } = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle<Teacher>()
    if (tErr) {
      console.error('load teacher failed', tErr)
    }
    setTeacher(t ?? null)
    if (t) {
      setTName(t.name)
      setTSubject(t.subject)
      setTOffice(t.office_location ?? '')
      setTGrades(t.managed_grades ?? [])
      setTStatus(t.current_status ?? 'unknown')

      const { data: s, error: sErr } = await supabase
        .from('teacher_schedules')
        .select('*')
        .eq('teacher_id', t.id)
      if (sErr) console.error('load schedules failed', sErr)
      setSchedules((s ?? []) as TeacherSchedule[])
    } else {
      setSchedules([])
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const scheduleMap = useMemo(() => {
    const m = new Map<string, TeacherSchedule>()
    for (const s of schedules) m.set(`${s.day_of_week}-${s.period}`, s)
    return m
  }, [schedules])

  const toggleGrade = (g: number) => {
    setTGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort()
    )
  }

  const saveProfile = async () => {
    if (!teacher) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('teachers')
        .update({
          name: tName.trim() || teacher.name,
          subject: tSubject,
          office_location: tOffice.trim(),
          managed_grades: tGrades,
          current_status: tStatus,
        })
        .eq('id', teacher.id)
      if (error) throw error
      await fetchAll()
      alert('프로필을 저장했어요.')
    } catch (err) {
      console.error('save profile failed', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const changeStatusQuick = async (next: TeacherStatus) => {
    if (!teacher) return
    setTStatus(next)
    const supabase = createClient()
    const { error } = await supabase
      .from('teachers')
      .update({ current_status: next })
      .eq('id', teacher.id)
    if (error) {
      console.error('status update failed', error)
      alert(`상태 변경 실패: ${getErrorMessage(error)}`)
      setTStatus(teacher.current_status)
    } else {
      setTeacher({ ...teacher, current_status: next })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    )
  }

  if (!teacher) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-slate-500">
          선생님 프로필이 없어요. 관리자 승인 후 표시됩니다.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재 상태</CardTitle>
          <CardDescription>
            학생들이 선생님을 찾을 때 표시되는 상태예요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {STATUS_OPTIONS.map((s) => {
              const active = tStatus === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => changeStatusQuick(s.value)}
                  className={cn(
                    'rounded-lg px-2 py-2 text-xs font-medium transition-all',
                    active
                      ? `${s.className} shadow-sm`
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">기본 정보</CardTitle>
          <CardDescription>
            이름 · 담당 과목 · 연구실 위치 · 담당 학년
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">이름</Label>
            <Input
              id="t-name"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="t-subject">담당 과목</Label>
              <Select value={tSubject} onValueChange={setTSubject}>
                <SelectTrigger id="t-subject" className="w-full h-9">
                  <SelectValue />
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
                value={tOffice}
                onChange={(e) => setTOffice(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>담당 학년</Label>
            <div className="grid grid-cols-3 gap-2">
              {GRADES.map((g) => {
                const active = tGrades.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'border-purple-500 bg-purple-50 text-purple-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
            onClick={saveProfile}
            disabled={saving}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {saving ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="ml-1">저장 중…</span>
              </>
            ) : (
              '프로필 저장'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">시간표 관리</CardTitle>
          <CardDescription>
            빈 셀은 + 아이콘, 채워진 셀을 눌러 수정/삭제하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-1 text-[10px]">
            <div />
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-xs font-semibold text-slate-700"
              >
                {d}
              </div>
            ))}
            {PERIODS.map((p) => (
              <Fragment key={p}>
                <div className="flex items-center justify-center py-1 text-xs font-medium text-slate-500">
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
                          ? 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                          : 'bg-slate-50 hover:bg-slate-100'
                      )}
                    >
                      {s ? (
                        <>
                          <span className="text-[10px] font-semibold leading-tight">
                            {s.classroom}
                          </span>
                          <span className="text-[9px] leading-tight text-blue-700/70">
                            {s.grade}-{s.class_number}
                          </span>
                          <PencilIcon className="mt-0.5 h-3 w-3 text-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                        </>
                      ) : (
                        <PlusIcon className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {editingCell && (
        <ScheduleCellDialog
          teacherId={teacher.id}
          cell={editingCell}
          onClose={() => setEditingCell(null)}
          onSaved={fetchAll}
        />
      )}
    </>
  )
}

/* -------------------------- Schedule cell dialog -------------------------- */

function ScheduleCellDialog({
  teacherId,
  cell,
  onClose,
  onSaved,
}: {
  teacherId: string
  cell: { day: number; period: number; existing: TeacherSchedule | null }
  onClose: () => void
  onSaved: () => Promise<void>
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
      console.error('schedule save failed', err)
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
      console.error('schedule delete failed', err)
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
                <SelectTrigger id="cell-grade" className="w-full h-9">
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
                <SelectTrigger id="cell-class" className="w-full h-9">
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
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || !classroom.trim() || !grade || !classNumber}
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
