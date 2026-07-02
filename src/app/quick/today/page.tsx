import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import QuickShell from '@/components/quick/QuickShell'

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function QuickTodayPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('grade, class_number')
    .eq('id', user.id)
    .single<{ grade: number | null; class_number: number | null }>()

  const todayKey = toDateKey(new Date())

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

  const { data: events } = await supabase
    .from('events')
    .select('title, subject')
    .eq('event_date', todayKey)
    .or(conds.join(','))
    .order('created_at', { ascending: true })

  const list = events ?? []

  return (
    <QuickShell>
      {list.length > 0 ? (
        <>
          <div className="text-7xl font-bold text-white tracking-tight">
            {list.length}
          </div>
          <p className="text-sm text-zinc-400 mt-2">오늘 일정</p>
          <div className="w-full border-t border-zinc-800 my-6" />
          {list.slice(0, 4).map((e, i) => (
            <div key={i} className="text-sm text-zinc-300 py-1.5">
              · {e.title}
              {e.subject ? ` · ${e.subject}` : ''}
            </div>
          ))}
          {list.length > 4 && (
            <p className="text-xs text-zinc-500 mt-2">
              외 {list.length - 4}건 더 있어요
            </p>
          )}
        </>
      ) : (
        <>
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-lg font-medium text-white">오늘은 일정이 없어요</p>
        </>
      )}
    </QuickShell>
  )
}
