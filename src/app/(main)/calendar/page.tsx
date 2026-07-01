'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import type { Event, EventType } from '@/types/database'
import { cn } from '@/lib/utils'
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
    dot: 'bg-blue-500',
    chipBg: 'bg-blue-50',
    chipText: 'text-blue-700',
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-200',
  },
  exam: {
    label: '시험',
    dot: 'bg-red-500',
    chipBg: 'bg-red-50',
    chipText: 'text-red-700',
    cardBg: 'bg-red-50',
    cardBorder: 'border-red-200',
  },
  personal: {
    label: '개인',
    dot: 'bg-green-500',
    chipBg: 'bg-green-50',
    chipText: 'text-green-700',
    cardBg: 'bg-green-50',
    cardBorder: 'border-green-200',
  },
}

const EVENT_TYPE_ORDER: EventType[] = ['assignment', 'exam', 'personal']

const LIST_CATEGORY_LABELS: Record<EventType, string> = {
  assignment: '과제',
  exam: '수행평가',
  personal: '개인',
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
  if (diff < 0) return 'bg-slate-400 text-white'
  if (diff === 0) return 'bg-red-500 text-white'
  if (diff <= 3) return 'bg-orange-500 text-white'
  if (diff <= 7) return 'bg-yellow-500 text-white'
  return 'bg-blue-500 text-white'
}

