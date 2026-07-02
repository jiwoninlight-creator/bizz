'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangleIcon,
  BellIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  FileEditIcon,
  GraduationCapIcon,
  ListIcon,
  Loader2Icon,
  PalmtreeIcon,
  PartyPopperIcon,
  PencilIcon,
  PlusIcon,
  SchoolIcon,
  SparklesIcon,
  StickyNoteIcon,
  Trash2Icon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import type {
  DailyMemo,
  Event,
  EventScope,
  EventType,
  SchoolEvent,
  SchoolEventCategory,
} from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import { SCHOOL_PERIODS, findPeriodByValue } from '@/lib/school-schedule'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ViewMode = 'calendar' | 'list'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

type EventTypeMeta = {
  label: string
  dot: string
  chipBg: string
  chipText: string
  cardBg: string
  cardBorder: string
}

const EVENT_TYPE_META: Record<EventType, EventTypeMeta> = {
  assignment: {
    label: '과제',
    dot: 'bg-indigo-500',
    chipBg: 'bg-indigo-50',
    chipText: 'text-indigo-700 border-indigo-200',
    cardBg: 'bg-white',
    cardBorder: 'border-zinc-200',
  },
  exam: {
    label: '시험',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50',
    chipText: 'text-red-600 border-red-200',
    cardBg: 'bg-white',
    cardBorder: 'border-zinc-200',
  },
  personal: {
    label: '개인',
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50',
    chipText: 'text-emerald-600 border-emerald-200',
    cardBg: 'bg-white',
    cardBorder: 'border-zinc-200',
  },
}

const EVENT_TYPE_ORDER: EventType[] = ['assignment', 'exam', 'personal']

type SchoolEventCategoryMeta = {
  label: string
  Icon: React.ComponentType<{ className?: string }>
  cellBg: string
  cellText: string
  cardBg: string
  cardBorder: string
  cardText: string
  chipBg: string
}

const SCHOOL_CATEGORY_META: Record<
  SchoolEventCategory,
  SchoolEventCategoryMeta
