import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOutIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, name')
    .eq('id', user.id)
    .single<{ role: string; name: string }>()

  if (profile?.role !== 'admin') redirect('/calendar')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <span className="font-bold text-slate-900">관리자 페이지</span>
            <span className="text-xs text-slate-500">
              {profile?.name ? `· ${profile.name}` : ''}
            </span>
          </div>
          <Link
            href="/calendar"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOutIcon className="h-4 w-4" />
            <span>일반 화면으로</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl">{children}</main>
    </div>
  )
}
