'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomTabBar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  
  const tabs = [
    { href: '/teachers', label: '선생님', icon: '👩‍🏫' },
    { href: '/calendar', label: '일정', icon: '📅' },
    { href: '/materials', label: '자료', icon: '📚' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg">
      <div className="max-w-2xl mx-auto flex justify-around">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center py-3 px-6 flex-1 transition-colors ${
                isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="text-2xl mb-1">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}