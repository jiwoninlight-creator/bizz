'use client'

import { useRouter } from 'next/navigation'
import { LogOutIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function RoleBadge({
  role,
  grade,
}: {
  role: string | undefined
  grade: number | null | undefined
}) {
  if (role === 'teacher') {
    return (
      <Badge
        variant="secondary"
        className="bg-purple-100 text-purple-700 hover:bg-purple-100"
      >
        선생님
      </Badge>
    )
  }
  if (role === 'admin') {
    return (
      <Badge
        variant="secondary"
        className="bg-red-100 text-red-700 hover:bg-red-100"
      >
        관리자
      </Badge>
    )
  }
  if (role === 'student' && grade) {
    return (
      <Badge
        variant="secondary"
        className="bg-blue-100 text-blue-700 hover:bg-blue-100"
      >
        {grade}학년
      </Badge>
    )
  }
  return null
}

export default function Header() {
  const router = useRouter()
  const { user, profile } = useUser()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const displayName =
    profile?.name ??
    (typeof metadata.full_name === 'string' ? metadata.full_name : null) ??
    (typeof metadata.name === 'string' ? metadata.name : null) ??
    '사용자'
  const avatarUrl =
    profile?.avatar_url ??
    (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null) ??
    (typeof metadata.picture === 'string' ? metadata.picture : null) ??
    null
  const initial = displayName.trim().slice(0, 1) || '?'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
            <span className="text-sm font-bold text-white">B</span>
          </div>
          <span className="font-bold text-slate-900">BIZZ</span>
        </div>

        <div className="flex items-center gap-2">
          {profile ? (
            <>
              <span className="max-w-[110px] truncate text-sm font-medium text-slate-700">
                {displayName}
              </span>
              <RoleBadge role={profile.role} grade={profile.grade} />
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'rounded-full outline-none',
                'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1'
              )}
              aria-label="계정 메뉴"
            >
              <Avatar>
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-blue-100 text-sm font-semibold text-blue-700">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-slate-900">
                  {displayName}
                </span>
                {user?.email && (
                  <span className="truncate text-xs font-normal text-slate-500">
                    {user.email}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                <LogOutIcon />
                <span>로그아웃</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
