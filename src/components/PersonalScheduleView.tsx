'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarOffIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { cn, getErrorMessage } from '@/lib/utils'
import type {
  PersonalSchedule,
  PersonalScheduleCategory,
} from '@/types/database'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
const GRID_START_HOUR = 6
const GRID_END_HOUR = 24
const ROW_HEIGHT = 48
const HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i
)

const CATEGORY_META: Record<
  PersonalScheduleCategory,
  { label: string; className: string }
> = {
  academy: {
    label: '학원',
    className: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
  },
  study: {
    label: '자습',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  personal: {
    label: '개인',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  other: {
    label: '기타',
    className: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
  },
}

type FormMode = 'add' | 'edit'

type BlockLayout = {
  item: PersonalSchedule
  lane: number
  laneCount: number
  top: number
  height: number
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + (m || 0)
}

function normalizeTimeForDb(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

function normalizeTimeForInput(time: string): string {
  return time.slice(0, 5)
}

function padHour(h: number): string {
  return String(h).padStart(2, '0')
}

function layoutDayBlocks(items: PersonalSchedule[]): BlockLayout[] {
  const sorted = [...items].sort(
    (a, b) =>
      parseTimeToMinutes(a.start_time) - parseTimeToMinutes(b.start_time)
  )
  const lanes: PersonalSchedule[][] = []

  for (const item of sorted) {
    const start = parseTimeToMinutes(item.start_time)
    let placed = false
    for (const lane of lanes) {
      const last = lane[lane.length - 1]
      if (start >= parseTimeToMinutes(last.end_time)) {
        lane.push(item)
        placed = true
        break
      }
    }
    if (!placed) lanes.push([item])
  }

  const gridStartMin = GRID_START_HOUR * 60
  const results: BlockLayout[] = []

  lanes.forEach((lane, laneIdx) => {
    for (const item of lane) {
      const startMin = parseTimeToMinutes(item.start_time)
      const endMin = parseTimeToMinutes(item.end_time)
      const top = ((startMin - gridStartMin) / 60) * ROW_HEIGHT
      const height = Math.max(
        ((endMin - startMin) / 60) * ROW_HEIGHT,
        ROW_HEIGHT * 0.5
      )
      results.push({
        item,
        lane: laneIdx,
        laneCount: lanes.length,
        top,
        height,
      })
    }
  })

  return results
}

export default function PersonalScheduleView() {
  const { user } = useUser()
  const [schedules, setSchedules] = useState<PersonalSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('add')
  const [editingItem, setEditingItem] = useState<PersonalSchedule | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDays, setFormDays] = useState<Set<number>>(new Set())
  const [formStartTime, setFormStartTime] = useState('18:00')
  const [formEndTime, setFormEndTime] = useState('19:00')
  const [formCategory, setFormCategory] =
    useState<PersonalScheduleCategory>('academy')

  const fetchSchedules = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('personal_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) {
      console.error('personal_schedules fetch failed:', error)
      toast.error('시간표를 불러오지 못했어요')
    } else {
      setSchedules((data ?? []) as PersonalSchedule[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, PersonalSchedule[]>()
    for (let d = 0; d < 7; d++) map.set(d, [])
    for (const s of schedules) {
      const list = map.get(s.day_of_week) ?? []
      list.push(s)
      map.set(s.day_of_week, list)
    }
    return map
  }, [schedules])

  const layoutsByDay = useMemo(() => {
    const map = new Map<number, BlockLayout[]>()
    for (let d = 0; d < 7; d++) {
      map.set(d, layoutDayBlocks(schedulesByDay.get(d) ?? []))
    }
    return map
  }, [schedulesByDay])

  const resetForm = () => {
    setFormTitle('')
    setFormDays(new Set())
    setFormStartTime('18:00')
    setFormEndTime('19:00')
    setFormCategory('academy')
    setEditingItem(null)
    setFormMode('add')
  }

  const openAddSheet = (day?: number, hour?: number) => {
    resetForm()
    setFormMode('add')
    if (day != null) {
      setFormDays(new Set([day]))
    }
    if (hour != null) {
      setFormStartTime(`${padHour(hour)}:00`)
      const endHour = Math.min(hour + 1, 23)
      setFormEndTime(
        hour === 23 ? '23:59' : `${padHour(endHour)}:00`
      )
    }
    setSheetOpen(true)
  }

  const openEditSheet = (item: PersonalSchedule) => {
    setFormMode('edit')
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDays(new Set([item.day_of_week]))
    setFormStartTime(normalizeTimeForInput(item.start_time))
    setFormEndTime(normalizeTimeForInput(item.end_time))
    setFormCategory(item.category)
    setSheetOpen(true)
  }

  const toggleFormDay = (day: number) => {
    setFormDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!formTitle.trim()) {
      toast.error('제목을 입력해주세요')
      return
    }
    if (formDays.size === 0) {
      toast.error('요일을 하나 이상 선택해주세요')
      return
    }
    if (parseTimeToMinutes(formEndTime) <= parseTimeToMinutes(formStartTime)) {
      toast.error('종료 시간은 시작 시간보다 늦어야 해요')
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const payload = {
      title: formTitle.trim(),
      start_time: normalizeTimeForDb(formStartTime),
      end_time: normalizeTimeForDb(formEndTime),
      category: formCategory,
    }

    if (formMode === 'edit' && editingItem) {
      const day = Array.from(formDays)[0] ?? editingItem.day_of_week
      const optimistic: PersonalSchedule = {
        ...editingItem,
        ...payload,
        day_of_week: day,
      }
      const prev = schedules
      setSchedules((s) =>
        s.map((row) => (row.id === editingItem.id ? optimistic : row))
      )
      setSheetOpen(false)

      try {
        const { error } = await supabase
          .from('personal_schedules')
          .update({ ...payload, day_of_week: day })
          .eq('id', editingItem.id)
          .eq('user_id', user.id)
        if (error) throw error
        toast.success('시간표를 수정했어요')
      } catch (err) {
        setSchedules(prev)
        toast.error(`수정 실패: ${getErrorMessage(err)}`)
      } finally {
        setSubmitting(false)
      }
      return
    }

    const tempIds = Array.from(formDays).map(() => crypto.randomUUID())
    const optimisticRows: PersonalSchedule[] = Array.from(formDays).map(
      (day, i) => ({
        id: tempIds[i],
        user_id: user.id,
        day_of_week: day,
        ...payload,
        created_at: new Date().toISOString(),
      })
    )
    const prev = schedules
    setSchedules((s) => [...s, ...optimisticRows])
    setSheetOpen(false)

    try {
      const rows = Array.from(formDays).map((day) => ({
        user_id: user.id,
        day_of_week: day,
        ...payload,
      }))
      const { data, error } = await supabase
        .from('personal_schedules')
        .insert(rows)
        .select('*')
      if (error) throw error
      const inserted = (data ?? []) as PersonalSchedule[]
      setSchedules((s) => {
        const withoutTemp = s.filter((row) => !tempIds.includes(row.id))
        return [...withoutTemp, ...inserted]
      })
      toast.success('시간표에 추가했어요')
    } catch (err) {
      setSchedules(prev)
      toast.error(`추가 실패: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!user || !editingItem) return
    if (!confirm(`"${editingItem.title}" 일정을 삭제할까요?`)) return

    const prev = schedules
    setSchedules((s) => s.filter((row) => row.id !== editingItem.id))
    setSheetOpen(false)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('personal_schedules')
        .delete()
        .eq('id', editingItem.id)
        .eq('user_id', user.id)
      if (error) throw error
      toast.success('삭제했어요')
    } catch (err) {
      setSchedules(prev)
      toast.error(`삭제 실패: ${getErrorMessage(err)}`)
    }
  }

  const gridBodyHeight = HOURS.length * ROW_HEIGHT
  const isEmpty = !loading && schedules.length === 0

  return (
    <div className="relative space-y-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] border-b border-zinc-200 bg-zinc-50/60">
            <div aria-hidden className="border-r border-zinc-200" />
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  'py-2 text-center text-[10px] font-semibold tracking-widest',
                  i === 0 && 'text-red-400',
                  i === 6 && 'text-indigo-400',
                  i !== 0 && i !== 6 && 'text-zinc-400'
                )}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))]"
              style={{ gridTemplateRows: `repeat(${HOURS.length}, ${ROW_HEIGHT}px)` }}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="contents">
                  <div className="flex items-start justify-end border-r border-zinc-100 bg-zinc-50/40 px-1 pt-1 text-[10px] tabular-nums text-zinc-400">
                    {padHour(hour)}:00
                  </div>
                  {WEEKDAY_LABELS.map((_, dayIndex) => (
                    <button
                      key={`${dayIndex}-${hour}`}
                      type="button"
                      onClick={() => openAddSheet(dayIndex, hour)}
                      className="h-12 border-b border-r border-zinc-100 transition-colors hover:bg-zinc-50/80"
                      aria-label={`${WEEKDAY_LABELS[dayIndex]} ${padHour(hour)}:00 일정 추가`}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div
              className="pointer-events-none absolute inset-0 grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))]"
              style={{ height: gridBodyHeight }}
            >
              <div />
              {WEEKDAY_LABELS.map((_, dayIndex) => (
                <div key={dayIndex} className="relative">
                  {(layoutsByDay.get(dayIndex) ?? []).map(
                    ({ item, lane, laneCount, top, height }) => {
                      const meta = CATEGORY_META[item.category]
                      const widthPct = 100 / laneCount
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openEditSheet(item)}
                          style={{
                            top,
                            height,
                            left: `${lane * widthPct}%`,
                            width: `${widthPct}%`,
                          }}
                          className={cn(
                            'pointer-events-auto absolute z-10 mx-0.5 overflow-hidden rounded-md px-1 py-0.5 text-left transition-transform active:scale-[0.98]',
                            meta.className
                          )}
                        >
                          <span className="block truncate text-[11px] font-medium">
                            {item.title}
                          </span>
                        </button>
                      )
                    }
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-6">
          <Loader2Icon className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      )}

      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <div className="pointer-events-auto max-w-sm rounded-lg border border-zinc-200 bg-white/95 p-2 shadow-sm backdrop-blur">
            <EmptyState
              icon={CalendarOffIcon}
              title="아직 등록된 일정이 없어요"
              description="학원, 자습 등 개인 일정을 등록해보세요"
              compact
              action={{
                label: '일정 추가',
                onClick: () => openAddSheet(),
                icon: PlusIcon,
              }}
            />
          </div>
        </div>
      )}

      <Button
        onClick={() => openAddSheet()}
        size="lg"
        className="fixed bottom-20 right-4 z-40 h-12 rounded-lg border border-zinc-900 bg-zinc-900 px-4 text-white shadow-lg shadow-zinc-900/20 hover:bg-zinc-800"
      >
        <PlusIcon className="h-5 w-5" />
        <span className="ml-1 text-sm font-semibold">일정 추가</span>
      </Button>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) resetForm()
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>
              {formMode === 'add' ? '개인 일정 추가' : '개인 일정 수정'}
            </SheetTitle>
            <SheetDescription>
              학원·자습·개인 시간 등 주간 반복 일정을 등록해요.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ps-title">제목</Label>
              <Input
                id="ps-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="예: 영어 학원, 자습"
              />
            </div>

            <div className="space-y-2">
              <Label>요일</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, dayIndex) => {
                  const checked = formDays.has(dayIndex)
                  return (
                    <label
                      key={label}
                      className={cn(
                        'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                        checked
                          ? 'border-zinc-900 bg-zinc-900 text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => {
                          if (formMode === 'edit') {
                            setFormDays(new Set([dayIndex]))
                          } else {
                            toggleFormDay(dayIndex)
                          }
                        }}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
              {formMode === 'add' && (
                <p className="text-[11px] text-zinc-400">
                  여러 요일을 선택하면 각 요일에 동일한 일정이 등록돼요.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ps-start">시작</Label>
                <Input
                  id="ps-start"
                  type="time"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ps-end">종료</Label>
                <Input
                  id="ps-end"
                  type="time"
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ps-category">카테고리</Label>
              <Select
                value={formCategory}
                onValueChange={(v) =>
                  setFormCategory(v as PersonalScheduleCategory)
                }
              >
                <SelectTrigger id="ps-category" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_META) as PersonalScheduleCategory[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORY_META[key].label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <SheetFooter className="flex-row gap-2 sm:justify-between">
              {formMode === 'edit' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => void handleDelete()}
                >
                  <Trash2Icon className="h-4 w-4" />
                  삭제
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    저장 중…
                  </>
                ) : (
                  '저장'
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
