import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getGradeFromEmail, isTeacherEmail } from '@/lib/grade-utils'
import { isAdminEmail } from '@/lib/admin-config'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const email = (data.user.email ?? '').toLowerCase()
  const isAdmin = isAdminEmail(email)
  const isTeacher = !isAdmin && isTeacherEmail(email)
  const grade = isAdmin || isTeacher ? null : getGradeFromEmail(email)

  const { data: existingUser } = await supabase
    .from('users')
    .select('id, role, onboarded')
    .eq('id', data.user.id)
    .single()

  if (!existingUser) {
    const role = isAdmin ? 'admin' : isTeacher ? 'teacher' : 'student'
    const onboarded = isAdmin || isTeacher
    await supabase.from('users').insert({
      id: data.user.id,
      email,
      name:
        data.user.user_metadata.full_name ||
        data.user.user_metadata.name ||
        email.split('@')[0],
      role,
      grade,
      class_number: null,
      class_leader_type: null,
      class_leader_status: 'none',
      onboarded,
      avatar_url: data.user.user_metadata.avatar_url ?? null,
    })

    if (isAdmin) return NextResponse.redirect(`${origin}/admin`)
    if (isTeacher) return NextResponse.redirect(`${origin}/calendar`)
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  if (existingUser.role === 'admin') {
    return NextResponse.redirect(`${origin}/admin`)
  }
  if (!existingUser.onboarded) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }
  return NextResponse.redirect(`${origin}/calendar`)
}
