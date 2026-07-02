'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ClockIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
} from 'lucide-react'
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
import CommandSearch from '@/components/CommandSearch'
import type { Teacher, TeacherStatus, User } from '@/types/database'

const STATUS_DOT: Record<TeacherStatus, string> = {
  available: 'bg-emerald-500',
  in_class: 'bg-amber-500',
  meeting: 'bg-red-500',
  out: 'bg-red-500',
  unknown: 'bg-zinc-300',
}

const CHIP_BASE =
  'inline-flex h-5 items-center rounded-md border px-1.5 text-[11px] font-medium tracking-tight'

function GradeClassBadge({ profile }: { profile: User }) {
  if (profile.role === 'admin') {
    return (
      <span className={cn(CHIP_BASE, 'border-zinc-900 bg-zinc-900 text-white')}>
        관리자
      </span>
    )
  }
  if (profile.role === 'teacher') {
    if (profile.teacher_status === 'pending') {
      return (
        <span
          className={cn(
            CHIP_BASE,
            'border-amber-200 bg-amber-50 text-amber-700'
          )}
        >
          선생님 승인 대기
        </span>
      )
    }
    return (
      <span
        className={cn(
          CHIP_BASE,
          'border-indigo-200 bg-indigo-50 text-indigo-700'
        )}
      >
        선생님
      </span>
    )
  }
  if (!profile.grade) return null
  const label = profile.class_number
    ? `${profile.grade}학년 ${profile.class_number}반`
    : `${profile.grade}학년`
  return (
    <span className={cn(CHIP_BASE, 'border-zinc-200 bg-zinc-100 text-zinc-700')}>
      {label}
    </span>
  )
}

function LeaderBadge({ profile }: { profile: User }) {
  if (profile.role !== 'class_leader') return null
  if (profile.class_leader_status !== 'approved') return null
  const label = profile.class_leader_type === 'vice_leader' ? '부반장' : '반장'
  return (
    <span className={cn(CHIP_BASE, 'border-amber-200 bg-amber-50 text-amber-700')}>
      {label}
    </span>
  )
}

function TeacherMetaBadges({ teacher }: { teacher: Teacher }) {
  return (
    <>
      <span
        className={cn(CHIP_BASE, 'border-zinc-200 bg-zinc-100 text-zinc-700')}
      >
        {teacher.subject}
      </span>
      <span
        className={cn(
          'inline-block h-2 w-2 rounded-full ring-2 ring-white',
          STATUS_DOT[teacher.current_status] ?? STATUS_DOT.unknown
        )}
        title={teacher.current_status}
      />
    </>
  )
}

export default function Header() {
  const router = useRouter()
  const { user, profile, isAdmin, isTeacher } = useUser()
  const [myTeacher, setMyTeacher] = useState<Teacher | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (!isTeacher || !user?.id) {
      setMyTeacher(null)
      return
    }
    const supabase = createClient()
    supabase
      .from('teachers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle<Teacher>()
      .then(({ data }) => setMyTeacher(data ?? null))
  }, [isTeacher, user?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K opens the command search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
        <Link href="/calendar" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-900">
            <span className="text-sm font-bold text-white">B</span>
          </div>
          <span className="text-[15px] font-bold tracking-tight text-zinc-900">
            BIZZ
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          {profile ? (
            <>
              <span className="hidden max-w-[110px] truncate text-sm font-medium text-zinc-800 sm:inline">
                {displayName}
              </span>
              <GradeClassBadge profile={profile} />
              <LeaderBadge profile={profile} />
              {isTeacher && myTeacher && (
                <TeacherMetaBadges teacher={myTeacher} />
              )}
            </>
          ) : null}

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'ml-1 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 outline-none transition-colors hover:bg-zinc-50 hover:text-zinc-800',
              'focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2'
            )}
            aria-label="검색"
            title="검색 (Ctrl+K)"
          >
            <SearchIcon className="h-3.5 w-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'ml-1 rounded-full outline-none',
                'focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2'
              )}
              aria-label="계정 메뉴"
            >
              <Avatar className="h-8 w-8 ring-1 ring-zinc-200">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-zinc-100 text-sm font-semibold text-zinc-700">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-900">
                  {displayName}
                </span>
                {user?.email && (
                  <span className="truncate text-xs font-normal text-zinc-500">
                    {user.email}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {profile?.teacher_status === 'pending' && (
                <DropdownMenuItem disabled className="text-amber-700">
                  <ClockIcon />
                  <span>선생님 승인 대기 중</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-1.5">
                  <SettingsIcon />
                  <span>설정</span>
                  {isTeacher && myTeacher && (
                    <span
                      className={cn(
                        'ml-auto inline-block h-2 w-2 rounded-full',
                        STATUS_DOT[myTeacher.current_status]
                      )}
                    />
                  )}
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

      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
