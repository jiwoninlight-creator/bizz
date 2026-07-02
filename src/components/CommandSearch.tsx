'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpenIcon,
  CalendarIcon,
  FileTextIcon,
  LinkIcon,
  Loader2Icon,
  SearchIcon,
  SparklesIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import { getSubjectColor } from '@/lib/subject-colors'
import type {
  Event,
  MaterialWithTeacher,
  Teacher,
} from '@/types/database'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Results = {
  teachers: Teacher[]
  materials: MaterialWithTeacher[]
  events: Event[]
}

const EMPTY_RESULTS: Results = { teachers: [], materials: [], events: [] }

export default function CommandSearch({ open, onOpenChange }: Props) {
  const router = useRouter()
  const { user, isAdmin } = useUser()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<Results>(EMPTY_RESULTS)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setDebounced('')
    setResults(EMPTY_RESULTS)
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const runSearch = useCallback(
    async (term: string) => {
      const safe = term.replace(/[%,]/g, '')
      if (safe.length === 0) {
        setResults(EMPTY_RESULTS)
        return
      }
      setLoading(true)
      try {
        const supabase = createClient()

        // teachers
        const teachersPromise = supabase
          .from('teachers')
          .select('*')
          .or(`name.ilike.%${safe}%,subject.ilike.%${safe}%`)
          .limit(3)

        // materials (approved only)
        const materialsPromise = supabase
          .from('materials')
          .select('*, teacher:teachers(id, name)')
          .eq('status', 'approved')
          .or(`title.ilike.%${safe}%,subject.ilike.%${safe}%`)
          .order('created_at', { ascending: false })
          .limit(3)

        // events: own + approved shared containing term
        let eventsQuery = supabase
          .from('events')
          .select('*')
          .ilike('title', `%${safe}%`)
          .order('event_date', { ascending: true })
          .limit(3)
        if (!isAdmin && user?.id) {
          eventsQuery = eventsQuery.or(
            `user_id.eq.${user.id},approval_status.eq.approved`
          )
        }

        const [tRes, mRes, eRes] = await Promise.all([
          teachersPromise,
          materialsPromise,
          eventsQuery,
        ])

        setResults({
          teachers: (tRes.data ?? []) as Teacher[],
          materials: (mRes.data ?? []) as MaterialWithTeacher[],
          events: (eRes.data ?? []) as Event[],
        })
      } catch (err) {
        console.error('search failed:', err)
        setResults(EMPTY_RESULTS)
      } finally {
        setLoading(false)
      }
    },
    [user?.id, isAdmin]
  )

  useEffect(() => {
    if (!open) return
    runSearch(debounced)
  }, [debounced, open, runSearch])

  const close = () => onOpenChange(false)

  const goTeacher = (t: Teacher) => {
    router.push(`/teachers?teacher=${t.id}`)
    close()
  }

  const openMaterial = (m: MaterialWithTeacher) => {
    if (m.file_type === 'link') {
      const url = m.link_url || m.file_url
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      window.open(m.file_url, '_blank', 'noopener,noreferrer')
    }
    close()
  }

  const goEvent = (ev: Event) => {
    // Calendar page reads ?date=YYYY-MM-DD
    router.push(`/calendar?date=${ev.event_date}`)
    close()
  }

  const totalCount =
    results.teachers.length + results.materials.length + results.events.length

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/40 backdrop-blur-sm px-4 pt-[10vh] sm:pt-[14vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
          <SearchIcon className="h-4 w-4 text-zinc-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="선생님, 자료, 일정 검색…"
            className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          {loading && (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin text-zinc-400" />
          )}
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="닫기"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {debounced.length === 0 ? (
            <EmptyHint />
          ) : totalCount === 0 && !loading ? (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <SparklesIcon className="h-4 w-4 text-zinc-300" />
              <p className="text-sm text-zinc-500">
                &quot;{debounced}&quot; 결과가 없어요
              </p>
              <p className="text-[11px] text-zinc-400">
                다른 키워드로 다시 시도해보세요
              </p>
            </div>
          ) : (
            <div className="py-1">
              {results.teachers.length > 0 && (
                <Section title="선생님" count={results.teachers.length}>
                  {results.teachers.map((t) => (
                    <TeacherRow key={t.id} teacher={t} onClick={() => goTeacher(t)} />
                  ))}
                </Section>
              )}
              {results.materials.length > 0 && (
                <Section title="자료" count={results.materials.length}>
                  {results.materials.map((m) => (
                    <MaterialRow key={m.id} material={m} onClick={() => openMaterial(m)} />
                  ))}
                </Section>
              )}
              {results.events.length > 0 && (
                <Section title="일정" count={results.events.length}>
                  {results.events.map((ev) => (
                    <EventRow key={ev.id} event={ev} onClick={() => goEvent(ev)} />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/60 px-3 py-2 text-[10px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span>
              <Kbd>Esc</Kbd> 닫기
            </span>
            <span className="hidden sm:inline">
              <Kbd>Enter</Kbd> 열기
            </span>
          </div>
          <span className="text-zinc-400">BIZZ 검색</span>
        </div>
      </div>
    </div>
  )
}

function EmptyHint() {
  return (
    <div className="space-y-3 px-4 py-6 text-xs text-zinc-500">
      <div className="flex items-center gap-2">
        <SparklesIcon className="h-3.5 w-3.5 text-zinc-400" />
        <span className="font-medium text-zinc-700">뭐든 찾아보세요</span>
      </div>
      <div className="space-y-2 pl-5">
        <SearchHintRow icon={UserRoundIcon} label="선생님 이름 또는 과목" />
        <SearchHintRow icon={FileTextIcon} label="자료 제목 · 과목" />
        <SearchHintRow icon={CalendarIcon} label="일정 제목" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-[10px] text-zinc-400">
        <span>
          어디서든 <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> 로 열 수 있어요
        </span>
      </div>
    </div>
  )
}

function SearchHintRow({
  icon: Icon,
  label,
}: {
  icon: typeof UserRoundIcon
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-zinc-400" />
      <span className="text-zinc-600">{label}</span>
    </div>
  )
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="px-1 py-1.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </span>
        <span className="text-[10px] text-zinc-400">{count}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function TeacherRow({
  teacher,
  onClick,
}: {
  teacher: Teacher
  onClick: () => void
}) {
  const color = getSubjectColor(teacher.subject)
  return (
    <Row onClick={onClick}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
        {teacher.name.slice(0, 1) || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-900">
          {teacher.name} 선생님
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span
            className={cn(
              'inline-flex h-4 items-center rounded-md border px-1.5 text-[10px] font-medium',
              color.bg,
              color.text,
              color.border
            )}
          >
            {teacher.subject}
          </span>
          {teacher.office_location && (
            <span className="truncate text-zinc-500">
              {teacher.office_location}
            </span>
          )}
        </div>
      </div>
    </Row>
  )
}

function MaterialRow({
  material,
  onClick,
}: {
  material: MaterialWithTeacher
  onClick: () => void
}) {
  const color = getSubjectColor(material.subject)
  const Icon = material.file_type === 'link' ? LinkIcon : FileTextIcon
  return (
    <Row onClick={onClick}>
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
          material.file_type === 'link'
            ? 'border-blue-100 bg-blue-50 text-blue-600'
            : cn(color.bg, color.text, color.border)
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-900">
          {material.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span
            className={cn(
              'inline-flex h-4 items-center rounded-md border px-1.5 text-[10px] font-medium',
              color.bg,
              color.text,
              color.border
            )}
          >
            {material.subject}
          </span>
          {material.teacher?.name && (
            <span className="truncate">{material.teacher.name} 선생님</span>
          )}
          {material.grade && <span>· {material.grade}학년</span>}
        </div>
      </div>
    </Row>
  )
}

function EventRow({
  event,
  onClick,
}: {
  event: Event
  onClick: () => void
}) {
  const subjectLabel = event.subject ?? '일정'
  const color = event.subject
    ? getSubjectColor(event.subject)
    : getSubjectColor('기타')
  const d = new Date(event.event_date + 'T00:00:00')
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`
  return (
    <Row onClick={onClick}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50">
        <BookOpenIcon className="h-3.5 w-3.5 text-zinc-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-900">
          {event.title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span
            className={cn(
              'inline-flex h-4 items-center rounded-md border px-1.5 text-[10px] font-medium',
              color.bg,
              color.text,
              color.border
            )}
          >
            {subjectLabel}
          </span>
          <span>{dateLabel}</span>
        </div>
      </div>
    </Row>
  )
}

function Row({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-100"
    >
      {children}
    </button>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-4 items-center rounded border border-zinc-200 bg-white px-1 font-mono text-[10px] font-semibold text-zinc-600">
      {children}
    </kbd>
  )
}
