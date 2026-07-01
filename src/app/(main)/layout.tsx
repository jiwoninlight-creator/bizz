import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import BottomTabBar from '@/components/BottomTabBar'
import Header from '@/components/Header'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      <main className="max-w-2xl mx-auto">
        {children}
      </main>
      <BottomTabBar userRole={profile?.role || 'student'} />
    </div>
  )
}