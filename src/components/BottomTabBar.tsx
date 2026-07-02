'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarIcon,
  FolderOpenIcon,
  MessageCircleIcon,
  UsersIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

const BASE_TABS: Tab[] = [
  { href: '/teachers', label: '선생님', icon: UsersIcon },
  { href: '/calendar', label: '일정', icon: CalendarIcon },
  { href: '/materials', label: '자료', icon: FolderOpenIcon },
]

const MESSAGES_TAB: Tab = {
  href: '/messages',
  label: '메시지',
  icon: MessageCircleIcon,
}

export default function BottomTabBar({
  userRole,
  teacherStatus,
}: {
  userRole: string
  teacherStatus?: string | null
}) {
  const pathname = usePathname()

  // 선생님(승인 완료) 또는 관리자에게만 메시지 탭 노출
  const showMessages =
    userRole === 'admin' ||
    (userRole === 'teacher' && teacherStatus === 'approved')

  const tabs: Tab[] = showMessages
    ? [...BASE_TABS, MESSAGES_TAB]
    : BASE_TABS

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-2xl">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-all duration-100 active:scale-[0.98]',
                isActive
                  ? 'text-zinc-900'
                  : 'text-zinc-400 hover:text-zinc-600'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isActive ? 'text-zinc-900' : 'text-zinc-400'
                )}
                strokeWidth={isActive ? 2 : 1.75}
              />
              <span
                className={cn(
                  'text-[11px]',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {tab.label}
              </span>
              <span
                className={cn(
                  'pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full transition-colors',
                  isActive ? 'bg-indigo-500' : 'bg-transparent'
                )}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
