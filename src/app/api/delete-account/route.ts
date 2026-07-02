import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

function extractStoragePath(url: string): string | null {
  try {
    const marker = '/object/public/materials/'
    const idx = url.indexOf(marker)
    if (idx < 0) return null
    return decodeURIComponent(url.slice(idx + marker.length))
  } catch {
    return null
  }
}

export async function POST() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    return NextResponse.json(
      { error: '서버 설정 오류로 계정을 삭제할 수 없어요' },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const userId = user.id
  const admin = createAdminClient()

  try {
    const { data: teacher } = await admin
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>()

    if (teacher?.id) {
      const { error: scheduleError } = await admin
        .from('teacher_schedules')
        .delete()
        .eq('teacher_id', teacher.id)
      if (scheduleError) throw scheduleError
    }

    const deletions = await Promise.all([
      admin.from('teachers').delete().eq('user_id', userId),
      admin
        .from('messages')
        .delete()
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      admin.from('event_completions').delete().eq('user_id', userId),
      admin.from('daily_memos').delete().eq('user_id', userId),
      admin.from('events').delete().eq('user_id', userId),
    ])

    for (const { error } of deletions) {
      if (error) throw error
    }

    const { data: myMaterials, error: materialsSelectError } = await admin
      .from('materials')
      .select('file_url, file_type')
      .eq('uploaded_by', userId)

    if (materialsSelectError) throw materialsSelectError

    const storagePaths = (myMaterials ?? [])
      .filter((m) => m.file_type !== 'link')
      .map((m) => extractStoragePath(m.file_url))
      .filter((path): path is string => Boolean(path))

    const { error: materialsDeleteError } = await admin
      .from('materials')
      .delete()
      .eq('uploaded_by', userId)

    if (materialsDeleteError) throw materialsDeleteError

    if (storagePaths.length > 0) {
      try {
        await admin.storage.from('materials').remove(storagePaths)
      } catch (storageErr) {
        console.error('Storage cleanup failed:', storageErr)
      }
    }

    const { error: userDeleteError } = await admin
      .from('users')
      .delete()
      .eq('id', userId)

    if (userDeleteError) throw userDeleteError

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Auth user deletion failed:', deleteError)
      return NextResponse.json(
        { error: '계정 삭제 중 오류가 발생했어요' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Account deletion failed:', err)
    return NextResponse.json(
      { error: '계정 삭제 중 오류가 발생했어요' },
      { status: 500 }
    )
  }
}
