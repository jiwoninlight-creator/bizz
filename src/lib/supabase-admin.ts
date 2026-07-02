import { createClient } from '@supabase/supabase-js'

// 서버(API route) 전용. 클라이언트 컴포넌트에서 import하지 마세요.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
