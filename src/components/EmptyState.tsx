'use client'

import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type EmptyStateAction = {
  label: string
  onClick: () => void
  icon?: LucideIcon
}

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: EmptyStateAction
  className?: string
  /** 얇은 세로 여백. Default: py-12 */
  compact?: boolean
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8' : 'py-12',
        className
      )}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-zinc-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="mt-4 h-8 border border-zinc-200 bg-white text-xs text-zinc-700 hover:bg-zinc-50"
          variant="outline"
        >
          {action.icon && <action.icon className="h-3.5 w-3.5" />}
          <span className={action.icon ? 'ml-1.5' : ''}>{action.label}</span>
        </Button>
      )}
    </div>
  )
}
