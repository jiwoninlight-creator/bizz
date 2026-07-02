'use client'

import { cn } from '@/lib/utils'

export default function TransitionLoader({ show }: { show: boolean }) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-300',
        show ? 'opacity-100' : 'opacity-0'
      )}
      aria-live="polite"
      aria-busy={show}
    >
      <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-white">
        <span className="text-2xl font-bold text-zinc-900">B</span>
      </div>
      <div className="mt-8 flex gap-1.5">
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-white/60"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-white/60"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="h-2 w-2 animate-bounce rounded-full bg-white/60"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}
