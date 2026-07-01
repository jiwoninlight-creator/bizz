import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Best-effort extraction of a human-readable message from any thrown value.
 * Handles native Error, Supabase PostgrestError (which has `.message` but is
 * not an Error instance), plain objects, and unknowns.
 */
export function getErrorMessage(err: unknown): string {
  if (!err) return '알 수 없는 오류'
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as Record<string, unknown>
    if (typeof anyErr.message === 'string') {
      const details = typeof anyErr.details === 'string' ? anyErr.details : ''
      const hint = typeof anyErr.hint === 'string' ? anyErr.hint : ''
      const extras = [details, hint].filter(Boolean).join(' · ')
      return extras ? `${anyErr.message} (${extras})` : anyErr.message
    }
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}