function formatSelectedDate(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

function formatFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${m}월 ${d}일 (${WEEKDAYS[date.getDay()]})`
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

function EventListItem({
  event,
  own,
  onDelete,
}: {
  event: Event
  own: boolean
  onDelete: () => void
}) {
  const meta = EVENT_TYPE_META[event.event_type]
  return (
    <li
      className={cn(
        'flex items-stretch gap-3 rounded-lg border p-3',
        meta.cardBg,
        meta.cardBorder
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
          <h3 className="line-clamp-1 text-sm font-semibold text-slate-900">
            {event.title}
          </h3>
          {own && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onDelete}
              aria-label="일정 삭제"
              className="shrink-0 text-slate-400 hover:text-red-600"
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
          <span>{formatFullDate(event.event_date)}</span>
          {event.subject && (
            <>
              <span>·</span>
              <span>{event.subject}</span>
            </>
          )}
        </div>
        {event.memo && (
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-700">
            {event.memo}
          </p>
        )}
        {event.grade != null && (
          <Badge
            variant="outline"
            className="mt-1.5 h-4 border-slate-300 bg-white/70 px-1.5 text-[10px] text-slate-600"
          >
            {event.grade}학년 공유
          </Badge>
        )}
      </div>
    </li>
  )
}

function EventListSection({
  type,
  events,
  currentUserId,
  onDelete,
}: {
  type: EventType
  events: Event[]
  currentUserId?: string
  onDelete: (id: string) => void
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
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
          onDelete={() => onDelete(e.id)}
        />
      ))}
    </ul>
  )
}

export default function CalendarPage() {
  const { user, profile, loading: userLoading } = useUser()

  const [view, setView] = useState<ViewMode>('calendar')
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfDay(new Date())
  )
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [listCategory, setListCategory] = useState<EventType>('assignment')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formSubject, setFormSubject] = useState('')
  const [formDate, setFormDate] = useState<string>(toDateKey(new Date()))
  const [formType, setFormType] = useState<EventType>('assignment')
  const [formMemo, setFormMemo] = useState('')
  const [formShare, setFormShare] = useState(false)

  const gridDays = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth])
  const gridStart = gridDays[0]
  const gridEnd = gridDays[gridDays.length - 1]

  const fetchEvents = useCallback(async () => {
    if (userLoading || !user) return
    setLoading(true)

    const supabase = createClient()
    let query = supabase
      .from('events')
      .select('*')
      .gte('event_date', toDateKey(gridStart))
      .lte('event_date', toDateKey(gridEnd))
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (profile?.grade) {
      query = query.or(`user_id.eq.${user.id},grade.eq.${profile.grade}`)
    } else {
      query = query.eq('user_id', user.id)
    }

    const { data, error } = await query
    if (error) {
      console.error('Failed to load events:', error)
      setEvents([])
    } else {
      setEvents((data ?? []) as Event[])
    }
    setLoading(false)
  }, [gridStart, gridEnd, user, profile?.grade, userLoading])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>()
    for (const e of events) {
      const key = e.event_date
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [events])

  const monthEvents = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    return events.filter((e) => {
      const [y, m] = e.event_date.split('-').map(Number)
      return y === year && m - 1 === month
    })
  }, [events, currentMonth])

  const monthEventsByType = useMemo(() => {
    const groups: Record<EventType, Event[]> = {
      assignment: [],
      exam: [],
      personal: [],
    }
    for (const e of monthEvents) groups[e.event_type].push(e)
    return groups
  }, [monthEvents])

  const sortedByCategory = useMemo(
    () => ({
      assignment: sortByDday(monthEventsByType.assignment),
      exam: sortByDday(monthEventsByType.exam),
      personal: sortByDday(monthEventsByType.personal),
    }),
    [monthEventsByType]
  )

  const selectedDateKey = toDateKey(selectedDate)
  const selectedEvents = eventsByDate.get(selectedDateKey) ?? []

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

  const openDialog = () => {
    setFormTitle('')
    setFormSubject('')
    setFormDate(toDateKey(selectedDate))
    setFormType('assignment')
    setFormMemo('')
    setFormShare(false)
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('events').insert({
        user_id: user.id,
        title: formTitle.trim(),
        subject: formSubject.trim() || null,
        event_date: formDate,
        event_type: formType,
        memo: formMemo.trim() || null,
        grade: formShare && profile?.grade ? profile.grade : null,
      })
      if (error) throw error

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
      await fetchEvents()
    } catch (err) {
      console.error('Insert event failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      alert(`일정 추가에 실패했습니다: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('이 일정을 삭제할까요?')) return
    const supabase = createClient()
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) {
      alert(`삭제 실패: ${error.message}`)
      return
    }
    await fetchEvents()
  }

  const canSubmit =
    formTitle.trim().length > 0 && formDate.length > 0 && !submitting

  const today = useMemo(() => startOfDay(new Date()), [])
  const monthTitle = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`

  return (
    <div className="p-4 space-y-4">
      <div className="flex w-full rounded-lg bg-slate-100 p-1">
        {(['calendar', 'list'] as const).map((v) => {
          const active = view === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
              aria-pressed={active}
            >
              <span className="text-base leading-none">
                {v === 'calendar' ? '📅' : '📋'}
              </span>
              <span>{v === 'calendar' ? '캘린더' : '목록'}</span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={goPrev} aria-label="이전 달">
          <ChevronLeftIcon />
        </Button>
        <button
          type="button"
          onClick={goToday}
          className="flex flex-col items-center leading-tight"
        >
          <h1 className="text-lg font-bold text-slate-900">{monthTitle}</h1>
          <span className="text-[10px] text-slate-400">오늘로 이동</span>
        </button>
        <Button variant="ghost" size="icon" onClick={goNext} aria-label="다음 달">
          <ChevronRightIcon />
        </Button>
      </div>

      {view === 'calendar' ? (
        <>
          <div>
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={cn(
                    'text-center text-[11px] font-medium py-1',
                    i === 0 && 'text-red-500',
                    i === 6 && 'text-blue-500',
                    i !== 0 && i !== 6 && 'text-slate-500'
                  )}
                >
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {gridDays.map((d) => {
                const key = toDateKey(d)
                const inMonth = d.getMonth() === currentMonth.getMonth()
                const isToday = isSameDay(d, today)
                const isSelected = isSameDay(d, selectedDate)
                const dayEvents = eventsByDate.get(key) ?? []
                const typesInDay = new Set(dayEvents.map((e) => e.event_type))
                const dayOfWeek = d.getDay()

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(startOfDay(d))}
                    className={cn(
                      'relative aspect-square flex flex-col items-center justify-start rounded-lg p-1 text-sm transition-colors',
                      'hover:bg-slate-100',
                      isSelected && 'bg-blue-100 hover:bg-blue-100',
                      isToday && 'ring-2 ring-blue-500 ring-inset',
                      !inMonth && 'text-slate-300',
                      inMonth && dayOfWeek === 0 && 'text-red-500',
                      inMonth && dayOfWeek === 6 && 'text-blue-500',
                      inMonth &&
                        dayOfWeek !== 0 &&
                        dayOfWeek !== 6 &&
                        'text-slate-800',
                      isSelected && 'font-semibold text-blue-900'
                    )}
                  >
                    <span className="mt-0.5">{d.getDate()}</span>
                    <div className="mt-auto mb-0.5 flex h-1.5 items-center gap-0.5">
                      {EVENT_TYPE_ORDER.map((t) =>
                        typesInDay.has(t) ? (
                          <span
                            key={t}
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">
                {formatSelectedDate(selectedDate)}
              </h2>
              <span className="text-xs text-slate-400">
                {selectedEvents.length > 0 ? `${selectedEvents.length}개` : ''}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                <span className="text-sm">불러오는 중…</span>
              </div>
            ) : selectedEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
                이 날짜에는 일정이 없습니다
              </div>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((ev) => {
                  const meta = EVENT_TYPE_META[ev.event_type]
                  const own = ev.user_id === user?.id
                  return (
                    <li
                      key={ev.id}
                      className="flex items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-slate-200"
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                          meta.dot
                        )}
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
                            <span className="text-sm font-semibold text-slate-900">
                              {ev.title}
                            </span>
                            {ev.subject && (
                              <span className="text-xs text-slate-500">
                                · {ev.subject}
                              </span>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className="h-5 shrink-0 px-1.5 text-[10px]"
                          >
                            {ddayLabel(ev.event_date)}
                          </Badge>
                        </div>
                        {ev.memo && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                            {ev.memo}
                          </p>
                        )}
                        {ev.grade != null && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {ev.grade}학년 공유
                          </p>
                        )}
                      </div>
                      {own && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDelete(ev.id)}
                          aria-label="일정 삭제"
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-slate-800">
              {monthTitle}
            </span>
            <span className="text-xs text-slate-500">
              총 {monthEvents.length}개
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">불러오는 중…</span>
            </div>
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
                      <span className="text-xs text-slate-500">
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
                    onDelete={handleDelete}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}

      <Button
        onClick={openDialog}
        size="lg"
        className="fixed bottom-24 right-4 z-40 h-14 rounded-full px-5 shadow-lg"
      >
        <PlusIcon className="h-5 w-5" />
        <span className="ml-1 text-sm font-semibold">일정 추가</span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>일정 추가</DialogTitle>
            <DialogDescription>
              나만 볼 일정이거나, 학년 전체에 공유할 수 있어요.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-title">제목</Label>
              <Input
                id="event-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="예: 수학 수행평가"
                required
              />
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
                onValueChange={(v) => setFormType(v as EventType)}
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
              <Label htmlFor="event-memo">메모</Label>
              <Textarea
                id="event-memo"
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="세부 내용 (선택)"
                rows={3}
              />
            </div>

            {profile?.grade ? (
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formShare}
                  onChange={(e) => setFormShare(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                <span>
                  <strong className="font-semibold">{profile.grade}학년</strong> 전체에
                  공유
                </span>
              </label>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
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
                ) : (
                  '저장'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
