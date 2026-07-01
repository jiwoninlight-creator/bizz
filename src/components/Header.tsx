'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOutIcon, SettingsIcon, ShieldIcon } from 'lucide-react'
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
import type { User } from '@/types/database'

function GradeClassBadge({ profile }: { profile: User }) {
  if (profile.role === 'teacher') {
    return (
      <Badge
        variant="secondary"
        className="bg-purple-100 text-purple-700 hover:bg-purple-100"
      >
        선생님
      </Badge>
    )
  }
  if (profile.role === 'admin') {
    return (
      <Badge
        variant="secondary"
        className="bg-red-100 text-red-700 hover:bg-red-100"
      >
        관리자
      </Badge>
    )
  }
  if (!profile.grade) return null
  const label = profile.class_number
    ? `${profile.grade}학년 ${profile.class_number}반`
    : `${profile.grade}학년`
  return (
    <Badge
      variant="secondary"
      className="bg-blue-100 text-blue-700 hover:bg-blue-100"
    >
      {label}
    </Badge>
  )
}

function LeaderBadge({ profile }: { profile: User }) {
  if (profile.role !== 'class_leader') return null
  if (profile.class_leader_status !== 'approved') return null
  const label = profile.class_leader_type === 'vice_leader' ? '부반장' : '반장'
  return (
    <Badge
      variant="secondary"
      className="bg-amber-100 text-amber-700 hover:bg-amber-100"
    >
      {label}
    </Badge>
  )
}

export default function Header() {
  const router = useRouter()
  const { user, profile, isAdmin } = useUser()

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
        <Link href="/calendar" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
            <span className="text-sm font-bold text-white">B</span>
          </div>
          <span className="font-bold text-slate-900">BIZZ</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {profile ? (
            <>
              <span className="hidden max-w-[110px] truncate text-sm font-medium text-slate-700 sm:inline">
                {displayName}
              </span>
              <GradeClassBadge profile={profile} />
              <LeaderBadge profile={profile} />
            </>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'ml-1 rounded-full outline-none',
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
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-1.5">
                  <SettingsIcon />
                  <span>설정</span>
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-1.5">
                    <ShieldIcon />
                    <span>관리자 페이지</span>
                  </Link>
                </DropdownMenuItem>
              )}
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