> = {
  holiday: {
    label: '휴일',
    Icon: PalmtreeIcon,
    cellBg: 'bg-red-50',
    cellText: 'text-red-600',
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-200',
    cardText: 'text-red-800',
    chipBg: 'bg-red-100 text-red-700 border-red-200',
  },
  exam: {
    label: '시험',
    Icon: FileEditIcon,
    cellBg: 'bg-orange-50',
    cellText: 'text-orange-700',
    cardBg: 'bg-orange-50',
    cardBorder: 'border-orange-200',
    cardText: 'text-orange-800',
    chipBg: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  special: {
    label: '특별일정',
    Icon: SparklesIcon,
    cellBg: 'bg-blue-50',
    cellText: 'text-blue-700',
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-200',
    cardText: 'text-blue-800',
    chipBg: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  vacation_start: {
    label: '방학',
    Icon: GraduationCapIcon,
    cellBg: 'bg-purple-50',
    cellText: 'text-purple-700',
    cardBg: 'bg-purple-50',
    cardBorder: 'border-purple-200',
    cardText: 'text-purple-800',
    chipBg: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  ceremony: {
    label: '행사',
    Icon: PartyPopperIcon,
    cellBg: 'bg-green-50',
    cellText: 'text-green-700',
    cardBg: 'bg-green-50',
    cardBorder: 'border-green-200',
    cardText: 'text-green-800',
    chipBg: 'bg-green-100 text-green-700 border-green-200',
  },
}

const LIST_CATEGORY_LABELS: Record<EventType, string> = {
  assignment: '과제',
  exam: '수행평가',
  personal: '개인',
}

const SCOPE_META: Record<EventScope, { label: string; hint: string }> = {
  personal: { label: '나만 보기', hint: '내 캘린더에만 표시' },
  class: { label: '반 공지', hint: '해당 반 전체에 공유' },
  grade: { label: '학년 전체 공지', hint: '학년 전체에 공유' },
  schoolwide: { label: '전교 공지', hint: '전교생에게 공유 (관리자/선생님)' },
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function buildCalendarGrid(anchor: Date): Date[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startWeekday = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startWeekday)
  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    days.push(
      new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + i
      )
    )
  }
  return days
}

function daysFromToday(eventDate: string): number {
  const [y, m, d] = eventDate.split('-').map(Number)
  const target = new Date(y, m - 1, d).getTime()
  const today = startOfDay(new Date()).getTime()
  return Math.round((target - today) / 86400000)
}

function ddayLabel(eventDate: string): string {
  const diff = daysFromToday(eventDate)
  if (diff === 0) return 'D-DAY'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

function ddayColorClass(eventDate: string): string {
  const diff = daysFromToday(eventDate)
  if (diff < 0) return 'bg-zinc-100 text-zinc-500 border border-zinc-200'
  if (diff === 0) return 'bg-red-500 text-white border border-red-500'
  if (diff <= 3) return 'bg-orange-500 text-white border border-orange-500'
  if (diff <= 7) return 'bg-amber-100 text-amber-700 border border-amber-200'
  return 'bg-zinc-900 text-white border border-zinc-900'
}

function formatSelectedDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${m}월 ${d}일 (${WEEKDAYS[date.getDay()]})`
}

function eventDeadline(event: Event): number {
  const [y, m, d] = event.event_date.split('-').map(Number)
  if (event.start_time) {
    const [hh, mm] = event.start_time.split(':').map(Number)
    return new Date(y, m - 1, d, hh, mm).getTime()
  }
  return new Date(y, m - 1, d, 23, 59, 59).getTime()
}

function sortByDday(events: Event[]): Event[] {
  return [...events].sort((a, b) => {
    const dA = daysFromToday(a.event_date)
    const dB = daysFromToday(b.event_date)
    const pastA = dA < 0
    const pastB = dB < 0
    if (pastA !== pastB) return pastA ? 1 : -1
    if (pastA) return dB - dA
    return dA - dB
  })
}

function inferEventType(title: string, fallback: EventType): EventType {
  if (/수행/.test(title)) return 'exam'
  if (/과제|숙제/.test(title)) return 'assignment'
  return fallback
}

type FormMode = 'add' | 'edit'
type LeaderChoiceScope = EventScope

export default function CalendarPage() {
  const {
    user,
    profile,
    loading: userLoading,
    isAdmin,
    isClassLeader,
    isTeacher,
  } = useUser()

  const [view, setView] = useState<ViewMode>('calendar')
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date())
  )
  const [events, setEvents] = useState<Event[]>([])
  const [memos, setMemos] = useState<DailyMemo[]>([])
  const [completions, setCompletions] = useState<Set<string>>(new Set())
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [listCategory, setListCategory] = useState<EventType>('assignment')
  const [showCompleted, setShowCompleted] = useState(false)

  // Dialog / form
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('add')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [autoType, setAutoType] = useState(true)
  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formDate, setFormDate] = useState<string>(toDateKey(new Date()))
  const [formType, setFormType] = useState<EventType>('assignment')
  const [formPeriod, setFormPeriod] = useState<string>('')
  const [formCustomTime, setFormCustomTime] = useState(false)
  const [formStartTime, setFormStartTime] = useState('')
  const [formEndTime, setFormEndTime] = useState('')
  const [formMemo, setFormMemo] = useState('')
  const [formScope, setFormScope] = useState<LeaderChoiceScope>('personal')
  const [formTargetGrade, setFormTargetGrade] = useState<string>('')
  const [formTargetClasses, setFormTargetClasses] = useState<number[]>([])

  // Teacher metadata for notice badges + form defaults
  const [teacherUserIds, setTeacherUserIds] = useState<Set<string>>(new Set())
  const [teacherNames, setTeacherNames] = useState<Map<string, string>>(
    new Map()
  )
  const [myTeacherGrades, setMyTeacherGrades] = useState<number[]>([])

  // Memo edit
  const [memoEditing, setMemoEditing] = useState(false)
  const [memoDraft, setMemoDraft] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)

  const gridDays = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth])
  const gridStart = gridDays[0]
  const gridEnd = gridDays[gridDays.length - 1]

  const fetchAll = useCallback(async () => {
    if (userLoading || !user) return
    setLoading(true)

    const supabase = createClient()
    const startKey = toDateKey(gridStart)
    const endKey = toDateKey(gridEnd)

    const conds: string[] = [`user_id.eq.${user.id}`]
    conds.push(`and(scope.eq.schoolwide,approval_status.eq.approved)`)
    if (profile?.grade) {
      conds.push(
        `and(scope.eq.grade,grade.eq.${profile.grade},approval_status.eq.approved)`
      )
      if (profile.class_number) {
        conds.push(
          `and(scope.eq.class,grade.eq.${profile.grade},class_number.eq.${profile.class_number},approval_status.eq.approved)`
        )
      }
    }

    const eventsPromise = supabase
      .from('events')
      .select('*')
      .gte('event_date', startKey)
      .lte('event_date', endKey)
      .or(conds.join(','))
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true })

    const memosPromise = supabase
      .from('daily_memos')
      .select('*')
      .eq('user_id', user.id)
      .gte('memo_date', startKey)
      .lte('memo_date', endKey)

    const completionsPromise = supabase
      .from('event_completions')
      .select('event_id')
      .eq('user_id', user.id)

    const schoolEventsPromise = supabase
      .from('school_events')
      .select('*')
      .gte('event_date', startKey)
      .lte('event_date', endKey)
      .order('event_date', { ascending: true })

    const [
      { data: eventData, error: eventError },
      { data: memoData, error: memoError },
      { data: completionData, error: completionError },
      { data: schoolEventData, error: schoolEventError },
    ] = await Promise.all([
      eventsPromise,
      memosPromise,
      completionsPromise,
      schoolEventsPromise,
    ])

    if (eventError) console.error('events fetch failed:', eventError)
    if (memoError) console.error('memos fetch failed:', memoError)
    if (completionError)
      console.error('completions fetch failed:', completionError)
    if (schoolEventError)
      console.error('school_events fetch failed:', schoolEventError)

    setEvents((eventData ?? []) as Event[])
    setMemos((memoData ?? []) as DailyMemo[])
    setCompletions(
      new Set(
        ((completionData ?? []) as { event_id: string }[]).map((c) => c.event_id)
      )
    )
    setSchoolEvents((schoolEventData ?? []) as SchoolEvent[])
    setLoading(false)
  }, [
    gridStart,
    gridEnd,
    user,
    profile?.grade,
    profile?.class_number,
    userLoading,
  ])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('users')
      .select('id, name')
      .eq('role', 'teacher')
      .eq('teacher_status', 'approved')
      .then(({ data }) => {
        const rows = (data ?? []) as { id: string; name: string }[]
        setTeacherUserIds(new Set(rows.map((r) => r.id)))
        setTeacherNames(new Map(rows.map((r) => [r.id, r.name])))
      })
  }, [])

  useEffect(() => {
    if (!isTeacher || !user?.id) {
      setMyTeacherGrades([])
      return
    }
    const supabase = createClient()
    supabase
      .from('teachers')
      .select('managed_grades')
      .eq('user_id', user.id)
      .maybeSingle<{ managed_grades: number[] | null }>()
      .then(({ data }) => {
        setMyTeacherGrades(data?.managed_grades ?? [])
      })
  }, [isTeacher, user?.id])

  // Reminder / notification
  const notifiedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default' && events.length > 0) {
      Notification.requestPermission().catch(() => {})
    }
  }, [events.length])

  const isEventCompleted = useCallback(
    (event: Event): boolean => {
      if (event.scope === 'personal' && event.user_id === user?.id) {
        return event.is_completed
      }
      return completions.has(event.id)
    },
    [completions, user?.id]
  )

  const upcoming24h = useMemo(() => {
    const now = Date.now()
    return events
      .filter((e) => !isEventCompleted(e))
      .filter((e) => {
        if (e.user_id === user?.id) return true
        return e.approval_status === 'approved'
      })
      .filter((e) => {
        const t = eventDeadline(e)
        return t > now && t - now <= 24 * 3600 * 1000
      })
      .sort((a, b) => eventDeadline(a) - eventDeadline(b))
  }, [events, user?.id, isEventCompleted])

  const upcoming12h = useMemo(
    () =>
      upcoming24h.filter(
        (e) => eventDeadline(e) - Date.now() <= 12 * 3600 * 1000
      ),
    [upcoming24h]
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    for (const e of upcoming12h) {
      const key = `bizz_notified_${e.id}`
      if (notifiedRef.current.has(e.id)) continue
      if (localStorage.getItem(key)) {
        notifiedRef.current.add(e.id)
        continue
      }
      try {
        new Notification('BIZZ 리마인더', {
          body: `${e.title} — 12시간 이내 마감`,
        })
        localStorage.setItem(key, '1')
        notifiedRef.current.add(e.id)
      } catch (err) {
        console.warn('notification failed:', err)
      }
    }
  }, [upcoming12h])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const list = map.get(e.event_date) ?? []
      list.push(e)
      map.set(e.event_date, list)
    }
    return map
  }, [events])

  const schoolEventsByDate = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>()
    for (const s of schoolEvents) {
      const list = map.get(s.event_date) ?? []
      list.push(s)
      map.set(s.event_date, list)
    }
    return map
  }, [schoolEvents])

  const memoByDate = useMemo(() => {
    const map = new Map<string, DailyMemo>()
    for (const m of memos) map.set(m.memo_date, m)
    return map
  }, [memos])

  const monthEvents = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    return events.filter((e) => {
      const [y, m] = e.event_date.split('-').map(Number)
      return y === year && m - 1 === month
    })
  }, [events, currentMonth])

  const visibleMonthEvents = useMemo(
    () =>
      showCompleted
        ? monthEvents.filter((e) => isEventCompleted(e))
        : monthEvents.filter((e) => !isEventCompleted(e)),
    [monthEvents, showCompleted, isEventCompleted]
  )

  const monthEventsByType = useMemo(() => {
    const groups: Record<EventType, Event[]> = {
      assignment: [],
      exam: [],
      personal: [],
    }
    for (const e of visibleMonthEvents) groups[e.event_type].push(e)
    return groups
  }, [visibleMonthEvents])

  const sortedByCategory = useMemo(
    () => ({
      assignment: sortByDday(monthEventsByType.assignment),
      exam: sortByDday(monthEventsByType.exam),
      personal: sortByDday(monthEventsByType.personal),
    }),
    [monthEventsByType]
  )

  const selectedDateKey = toDateKey(selectedDate)
  const allSelectedEvents = eventsByDate.get(selectedDateKey) ?? []
  const selectedEvents = showCompleted
    ? allSelectedEvents.filter((e) => isEventCompleted(e))
    : allSelectedEvents.filter((e) => !isEventCompleted(e))
  const selectedMemo = memoByDate.get(selectedDateKey)
  const selectedSchoolEvents = schoolEventsByDate.get(selectedDateKey) ?? []

  const canEditEvent = useCallback(
    (event: Event): boolean => {
      if (!user || !profile) return false
      if (event.user_id === user.id) return true
      if (isAdmin) return true
      if (
        isClassLeader &&
        event.scope === 'class' &&
        event.grade === profile.grade &&
        event.class_number === profile.class_number
      )
        return true
      return false
    },
    [user, profile, isAdmin, isClassLeader]
  )

  const goPrev = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    )
  const goNext = () =>
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    )
  const goToday = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(startOfDay(now))
  }

  const openAddDialog = () => {
    setFormMode('add')
    setEditingEventId(null)
    setAutoType(true)
    setFormTitle('')
    setFormSubject('')
    setFormDate(toDateKey(selectedDate))
    setFormType('assignment')
    setFormPeriod('')
    setFormCustomTime(false)
    setFormStartTime('')
    setFormEndTime('')
    setFormMemo('')
    setFormScope('personal')
    setFormTargetGrade(profile?.grade ? String(profile.grade) : '')
    setFormTargetClasses(
      profile?.class_number ? [profile.class_number] : []
    )
    setDialogOpen(true)
  }

  const openEditDialog = (event: Event) => {
    setFormMode('edit')
    setEditingEventId(event.id)
    setAutoType(false)
    setFormTitle(event.title)
    setFormSubject(event.subject ?? '')
    setFormDate(event.event_date)
    setFormType(event.event_type)
    if (event.period) {
      setFormPeriod(event.period)
      setFormCustomTime(false)
      setFormStartTime('')
      setFormEndTime('')
    } else if (event.start_time || event.end_time) {
      setFormPeriod('')
      setFormCustomTime(true)
      setFormStartTime(event.start_time?.slice(0, 5) ?? '')
      setFormEndTime(event.end_time?.slice(0, 5) ?? '')
    } else {
      setFormPeriod('')
      setFormCustomTime(false)
      setFormStartTime('')
      setFormEndTime('')
    }
    setFormMemo(event.memo ?? '')
    setFormScope(event.scope)
    setFormTargetGrade(event.grade ? String(event.grade) : '')
    setFormTargetClasses(event.class_number ? [event.class_number] : [])
    setDialogOpen(true)
  }

  // Auto-detect event_type from title (only in add mode + when user hasn't manually chosen)
  useEffect(() => {
    if (!dialogOpen) return
    if (!autoType) return
    const inferred = inferEventType(formTitle, formType)
    if (inferred !== formType) setFormType(inferred)
  }, [formTitle, autoType, dialogOpen, formType])

  const handleTypeChange = (t: EventType) => {
    setAutoType(false)
    setFormType(t)
  }

  const handlePeriodChange = (v: string) => {
    setFormPeriod(v)
    setFormCustomTime(false)
    setFormStartTime('')
    setFormEndTime('')
  }

  const toggleCustomTime = () => {
    if (!formCustomTime) {
      setFormPeriod('')
      const p = findPeriodByValue(formPeriod)
      if (p) {
        setFormStartTime(p.start)
        setFormEndTime(p.end)
      }
    }
    setFormCustomTime((v) => !v)
  }

  const scopeAvailable = (s: EventScope): boolean => {
    if (s === 'personal') return true
    if (s === 'schoolwide') return isAdmin || isTeacher
    if (isAdmin || isTeacher) return true
    if (!profile?.grade) return false
    if (s === 'class') return !!profile.class_number
    return true
  }

  const buildTimeFields = () => {
    let period: string | null = null
    let start: string | null = null
    let end: string | null = null
    if (formCustomTime) {
      start = formStartTime || null
      end = formEndTime || null
    } else if (formPeriod) {
      const p = findPeriodByValue(formPeriod)
      period = formPeriod
      start = p?.start ?? null
      end = p?.end ?? null
    }
    return { period, start, end }
  }

  const commonPayloadBase = () => {
    const { period, start, end } = buildTimeFields()
    return {
      title: formTitle.trim(),
      subject: formSubject.trim() || null,
      event_date: formDate,
      event_type: formType,
      memo: formMemo.trim() || null,
      period,
      start_time: start,
      end_time: end,
    }
  }

  const approvalForScope = (
    s: EventScope,
    grade: number | null,
    classNumber: number | null
  ): 'approved' | 'pending' => {
    if (s === 'personal') return 'approved'
    if (isAdmin || isTeacher) return 'approved'
    if (
      s === 'class' &&
      isClassLeader &&
      grade === profile?.grade &&
      classNumber === profile?.class_number
    ) {
      return 'approved'
    }
    return 'pending'
  }

  const buildEventPayload = () => {
    const base = commonPayloadBase()
    let gradeVal: number | null = null
    let classVal: number | null = null

    if (formScope === 'personal') {
      // no grade/class
    } else if (formScope === 'schoolwide') {
      // no grade/class
    } else if (formScope === 'class') {
      gradeVal =
        isAdmin || isTeacher
          ? formTargetGrade
            ? Number(formTargetGrade)
            : profile?.grade ?? null
          : profile?.grade ?? null
      classVal =
        isAdmin || isTeacher
          ? formTargetClasses[0] ?? null
          : profile?.class_number ?? null
    } else if (formScope === 'grade') {
      gradeVal =
        isAdmin || isTeacher
          ? formTargetGrade
            ? Number(formTargetGrade)
            : profile?.grade ?? null
          : profile?.grade ?? null
    }

    return {
      ...base,
      grade: gradeVal,
      class_number: classVal,
      scope: formScope,
      approval_status: approvalForScope(formScope, gradeVal, classVal),
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const payload = buildEventPayload()

      if (formMode === 'add') {
        const multiClass =
          (isAdmin || isTeacher) &&
          formScope === 'class' &&
          formTargetClasses.length > 1
        if (multiClass) {
          const gradeVal = formTargetGrade
            ? Number(formTargetGrade)
            : profile?.grade ?? null
          const rows = formTargetClasses.map((cls) => ({
            user_id: user.id,
            ...payload,
            grade: gradeVal,
            class_number: cls,
          }))
          const { error } = await supabase.from('events').insert(rows)
          if (error) throw error
        } else {
          const { error } = await supabase.from('events').insert({
            user_id: user.id,
            ...payload,
          })
          if (error) throw error
        }
      } else if (formMode === 'edit' && editingEventId) {
        const { error } = await supabase
          .from('events')
          .update({
            ...payload,
            approved_by:
              payload.approval_status === 'approved' ? user.id : null,
          })
          .eq('id', editingEventId)
        if (error) throw error
      }

      setDialogOpen(false)
      const [y, m, d] = formDate.split('-').map(Number)
      const insertedDate = new Date(y, m - 1, d)
      if (
        insertedDate.getFullYear() !== currentMonth.getFullYear() ||
        insertedDate.getMonth() !== currentMonth.getMonth()
      ) {
        setCurrentMonth(new Date(y, m - 1, 1))
      }
      setSelectedDate(insertedDate)
      await fetchAll()
    } catch (err) {
      console.error('Save event failed:', err)
      alert(`저장에 실패했습니다: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('이 일정을 삭제할까요?')) return
    const supabase = createClient()
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) {
      console.error('Delete event failed:', error)
      alert(`삭제 실패: ${getErrorMessage(error)}`)
      return
    }
    await fetchAll()
  }

  const toggleCompletion = async (event: Event) => {
    if (!user) return
    const currentlyDone = isEventCompleted(event)
    const supabase = createClient()

    if (event.scope === 'personal' && event.user_id === user.id) {
      const { error } = await supabase
        .from('events')
        .update({
          is_completed: !currentlyDone,
          completed_at: currentlyDone ? null : new Date().toISOString(),
        })
        .eq('id', event.id)
      if (error) {
        console.error('Toggle completion failed:', error)
        alert(`완료 처리 실패: ${getErrorMessage(error)}`)
        return
      }
    } else {
      if (currentlyDone) {
        const { error } = await supabase
          .from('event_completions')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id)
        if (error) {
          console.error('Uncomplete failed:', error)
          alert(`완료 취소 실패: ${getErrorMessage(error)}`)
          return
        }
      } else {
        const { error } = await supabase.from('event_completions').insert({
          event_id: event.id,
          user_id: user.id,
        })
        if (error) {
          console.error('Complete failed:', error)
          alert(`완료 처리 실패: ${getErrorMessage(error)}`)
          return
        }
      }
    }
    await fetchAll()
  }

  const startEditMemo = () => {
    setMemoDraft(selectedMemo?.content ?? '')
    setMemoEditing(true)
  }
  const cancelEditMemo = () => {
    setMemoEditing(false)
    setMemoDraft('')
  }
  const saveMemo = async () => {
    if (!user) return
    setSavingMemo(true)
    try {
      const supabase = createClient()
      const content = memoDraft.trim()
      if (selectedMemo) {
        if (content.length === 0) {
          const { error } = await supabase
            .from('daily_memos')
            .delete()
            .eq('id', selectedMemo.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('daily_memos')
            .update({
              content,
              updated_at: new Date().toISOString(),
            })
            .eq('id', selectedMemo.id)
          if (error) throw error
        }
      } else {
        if (content.length === 0) {
          setMemoEditing(false)
          return
        }
        const { error } = await supabase.from('daily_memos').insert({
          user_id: user.id,
          memo_date: selectedDateKey,
          content,
        })
        if (error) throw error
      }
      setMemoEditing(false)
      setMemoDraft('')
      await fetchAll()
    } catch (err) {
      console.error('Save memo failed:', err)
      alert(`메모 저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingMemo(false)
    }
  }

  const canSubmit =
    formTitle.trim().length > 0 &&
    formDate.length > 0 &&
    scopeAvailable(formScope) &&
    !submitting &&
    // For teacher/admin picking class/grade scope, require a target grade
    !(
      (isAdmin || isTeacher) &&
      (formScope === 'class' || formScope === 'grade') &&
      !formTargetGrade
    ) &&
    // For teacher/admin picking class scope, require at least one class
    !(
      (isAdmin || isTeacher) &&
      formScope === 'class' &&
      formTargetClasses.length === 0
    )

  const today = useMemo(() => startOfDay(new Date()), [])
  const monthTitle = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`

  const reminderTone =
    upcoming12h.length > 0
      ? 'urgent'
      : upcoming24h.length > 0
        ? 'warn'
        : 'none'
  const reminderCount = upcoming24h.length
  const reminderFirst = upcoming24h[0]

  return (
    <div className="p-4 space-y-4">
      {reminderTone !== 'none' && reminderFirst && (
        <button
          type="button"
          onClick={() => setView('list')}
          className={cn(
            'flex w-full items-start gap-3 rounded-lg border p-3 text-left',
            reminderTone === 'urgent'
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          )}
        >
          {reminderTone === 'urgent' ? (
            <BellIcon className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">
              {reminderTone === 'urgent'
                ? '12시간 이내 마감'
                : '24시간 이내 마감'}
            </div>
            <div className="mt-0.5 text-xs">
              {reminderFirst.title}
              {reminderCount > 1 ? ` 외 ${reminderCount - 1}건` : ''}
            </div>
          </div>
        </button>
      )}

      <div className="inline-flex w-full items-center rounded-lg border border-zinc-200 bg-white p-0.5">
        {(['calendar', 'list'] as const).map((v) => {
          const active = view === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:text-zinc-800'
              )}
              aria-pressed={active}
            >
              {v === 'calendar' ? (
                <CalendarIcon className="h-3.5 w-3.5" />
              ) : (
                <ListIcon className="h-3.5 w-3.5" />
              )}
              <span>{v === 'calendar' ? '캘린더' : '목록'}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goPrev}
          aria-label="이전 달"
          className="text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeftIcon />
        </Button>
        <button
          type="button"
          onClick={goToday}
          className="group flex flex-col items-center leading-tight"
        >
          <h1 className="text-[17px] font-semibold tracking-tight text-zinc-900">
            {monthTitle}
          </h1>
          <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-600">
            오늘로 이동
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goNext}
          aria-label="다음 달"
          className="text-zinc-500 hover:text-zinc-900"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setShowCompleted((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
        >
          {showCompleted ? (
            <>
              <EyeOffIcon className="h-3 w-3" />
              완료 목록 숨기기
            </>
          ) : (
            <>
              <EyeIcon className="h-3 w-3" />
              완료 목록 보기
            </>
          )}
        </button>
      </div>

      {view === 'calendar' ? (
        <>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50/60">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={cn(
                    'py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest',
                    i === 0 && 'text-red-400',
                    i === 6 && 'text-indigo-400',
                    i !== 0 && i !== 6 && 'text-zinc-400'
                  )}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {gridDays.map((d, idx) => {
                const key = toDateKey(d)
                const inMonth = d.getMonth() === currentMonth.getMonth()
                const isToday = isSameDay(d, today)
                const isSelected = isSameDay(d, selectedDate)
                const dayEvents = eventsByDate.get(key) ?? []
                const visibleDay = showCompleted
                  ? dayEvents.filter((e) => isEventCompleted(e))
                  : dayEvents.filter((e) => !isEventCompleted(e))
                const typesInDay = new Set(visibleDay.map((e) => e.event_type))
                const dayOfWeek = d.getDay()
                const hasMemo = memoByDate.has(key)
                const daySchool = schoolEventsByDate.get(key) ?? []
                const primarySchool = daySchool[0]
                const schoolMeta = primarySchool
                  ? SCHOOL_CATEGORY_META[primarySchool.category]
                  : null
                const col = idx % 7
                const row = Math.floor(idx / 7)
                const rows = Math.ceil(gridDays.length / 7)

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(d))}
                    className={cn(
                      'relative flex aspect-square flex-col items-center justify-start p-1 text-[13px] transition-colors',
                      col !== 6 && 'border-r border-zinc-100',
                      row !== rows - 1 && 'border-b border-zinc-100',
                      'hover:bg-zinc-50',
                      // 학사일정 배경 (선택되지 않은 날짜에만 은은하게)
                      !isSelected && schoolMeta && schoolMeta.cellBg,
                      isSelected && 'bg-indigo-50 hover:bg-indigo-50',
                      !inMonth && 'text-zinc-300',
                      inMonth && dayOfWeek === 0 && 'text-red-500',
                      inMonth && dayOfWeek === 6 && 'text-indigo-500',
                      inMonth &&
                        dayOfWeek !== 0 &&
                        dayOfWeek !== 6 &&
                        'text-zinc-800',
                      inMonth &&
                        !isSelected &&
                        schoolMeta &&
                        primarySchool?.category === 'holiday' &&
                        'text-red-600',
                      isSelected && 'font-semibold text-indigo-700'
                    )}
                    title={
                      daySchool.length > 0
                        ? daySchool.map((s) => s.title).join(' · ')
                        : undefined
                    }
                  >
                    <span
                      className={cn(
                        'mt-1 flex h-6 w-6 items-center justify-center rounded-md font-medium tabular-nums',
                        isToday
                          ? 'bg-zinc-900 text-white'
                          : isSelected
                            ? 'text-indigo-700'
                            : ''
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {hasMemo && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                    {daySchool.length > 0 && (
                      <div
                        className={cn(
                          'mt-0.5 line-clamp-1 w-full px-0.5 text-center text-[9px] font-medium leading-tight',
                          !isSelected && schoolMeta
                            ? schoolMeta.cellText
                            : 'text-zinc-600',
                          isSelected && 'text-indigo-700'
                        )}
                      >
                        {primarySchool?.title}
                        {daySchool.length > 1 && ` +${daySchool.length - 1}`}
                      </div>
                    )}
                    <div className="mt-auto mb-1 flex h-1 items-center gap-0.5">
                      {EVENT_TYPE_ORDER.map((t) =>
                        typesInDay.has(t) ? (
                          <span
                            key={t}
                            className={cn(
                              'h-1 w-1 rounded-full',
                              EVENT_TYPE_META[t].dot
                            )}
                          />
                        ) : null
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedSchoolEvents.length > 0 && (
            <SchoolEventSection events={selectedSchoolEvents} />
          )}

          <MemoSection
            memo={selectedMemo}
            editing={memoEditing}
            draft={memoDraft}
            saving={savingMemo}
            onStartEdit={startEditMemo}
            onCancel={cancelEditMemo}
            onDraftChange={setMemoDraft}
            onSave={saveMemo}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">
                {formatSelectedDate(selectedDate)}
              </h2>
              <span className="text-xs text-zinc-400">
                {selectedEvents.length > 0 ? `${selectedEvents.length}개` : ''}
              </span>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : selectedEvents.length === 0 ? (
              <EmptyBox
                message={
                  showCompleted
                    ? '완료된 일정이 없어요'
                    : '이 날짜에는 일정이 없습니다'
                }
              />
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((ev) => (
                  <SelectedEventItem
                    key={ev.id}
                    event={ev}
                    own={ev.user_id === user?.id}
                    canEdit={canEditEvent(ev)}
                    completed={isEventCompleted(ev)}
                    teacherName={
                      ev.scope !== 'personal' &&
                      teacherUserIds.has(ev.user_id)
                        ? teacherNames.get(ev.user_id)
                        : undefined
                    }
                    onDelete={() => handleDelete(ev.id)}
                    onEdit={() => openEditDialog(ev)}
                    onToggleDone={() => toggleCompletion(ev)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
            <span className="text-sm font-semibold text-zinc-800">
              {monthTitle}
            </span>
            <span className="text-xs text-zinc-500">
              {showCompleted ? '완료 ' : ''}총 {visibleMonthEvents.length}개
            </span>
          </div>

          {loading ? (
            <LoadingSpinner />
          ) : (
            <Tabs
              value={listCategory}
              onValueChange={(v) => setListCategory(v as EventType)}
            >
              <TabsList className="grid w-full grid-cols-3">
                {EVENT_TYPE_ORDER.map((t) => (
                  <TabsTrigger key={t} value={t}>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          EVENT_TYPE_META[t].dot
                        )}
                      />
                      {LIST_CATEGORY_LABELS[t]}
                      <span className="text-xs text-zinc-500">
                        {monthEventsByType[t].length}
                      </span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {EVENT_TYPE_ORDER.map((t) => (
                <TabsContent key={t} value={t}>
                  <EventListSection
                    type={t}
                    events={sortedByCategory[t]}
                    currentUserId={user?.id}
                    isEventCompleted={isEventCompleted}
                    canEditEvent={canEditEvent}
                    teacherUserIds={teacherUserIds}
                    teacherNames={teacherNames}
                    onDelete={handleDelete}
                    onEdit={openEditDialog}
                    onToggleDone={toggleCompletion}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}

      <Button
        onClick={openAddDialog}
        size="lg"
        className="fixed bottom-20 right-4 z-40 h-12 rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-white shadow-lg shadow-zinc-900/20 hover:bg-zinc-800"
      >
        <PlusIcon className="h-5 w-5" />
        <span className="ml-1 text-sm font-semibold">일정 추가</span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'add' ? '일정 추가' : '일정 수정'}
            </DialogTitle>
            <DialogDescription>
              범위를 선택하면 나만 볼지, 반/학년에 공유할지 정할 수 있어요.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder='"수학 수행평가", "국어 과제" 등'
                required
              />
              {autoType && formMode === 'add' && (
                <p className="text-[11px] text-zinc-400">
                  “수행”/“과제”/“숙제” 키워드를 감지하면 종류가 자동으로 바뀌어요.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="event-subject">과목</Label>
                <Input
                  id="event-subject"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="예: 수학"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="event-date">날짜</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-type">종류</Label>
              <Select
                value={formType}
                onValueChange={(v) => handleTypeChange(v as EventType)}
              >
                <SelectTrigger id="event-type" className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assignment">과제</SelectItem>
                  <SelectItem value="exam">시험</SelectItem>
                  <SelectItem value="personal">개인</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" />
                  시간 (선택)
                </Label>
                <button
                  type="button"
                  onClick={toggleCustomTime}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  {formCustomTime ? '교시로 선택' : '직접 입력'}
                </button>
              </div>
              {formCustomTime ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    aria-label="시작 시간"
                  />
                  <Input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    aria-label="종료 시간"
                  />
                </div>
              ) : (
                <Select value={formPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder="교시 선택 (없어도 저장 가능)" />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} · {p.start}–{p.end}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="event-memo">메모</Label>
              <Textarea
                id="event-memo"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="세부 내용 (선택)"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>범위</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    'personal',
                    'class',
                    'grade',
                    ...(isAdmin || isTeacher
                      ? (['schoolwide'] as const)
                      : []),
                  ] as EventScope[]
                ).map((s) => {
                  const available = scopeAvailable(s)
                  const active = formScope === s
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={!available}
                      onClick={() => setFormScope(s)}
                      className={cn(
                        'flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                        active
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                        !available && 'cursor-not-allowed opacity-50'
                      )}
                      aria-pressed={active}
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {SCOPE_META[s].label}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {SCOPE_META[s].hint}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'mt-1 h-4 w-4 shrink-0 rounded-full border-2',
                          active
                            ? 'border-zinc-900 bg-zinc-900'
                            : 'border-zinc-300'
                        )}
                      />
                    </button>
                  )
                })}
              </div>

              {(isAdmin || isTeacher) &&
                (formScope === 'class' || formScope === 'grade') && (
                  <div className="space-y-2 rounded-lg bg-zinc-50 p-2">
                    <div className="space-y-1">
                      <Label htmlFor="target-grade" className="text-xs">
                        대상 학년
                      </Label>
                      <Select
                        value={formTargetGrade}
                        onValueChange={setFormTargetGrade}
                      >
                        <SelectTrigger id="target-grade" className="h-8 w-full">
                          <SelectValue placeholder="학년 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {(isTeacher && myTeacherGrades.length > 0
                            ? myTeacherGrades
                            : [1, 2, 3]
                          ).map((g) => (
                            <SelectItem key={g} value={String(g)}>
                              {g}학년
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {formScope === 'class' && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          대상 반 (여러 개 선택 시 각 반에 등록)
                        </Label>
                        <div className="grid grid-cols-6 gap-1">
                          {[1, 2, 3, 4, 5, 6].map((c) => {
                            const on = formTargetClasses.includes(c)
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setFormTargetClasses((prev) =>
                                    prev.includes(c)
                                      ? prev.filter((x) => x !== c)
                                      : [...prev, c].sort()
                                  )
                                }
                                className={cn(
                                  'rounded-md py-1 text-xs font-medium transition-colors',
                                  on
                                    ? 'bg-zinc-900 text-white border border-zinc-900'
                                    : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                                )}
                                aria-pressed={on}
                              >
                                {c}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {formScope !== 'personal' &&
                !isAdmin &&
                !isTeacher &&
                !(isClassLeader && formScope === 'class') && (
                  <p className="text-[11px] text-amber-600">
                    공유 일정은 관리자 승인 후 다른 사람에게 보여요.
                  </p>
                )}
              {(isAdmin || isTeacher) && formScope !== 'personal' && (
                <p className="text-[11px] text-emerald-700">
                  {isAdmin ? '관리자' : '선생님'} 권한으로 즉시 공개돼요.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                취소
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span className="ml-1">저장 중…</span>
                  </>
                ) : formMode === 'add' ? (
                  '추가'
                ) : (
                  '수정'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------ Subcomponents ------------------------------ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8 text-zinc-400">
      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
      <span className="text-sm">불러오는 중…</span>
    </div>
  )
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
      {message}
    </div>
  )
}

function SchoolEventSection({ events }: { events: SchoolEvent[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
        <SchoolIcon className="h-4 w-4 text-zinc-500" />
        <span>학교 일정</span>
        <span className="text-xs font-normal text-zinc-400">
          {events.length}개
        </span>
      </div>
      <ul className="space-y-1.5">
        {events.map((s) => {
          const meta = SCHOOL_CATEGORY_META[s.category]
          const Icon = meta.Icon
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2',
                meta.cardBg,
                meta.cardBorder
              )}
            >
              <span
                className={cn(
                  'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                  meta.chipBg
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div
                  className={cn(
                    'text-sm font-semibold',
                    meta.cardText
                  )}
                >
                  {s.title}
                </div>
                <div
                  className={cn(
                    'mt-0.5 flex items-center gap-1 text-[11px]',
                    meta.cardText,
                    'opacity-80'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-4 items-center rounded-md border px-1 text-[10px] font-medium',
                      meta.chipBg
                    )}
                  >
                    {meta.label}
                  </span>
                  {s.description && (
                    <span className="line-clamp-1">{s.description}</span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MemoSection({
  memo,
  editing,
  draft,
  saving,
  onStartEdit,
  onCancel,
  onDraftChange,
  onSave,
}: {
  memo: DailyMemo | undefined
  editing: boolean
  draft: string
  saving: boolean
  onStartEdit: () => void
  onCancel: () => void
  onDraftChange: (v: string) => void
  onSave: () => void
}) {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-semibold text-yellow-800">
          <StickyNoteIcon className="h-3.5 w-3.5" />
          오늘의 메모
        </span>
        {!editing && memo && (
          <button
            type="button"
            onClick={onStartEdit}
            className="text-xs text-yellow-700 hover:underline"
          >
            수정
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="오늘의 자유 메모"
            rows={3}
            className="bg-white"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                  <span className="ml-1">저장 중…</span>
                </>
              ) : (
                '저장'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
            >
              취소
            </Button>
          </div>
        </div>
      ) : memo ? (
        <p className="whitespace-pre-wrap text-sm text-zinc-800">
          {memo.content}
        </p>
      ) : (
        <button
          type="button"
          onClick={onStartEdit}
          className="text-xs text-yellow-700 hover:underline"
        >
          + 메모 추가
        </button>
      )}
    </div>
  )
}

function ScopeChip({
  event,
  teacherName,
}: {
  event: Event
  teacherName?: string
}) {
  if (event.scope === 'personal') return null
  let label: string
  if (event.scope === 'class') {
    label = `${event.grade ?? '?'}학년 ${event.class_number ?? '?'}반 공지`
  } else if (event.scope === 'grade') {
    label = `${event.grade ?? '?'}학년 공지`
  } else {
    label = '전교 공지'
  }
  const isTeacherNotice = !!teacherName
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-4 px-1.5 text-[10px]',
        isTeacherNotice
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : 'border-zinc-300 bg-white/70 text-zinc-600'
      )}
    >
      {isTeacherNotice ? `${teacherName} 선생님 공지` : label}
    </Badge>
  )
}

function ApprovalChip({ event }: { event: Event }) {
  if (event.scope === 'personal') return null
  if (event.approval_status === 'approved') return null
  const label =
    event.approval_status === 'pending' ? '승인 대기' : '반려됨'
  const cls =
    event.approval_status === 'pending'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700'
  return (
    <Badge className={`h-4 px-1.5 text-[10px] ${cls} hover:${cls}`}>
      {label}
    </Badge>
  )
}

function TimeChip({ event }: { event: Event }) {
  const p = findPeriodByValue(event.period)
  if (p) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
        <ClockIcon className="h-3 w-3" />
        {p.label}
      </span>
    )
  }
  if (event.start_time) {
    const s = event.start_time.slice(0, 5)
    const e = event.end_time?.slice(0, 5)
    return (
      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
        <ClockIcon className="h-3 w-3" />
        {e ? `${s}–${e}` : s}
      </span>
    )
  }
  return null
}

function SelectedEventItem({
  event,
  own,
  canEdit,
  completed,
  teacherName,
  onDelete,
  onEdit,
  onToggleDone,
}: {
  event: Event
  own: boolean
  canEdit: boolean
  completed: boolean
  teacherName?: string
  onDelete: () => void
  onEdit: () => void
  onToggleDone: () => void
}) {
  const meta = EVENT_TYPE_META[event.event_type]
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3',
        completed && 'opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={onToggleDone}
        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 accent-green-600"
        aria-label={completed ? '완료 취소' : '완료'}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              className={cn(
                'h-5 px-1.5 text-[10px]',
                meta.chipBg,
                meta.chipText
              )}
              variant="secondary"
            >
              {meta.label}
            </Badge>
            <span
              className={cn(
                'text-sm font-semibold text-zinc-900',
                completed && 'line-through text-zinc-500'
              )}
            >
              {event.title}
            </span>
            {event.subject && (
              <span className="text-xs text-zinc-500">· {event.subject}</span>
            )}
          </div>
          <Badge
            variant="outline"
            className="h-5 shrink-0 px-1.5 text-[10px]"
          >
            {ddayLabel(event.event_date)}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <TimeChip event={event} />
          <ScopeChip event={event} teacherName={teacherName} />
          <ApprovalChip event={event} />
        </div>
        {event.memo && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600">
            {event.memo}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label="일정 수정"
            className="text-zinc-400 hover:text-zinc-900"
          >
            <PencilIcon />
          </Button>
        )}
        {own && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label="일정 삭제"
            className="text-zinc-400 hover:text-red-600"
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
    </li>
  )
}

function EventListSection({
  type,
  events,
  currentUserId,
  isEventCompleted,
  canEditEvent,
  teacherUserIds,
  teacherNames,
  onDelete,
  onEdit,
  onToggleDone,
}: {
  type: EventType
  events: Event[]
  currentUserId?: string
  isEventCompleted: (e: Event) => boolean
  canEditEvent: (e: Event) => boolean
  teacherUserIds: Set<string>
  teacherNames: Map<string, string>
  onDelete: (id: string) => void
  onEdit: (e: Event) => void
  onToggleDone: (e: Event) => void
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
        {LIST_CATEGORY_LABELS[type]} 일정이 없어요
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <EventListItem
          key={e.id}
          event={e}
          own={e.user_id === currentUserId}
          completed={isEventCompleted(e)}
          canEdit={canEditEvent(e)}
          teacherName={
            e.scope !== 'personal' && teacherUserIds.has(e.user_id)
              ? teacherNames.get(e.user_id)
              : undefined
          }
          onDelete={() => onDelete(e.id)}
          onEdit={() => onEdit(e)}
          onToggleDone={() => onToggleDone(e)}
        />
      ))}
    </ul>
  )
}

function EventListItem({
  event,
  own,
  canEdit,
  completed,
  teacherName,
  onDelete,
  onEdit,
  onToggleDone,
}: {
  event: Event
  own: boolean
  canEdit: boolean
  completed: boolean
  teacherName?: string
  onDelete: () => void
  onEdit: () => void
  onToggleDone: () => void
}) {
  const meta = EVENT_TYPE_META[event.event_type]
  return (
    <li
      className={cn(
        'flex items-stretch gap-3 rounded-lg border p-3',
        meta.cardBg,
        meta.cardBorder,
        completed && 'opacity-60'
      )}
    >
      <div
        className={cn(
          'flex min-w-14 shrink-0 flex-col items-center justify-center rounded-lg px-2 py-2 text-sm font-bold leading-none',
          ddayColorClass(event.event_date)
        )}
      >
        {ddayLabel(event.event_date)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              'line-clamp-1 text-sm font-semibold text-zinc-900',
              completed && 'line-through text-zinc-500'
            )}
          >
            {event.title}
          </h3>
          <div className="flex shrink-0 items-center gap-0.5">
            <input
              type="checkbox"
              checked={completed}
              onChange={onToggleDone}
              className="mr-1 h-4 w-4 rounded border-zinc-300 accent-green-600"
              aria-label={completed ? '완료 취소' : '완료'}
            />
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onEdit}
                aria-label="일정 수정"
                className="text-zinc-400 hover:text-zinc-900"
              >
                <PencilIcon />
              </Button>
            )}
            {own && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onDelete}
                aria-label="일정 삭제"
                className="text-zinc-400 hover:text-red-600"
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500">
          <span>{formatFullDate(event.event_date)}</span>
          {event.subject && (
            <>
              <span>·</span>
              <span>{event.subject}</span>
            </>
          )}
          <TimeChip event={event} />
        </div>
        {event.memo && (
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-zinc-700">
            {event.memo}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <ScopeChip event={event} teacherName={teacherName} />
          <ApprovalChip event={event} />
        </div>
      </div>
    </li>
  )
}
