'use client'

import { Toaster } from 'sonner'

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-lg shadow-zinc-900/10',
          title: 'text-sm font-medium',
          description: 'text-xs text-zinc-500',
        },
      }}
    />
  )
}
