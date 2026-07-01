import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getGradeFromEmail } from '@/lib/grade-utils'
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
  // 학년은 학번 형식일 때만 자동 판별. 그 외에는 온보딩에서 수동으로 선택.
  const grade = isAdmin ? null : getGradeFromEmail(email)

  const { data: existingUser } = await supabase
    .from('users')
    .select('id, role, onboarded')
    .eq('id', data.user.id)
    .single()

  if (!existingUser) {
    // 새 유저:
    //  - 관리자 이메일이면 즉시 admin (onboarding 스킵)
    //  - 그 외 모든 이메일은 student로 시작. 선생님 전환은 설정 페이지에서 신청.
    await supabase.from('users').insert({
      id: data.user.id,
      email,
      name:
        data.user.user_metadata.full_name ||
        data.user.user_metadata.name ||
        email.split('@')[0],
      role: isAdmin ? 'admin' : 'student',
      grade,
      class_number: null,
      class_leader_type: null,
      class_leader_status: 'none',
      teacher_status: 'none',
      onboarded: isAdmin,
      avatar_url: data.user.user_metadata.avatar_url ?? null,
      pending_grade: null,
      pending_class_number: null,
      profile_change_status: 'none',
    })

    if (isAdmin) return NextResponse.redirect(`${origin}/admin`)
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
