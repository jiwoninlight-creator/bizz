'use client'

import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'

interface QuickShellProps {
  children: ReactNode
}

export default function QuickShell({ children }: QuickShellProps) {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center mb-8">
        <span className="text-zinc-900 font-bold text-sm">B</span>
      </div>

      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {children}
      </div>

      <button
        onClick={() => router.push('/calendar')}
        className="mt-10 bg-white text-zinc-900 rounded-full px-6 py-3 text-sm font-medium hover:bg-zinc-100 transition-colors"
      >
        BIZZ 앱 열기
      </button>
    </div>
  )
}
