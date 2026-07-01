'use client'

import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zinc-900">
            <span className="text-xl font-bold text-white">B</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              BIZZ
            </h1>
            <p className="mt-1.5 text-sm text-zinc-500">
              학교 생활을 더 정돈되게.<br />
              선생님 · 일정 · 자료를 한 곳에서.
            </p>
          </div>
        </div>

        <div className="w-full rounded-lg border border-zinc-200 bg-white p-5">
          <Button
            onClick={handleGoogleLogin}
            className="h-11 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            학교 구글 계정으로 로그인
          </Button>
          <p className="mt-3 text-center text-xs text-zinc-500">
            학교에서 발급받은 계정만 사용할 수 있어요
          </p>
        </div>

        <p className="text-[11px] text-zinc-400">
          © {new Date().getFullYear()} BIZZ · 대전과학고 학생 개발
        </p>
      </div>
    </div>
  )
}
