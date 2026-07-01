import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getGradeFromEmail, isTeacherEmail } from '@/lib/grade-utils'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existingUser) {
        const email = data.user.email || ''
        const isTeacher = isTeacherEmail(email)
        const grade = isTeacher ? null : getGradeFromEmail(email)
        
        await supabase.from('users').insert({
          id: data.user.id,
          email: email,
          name: data.user.user_metadata.full_name || data.user.user_metadata.name || email.split('@')[0],
          role: isTeacher ? 'teacher' : 'student',
          grade: grade,
          avatar_url: data.user.user_metadata.avatar_url,
        })
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}