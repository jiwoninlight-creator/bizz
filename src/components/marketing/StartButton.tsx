'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightIcon } from 'lucide-react'
import TransitionLoader from '@/components/TransitionLoader'
import { cn } from '@/lib/utils'

type StartButtonProps = {
  isLoggedIn: boolean
  variant?: 'hero' | 'cta'
  className?: string
}

export default function StartButton({
  isLoggedIn,
  variant = 'hero',
  className,
}: StartButtonProps) {
  const router = useRouter()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const label = variant === 'cta' ? '지금 시작하기' : '시작하기'
  const destination = isLoggedIn ? '/calendar' : '/login'

  const handleStart = () => {
    setIsTransitioning(true)
    setTimeout(() => {
      router.push(destination)
    }, 600)
  }

  return (
    <>
      {isTransitioning && <TransitionLoader show />}
      <button
        type="button"
        onClick={handleStart}
        className={cn(
          'inline-flex items-center gap-2 rounded-full bg-white font-semibold text-zinc-900 transition-colors hover:bg-zinc-100',
          variant === 'hero'
            ? 'mt-10 px-8 py-4 text-base'
            : 'mt-8 px-10 py-4 text-base',
          className
        )}
      >
        {label}
        <ArrowRightIcon className="h-4 w-4" />
      </button>
    </>
  )
}
