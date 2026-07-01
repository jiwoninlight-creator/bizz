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
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900">
              <span className="text-sm font-bold text-white">A</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-bold tracking-tight text-zinc-900">
                Admin
              </span>
              {profile?.name && (
                <span className="text-[10px] font-medium text-zinc-500">
                  {profile.name}
                </span>
              )}
            </div>
          </div>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <LogOutIcon className="h-3.5 w-3.5" />
            <span>일반 화면</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl">{children}</main>
    </div>
  )
}
