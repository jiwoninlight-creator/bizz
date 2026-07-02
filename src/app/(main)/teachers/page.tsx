'use client'

import { Fragment, Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  SearchIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  MapPinIcon,
  Loader2Icon,
  FileTextIcon,
  UsersRoundIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import type {
  MaterialWithTeacher,
  MessagePurpose,
  MessageTone,
  Teacher,
  TeacherSchedule,
  TeacherStatus,
  WeekType,
} from '@/types/database'
import MaterialCard from '@/components/MaterialCard'
import EmptyState from '@/components/EmptyState'
import { cn, getErrorMessage } from '@/lib/utils'
import { getSubjectColor } from '@/lib/subject-colors'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type StatusMeta = {
  label: string
  dot: string
  chipBg: string
  chipText: string
}

const STATUS_META: Record<TeacherStatus, StatusMeta> = {
  available: {
    label: '자리 있음',
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50 border border-emerald-200',
    chipText: 'text-emerald-700',
  },
  in_class: {
    label: '수업 중',
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50 border border-amber-200',
    chipText: 'text-amber-700',
  },
  meeting: {
    label: '회의 중',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50 border border-red-200',
    chipText: 'text-red-700',
  },
  out: {
    label: '외출',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50 border border-red-200',
    chipText: 'text-red-700',
  },
  unknown: {
    label: '상태 미확인',
    dot: 'bg-zinc-300',
    chipBg: 'bg-zinc-100 border border-zinc-200',
    chipText: 'text-zinc-600',
  },
}

const TONE_OPTIONS: { value: MessageTone; label: string }[] = [
  { value: 'formal', label: '정중하게' },
  { value: 'casual', label: '친근하게' },
]

const PURPOSE_OPTIONS: { value: MessagePurpose; label: string }[] = [
  { value: 'question', label: '질문' },
  { value: 'counsel', label: '상담' },
  { value: 'report', label: '보고' },
  { value: 'research', label: '연구과제' },
]

const DAY_LABELS = ['월', '화', '수', '목', '금'] as const
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

// 학기 시작일 (월요일). 이 날 포함 주 = 1주차(홀).
const SEMESTER_START = new Date(2026, 2, 2) // 2026-03-02 (월)

function currentWeekType(now: Date = new Date()): Exclude<WeekType, 'all'> {
  const startMs = SEMESTER_START.getTime()
  const nowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weeks = Math.floor((nowMs - startMs) / (7 * 24 * 3600 * 1000))
  // week 0 = 홀, week 1 = 짝, ...
  return weeks % 2 === 0 ? 'odd' : 'even'
}

function initial(name: string): string {
  return name.trim().slice(0, 1) || '?'
}

function TeacherCard({
  teacher,
  onClick,
}: {
  teacher: Teacher
  onClick: () => void
}) {
  return (
    <Card
      size="sm"
      onClick={onClick}
      className="cursor-pointer border border-zinc-200 shadow-none transition-colors hover:border-zinc-300 active:scale-[0.995]"
    >
      <div className="flex items-center gap-3 px-3">
        <Avatar className="h-12 w-12 shrink-0">
          {teacher.photo_url ? (
            <AvatarImage src={teacher.photo_url} alt={teacher.name} />
          ) : null}
          <AvatarFallback className="bg-zinc-100 text-base font-semibold text-zinc-700">
            {initial(teacher.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-zinc-900">
              {teacher.name}
            </h3>
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full',
                STATUS_META[teacher.current_status].dot
              )}
              title={STATUS_META[teacher.current_status].label}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {(() => {
              const c = getSubjectColor(teacher.subject)
              return (
                <span
                  className={cn(
                    'inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-medium',
                    c.bg,
                    c.text,
                    c.border
                  )}
                >
                  {teacher.subject}
                </span>
              )
            })()}
          </div>
          {teacher.office_location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
              <MapPinIcon className="h-3 w-3" />
              {teacher.office_location}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

function ScheduleGrid({
  schedules,
  loading,
}: {
  schedules: TeacherSchedule[]
  loading: boolean
}) {
  const thisWeek = useMemo(() => currentWeekType(), [])

  // 오늘 주차와 일치하지 않는 격주 수업은 제외.
  // (day, period) 셀에는 이번 주에 열리는 수업 중 하나만 선택.
  const map = useMemo(() => {
    const byCell = new Map<string, TeacherSchedule[]>()
    for (const s of schedules) {
      const key = `${s.day_of_week}-${s.period}`
      const arr = byCell.get(key) ?? []
      arr.push(s)
      byCell.set(key, arr)
    }
    const filtered = new Map<string, TeacherSchedule>()
    for (const [key, list] of byCell) {
      // 이번 주에 열리는 것: 'all' or 오늘 주차와 같은 week_type
      const applicable = list.filter(
        (s) => s.week_type === 'all' || s.week_type === thisWeek
      )
      // 'all' 이 있으면 우선, 아니면 첫번째
      const chosen =
        applicable.find((s) => s.week_type === 'all') ?? applicable[0]
      if (chosen) filtered.set(key, chosen)
    }
    return filtered
  }, [schedules, thisWeek])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-400">
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    )
  }

  if (schedules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center text-sm text-zinc-400">
        등록된 시간표가 없어요
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-zinc-500">
        <span
          className={cn(
            'inline-flex h-4 items-center rounded-sm px-1 font-semibold',
            thisWeek === 'odd'
              ? 'bg-indigo-500 text-white'
              : 'bg-indigo-400 text-white'
          )}
        >
          {thisWeek === 'odd' ? '홀' : '짝'}수주
        </span>
        <span>기준 표시</span>
      </div>
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
              const s = map.get(`${dayIdx + 1}-${p}`)
              const primary = s?.group_name?.trim() || s?.classroom
              return (
                <div
                  key={dayIdx}
                  className={cn(
                    'relative flex min-h-11 flex-col items-center justify-center rounded-md p-1 text-center',
                    s
                      ? 'border border-indigo-100 bg-indigo-50 text-indigo-900'
                      : 'border border-zinc-100 bg-zinc-50'
                  )}
                >
                  {s && (
                    <>
                      {s.week_type !== 'all' && (
                        <span className="absolute right-0.5 top-0.5 rounded-sm bg-indigo-500 px-0.5 text-[8px] font-bold text-white">
                          {s.week_type === 'odd' ? '홀' : '짝'}
                        </span>
                      )}
                      <span className="line-clamp-1 text-[11px] font-semibold leading-tight">
                        {primary}
                      </span>
                      {s.group_name && s.classroom !== s.group_name && (
                        <span className="line-clamp-1 text-[9px] leading-tight text-indigo-700/70">
                          {s.classroom}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

function TeacherDetailDialog({
  teacher,
  currentUserId,
  open,
  onOpenChange,
  onSendMessage,
}: {
  teacher: Teacher
  currentUserId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSendMessage: () => void
}) {
  const [schedules, setSchedules] = useState<TeacherSchedule[]>([])
  const [materials, setMaterials] = useState<MaterialWithTeacher[]>([])
  const [loading, setLoading] = useState(false)
  const [materialsLoading, setMaterialsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setMaterialsLoading(true)
    const supabase = createClient()

    supabase
      .from('teacher_schedules')
      .select('*')
      .eq('teacher_id', teacher.id)
      .order('day_of_week', { ascending: true })
      .order('period', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('Failed to load schedule:', error)
        setSchedules((data ?? []) as TeacherSchedule[])
        setLoading(false)
      })

    supabase
      .from('materials')
      .select('*, teacher:teachers(id, name, subject)')
      .eq('teacher_id', teacher.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('Failed to load teacher materials:', error)
        setMaterials((data ?? []) as MaterialWithTeacher[])
        setMaterialsLoading(false)
      })

    return () => {
      active = false
    }
  }, [teacher.id, open])

  const materialsByGrade = useMemo(() => {
    const map = new Map<number, MaterialWithTeacher[]>()
    for (const m of materials) {
      const arr = map.get(m.grade) ?? []
      arr.push(m)
      map.set(m.grade, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [materials])

  const meta = STATUS_META[teacher.current_status]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <Avatar className="h-16 w-16 shrink-0">
              {teacher.photo_url ? (
                <AvatarImage src={teacher.photo_url} alt={teacher.name} />
              ) : null}
              <AvatarFallback className="bg-zinc-100 text-xl font-bold text-zinc-700">
                {initial(teacher.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">
                {teacher.name} 선생님
              </DialogTitle>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(() => {
                  const c = getSubjectColor(teacher.subject)
                  return (
                    <span
                      className={cn(
                        'inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-medium',
                        c.bg,
                        c.text,
                        c.border
                      )}
                    >
                      {teacher.subject}
                    </span>
                  )
                })()}
                <span
                  className={cn(
                    'inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-medium',
                    meta.chipBg,
                    meta.chipText
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                  {meta.label}
                </span>
              </div>
              <DialogDescription className="sr-only">
                {teacher.name} 선생님의 상세 정보와 시간표
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {teacher.office_location && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              <MapPinIcon className="h-4 w-4 shrink-0 text-zinc-500" />
              <span>{teacher.office_location}</span>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-800">
              이번 주 시간표
            </h3>
            <ScheduleGrid schedules={schedules} loading={loading} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
                <FileTextIcon className="h-4 w-4 text-indigo-500" />
                이 선생님의 자료
              </h3>
              {!materialsLoading && materials.length > 0 && (
                <span className="text-xs text-zinc-400">
                  총 {materials.length}개
                </span>
              )}
            </div>
            {materialsLoading ? (
              <div className="flex items-center justify-center py-4 text-zinc-400">
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-xs">불러오는 중…</span>
              </div>
            ) : materials.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400">
                아직 등록된 자료가 없어요
              </div>
            ) : (
              <div className="space-y-3">
                {materialsByGrade.map(([grade, list]) => (
                  <div key={grade}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {grade}학년
                      </Badge>
                      <span className="text-[10px] text-zinc-400">
                        {list.length}개
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {list.map((m) => (
                        <MaterialCard
                          key={m.id}
                          material={m}
                          currentUserId={currentUserId}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {teacher.user_id && (
            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto"
            >
              <Link href={`/messages?with=${teacher.user_id}`}>
                <MessagesSquareIcon className="h-4 w-4" />
                <span className="ml-1">대화 내역 보기</span>
              </Link>
            </Button>
          )}
          <Button onClick={onSendMessage} className="w-full sm:w-auto">
            <MessageCircleIcon className="h-4 w-4" />
            <span className="ml-1">메시지 보내기</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MessageDialog({
  teacher,
  user,
  open,
  onOpenChange,
  onSent,
}: {
  teacher: Teacher
  user: SupabaseUser
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent: () => void
}) {
  const [tone, setTone] = useState<MessageTone>('formal')
  const [purpose, setPurpose] = useState<MessagePurpose>('question')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setTone('formal')
    setPurpose('question')
    setTitle('')
    setBody('')
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) resetForm()
    onOpenChange(o)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!teacher.user_id) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: teacher.user_id,
        tone,
        purpose,
        title: title.trim(),
        body: body.trim(),
      })
      if (error) throw error
      alert('메시지를 보냈어요!')
      resetForm()
      onSent()
    } catch (err) {
      console.error('Send message failed:', err)
      alert(`전송에 실패했어요: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    title.trim().length > 0 && body.trim().length > 0 && !submitting

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{teacher.name} 선생님께 메시지</DialogTitle>
          <DialogDescription>
            톤과 목적을 골라 정리된 메시지를 보내세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="msg-tone">톤</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as MessageTone)}>
                <SelectTrigger id="msg-tone" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg-purpose">목적</Label>
              <Select
                value={purpose}
                onValueChange={(v) => setPurpose(v as MessagePurpose)}
              >
                <SelectTrigger id="msg-purpose" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURPOSE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg-title">제목</Label>
            <Input
              id="msg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 수행평가 관련 질문"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg-body">본문</Label>
            <Textarea
              id="msg-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="선생님께 전달할 내용을 적어주세요."
              rows={6}
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1">보내는 중…</span>
                </>
              ) : (
                '보내기'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function TeachersPage() {
  return (
    <Suspense fallback={<TeachersLoading />}>
      <TeachersInner />
    </Suspense>
  )
}

function TeachersLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-zinc-400">
      <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
      <span className="text-sm">불러오는 중…</span>
    </div>
  )
}

function TeachersInner() {
  const { user } = useUser()
  const params = useSearchParams()
  const teacherIdParam = params.get('teacher')

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [selected, setSelected] = useState<Teacher | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)

  // ?teacher=<id> 로 진입 시 해당 선생님 상세 자동 오픈
  useEffect(() => {
    if (!teacherIdParam || teachers.length === 0) return
    const t = teachers.find((x) => x.id === teacherIdParam)
    if (t) {
      setSelected(t)
      setDetailOpen(true)
    }
  }, [teacherIdParam, teachers])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const { data: pendingRows, error: pendingErr } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'teacher')
        .eq('teacher_status', 'pending')
      if (pendingErr) console.error('Failed to load pending teachers:', pendingErr)
      const pendingUserIds = new Set(
        (pendingRows ?? []).map((r: { id: string }) => r.id)
      )

      let query = supabase
        .from('teachers')
        .select('*')
        .order('name', { ascending: true })

      if (debouncedSearch) {
        const term = debouncedSearch.replace(/[%,]/g, '')
        query = query.or(`name.ilike.%${term}%,subject.ilike.%${term}%`)
      }

      const { data, error } = await query
      if (!active) return
      if (error) {
        console.error('Failed to load teachers:', error)
        setTeachers([])
      } else {
        const rows = (data ?? []) as Teacher[]
        const visible = rows.filter((t) => {
          if (!t.is_self_registered) return true
          if (!t.user_id) return true
          return !pendingUserIds.has(t.user_id)
        })
        setTeachers(visible)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [debouncedSearch])

  const openDetail = (teacher: Teacher) => {
    setSelected(teacher)
    setDetailOpen(true)
  }

  const handleSendMessage = () => {
    if (!selected) return
    if (!selected.user_id) {
      alert(
        '선생님이 아직 앱에 가입하지 않으셨어요. 나중에 다시 시도해주세요.'
      )
      return
    }
    setDetailOpen(false)
    setMessageOpen(true)
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-zinc-900">선생님 찾기</h1>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          type="search"
          placeholder="이름 또는 과목으로 검색"
          className="h-9 pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">불러오는 중…</span>
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={UsersRoundIcon}
          title={
            debouncedSearch ? '검색 결과가 없어요' : '선생님 정보가 없어요'
          }
          description={
            debouncedSearch
              ? '다른 이름이나 과목으로 다시 검색해보세요.'
              : '아직 등록된 선생님이 없어요. 관리자에게 문의해주세요.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teachers.map((t) => (
            <TeacherCard key={t.id} teacher={t} onClick={() => openDetail(t)} />
          ))}
        </div>
      )}

      {selected && (
        <TeacherDetailDialog
          teacher={selected}
          currentUserId={user?.id}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onSendMessage={handleSendMessage}
        />
      )}

      {selected && user && (
        <MessageDialog
          teacher={selected}
          user={user}
          open={messageOpen}
          onOpenChange={setMessageOpen}
          onSent={() => setMessageOpen(false)}
        />
      )}
    </div>
  )
}
