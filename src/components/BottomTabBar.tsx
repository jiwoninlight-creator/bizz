'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarIcon, FolderOpenIcon, UsersIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

const TABS: Tab[] = [
  { href: '/teachers', label: '선생님', icon: UsersIcon },
  { href: '/calendar', label: '일정', icon: CalendarIcon },
  { href: '/materials', label: '자료', icon: FolderOpenIcon },
]

export default function BottomTabBar({ userRole }: { userRole: string }) {
  void userRole
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors',
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
