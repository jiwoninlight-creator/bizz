'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BellIcon,
  CheckCircle2Icon,
  MegaphoneIcon,
  MessageCircleIcon,
  XCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'
import { formatRelativeTime } from '@/lib/format-time'
import { useUser } from '@/hooks/useUser'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Message } from '@/types/database'

type NotificationItem = {
  id: string
  category: 'message' | 'notice' | 'approval'
  title: string
  description: string
  createdAt: string
  isRead: boolean
  link: string
  /** messages 테이블 row id (읽음 처리용) */
  messageId?: string
}

type FilterKey = 'all' | 'message' | 'notice'

const BELL_BUTTON_CLASS = cn(
  'relative ml-1 flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 outline-none transition-colors hover:bg-zinc-50 hover:text-zinc-800',
  'focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2'
)

const SEGMENT_BASE =
  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors'

function getLastSeenKey(userId: string) {
  return `notif_seen_${userId}`
}

function getDefaultLastSeen(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

function readLastSeen(userId: string): string {
  if (typeof window === 'undefined') return getDefaultLastSeen()
  const stored = localStorage.getItem(getLastSeenKey(userId))
  return stored ?? getDefaultLastSeen()
}

function writeLastSeen(userId: string, iso: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(getLastSeenKey(userId), iso)
}

function formatBadge(count: number): string {
  if (count > 9) return '9+'
  return String(count)
}

function CategoryIcon({
  category,
  title,
}: {
  category: NotificationItem['category']
  title: string
}) {
  if (category === 'message') {
    return (
      <MessageCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
    )
  }
  if (category === 'notice') {
    return <MegaphoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
  }
  const rejected =
    title.includes('반려') ||
    title.includes('거절') ||
    title.toLowerCase().includes('reject')
  if (rejected) {
    return <XCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
  }
  return (
    <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  )
}

export default function NotificationBell() {
  const router = useRouter()
  const { user, profile } = useUser()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [badgeCount, setBadgeCount] = useState(0)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const refetchNotifications = useCallback(async () => {
    if (!user) return

    setLoading(true)
    const supabase = createClient()
    const lastSeen = readLastSeen(user.id)

    let unreadMsgCount = 0
    let unseenNoticeCount = 0
    let pendingApprovalCount = 0
    const nextItems: NotificationItem[] = []

    const { data: unreadMsgs, count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact' })
      .eq('receiver_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })

    unreadMsgCount = msgCount ?? 0

    for (const row of (unreadMsgs ?? []) as Message[]) {
      nextItems.push({
        id: `msg-${row.id}`,
        category: 'message',
        title: row.title,
        description: row.body.length > 80 ? `${row.body.slice(0, 80)}…` : row.body,
        createdAt: row.created_at,
        isRead: false,
        link: `/messages?with=${row.sender_id}`,
        messageId: row.id,
      })
    }

    if (profile?.grade) {
      const orParts: string[] = [`grade.eq.${profile.grade}`]
      if (profile.class_number != null) {
        orParts.push(`class_number.eq.${profile.class_number}`)
      }

      const { data: noticeRows, error: noticeError } = await supabase
        .from('events')
        .select('id, title, created_at')
        .eq('approval_status', 'approved')
        .or(orParts.join(','))
        .gt('created_at', lastSeen)
        .order('created_at', { ascending: false })

      if (noticeError) {
        console.error('notice fetch failed:', noticeError)
      } else {
        unseenNoticeCount = noticeRows?.length ?? 0
        for (const ev of noticeRows ?? []) {
          nextItems.push({
            id: `notice-${ev.id}`,
            category: 'notice',
            title: ev.title,
            description: '새 공지가 등록되었어요',
            createdAt: ev.created_at,
            isRead: false,
            link: '/calendar',
          })
        }
      }
    }

    if (profile?.role === 'admin') {
      const [
        { data: leaderRows },
        { data: teacherRows },
        { data: materialRows },
        { data: eventRows },
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, created_at')
          .eq('class_leader_status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, name, created_at')
          .eq('teacher_status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('materials')
          .select('id, title, created_at')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('id, title, created_at')
          .eq('approval_status', 'pending')
          .order('created_at', { ascending: false }),
      ])

      for (const row of leaderRows ?? []) {
        pendingApprovalCount += 1
        nextItems.push({
          id: `approval-leader-${row.id}`,
          category: 'approval',
          title: '반장/부반장 승인 대기',
          description: `${row.name} 님의 신청`,
          createdAt: row.created_at,
          isRead: false,
          link: '/admin',
        })
      }

      for (const row of teacherRows ?? []) {
        pendingApprovalCount += 1
        nextItems.push({
          id: `approval-teacher-${row.id}`,
          category: 'approval',
          title: '선생님 계정 승인 대기',
          description: `${row.name} 님의 신청`,
          createdAt: row.created_at,
          isRead: false,
          link: '/admin',
        })
      }

      for (const row of materialRows ?? []) {
        pendingApprovalCount += 1
        nextItems.push({
          id: `approval-material-${row.id}`,
          category: 'approval',
          title: '자료 승인 대기',
          description: row.title,
          createdAt: row.created_at,
          isRead: false,
          link: '/admin',
        })
      }

      for (const row of eventRows ?? []) {
        pendingApprovalCount += 1
        nextItems.push({
          id: `approval-event-${row.id}`,
          category: 'approval',
          title: '공지 승인 대기',
          description: row.title,
          createdAt: row.created_at,
          isRead: false,
          link: '/admin',
        })
      }
    }

    nextItems.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    setItems(nextItems)
    setBadgeCount(unreadMsgCount + unseenNoticeCount + pendingApprovalCount)
    setLoading(false)
  }, [user, profile?.grade, profile?.class_number, profile?.role])

  useEffect(() => {
    if (!user) return
    refetchNotifications()
  }, [user, refetchNotifications])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          toast('💬 새 메시지가 도착했어요', {
            action: {
              label: '확인',
              onClick: () => router.push('/messages'),
            },
          })
          refetchNotifications()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>
          const oldRow = (payload.old ?? {}) as Record<string, unknown>

          if (
            oldRow.class_leader_status === 'pending' &&
            newRow.class_leader_status === 'approved'
          ) {
            toast.success('반장/부반장 신청이 승인되었어요')
          }
          if (
            oldRow.class_leader_status === 'pending' &&
            newRow.class_leader_status === 'rejected'
          ) {
            toast.error('반장/부반장 신청이 반려되었어요')
          }
          if (
            oldRow.teacher_status === 'pending' &&
            newRow.teacher_status === 'approved'
          ) {
            toast.success('선생님 계정이 승인되었어요')
          }
          if (
            oldRow.teacher_status === 'pending' &&
            newRow.teacher_status === 'rejected'
          ) {
            toast.error('선생님 계정 신청이 반려되었어요')
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'materials',
          filter: `uploaded_by=eq.${user.id}`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>
          const oldRow = (payload.old ?? {}) as Record<string, unknown>

          if (oldRow.status === 'pending' && newRow.status === 'approved') {
            toast.success(`'${String(newRow.title)}' 자료가 승인되었어요`)
          }
          if (oldRow.status === 'pending' && newRow.status === 'rejected') {
            toast.error(`'${String(newRow.title)}' 자료가 반려되었어요`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, router, refetchNotifications])

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return
    const supabase = createClient()

    const channel = supabase
      .channel('admin-notifications')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>
          const oldRow = (payload.old ?? {}) as Record<string, unknown>

          if (
            newRow.class_leader_status === 'pending' &&
            oldRow.class_leader_status !== 'pending'
          ) {
            toast('새 반장/부반장 신청이 있어요')
            refetchNotifications()
          }
          if (
            newRow.teacher_status === 'pending' &&
            oldRow.teacher_status !== 'pending'
          ) {
            toast('새 선생님 계정 신청이 있어요')
            refetchNotifications()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'materials' },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>
          if (newRow.status === 'pending') {
            toast('새 자료 승인 요청이 있어요')
            refetchNotifications()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.role, refetchNotifications])

  const filteredItems = useMemo(() => {
    const sorted = items.slice(0, 10)
    if (filter === 'all') return sorted
    if (filter === 'message') return sorted.filter((i) => i.category === 'message')
    return sorted.filter((i) => i.category === 'notice')
  }, [items, filter])

  const markItemRead = async (item: NotificationItem) => {
    if (!user) return

    if (item.category === 'message' && item.messageId) {
      const supabase = createClient()
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('id', item.messageId)
        .eq('receiver_id', user.id)
    }

    if (item.category === 'notice') {
      const current = readLastSeen(user.id)
      if (new Date(item.createdAt) > new Date(current)) {
        writeLastSeen(user.id, item.createdAt)
      }
    }

    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setBadgeCount((c) => Math.max(0, c - 1))
  }

  const markAllRead = async () => {
    if (!user) return

    const supabase = createClient()
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', user.id)
      .eq('is_read', false)

    writeLastSeen(user.id, new Date().toISOString())

    setItems((prev) =>
      prev.filter((i) => i.category === 'approval' && profile?.role === 'admin')
    )
    await refetchNotifications()
  }

  const handleItemClick = async (item: NotificationItem) => {
    await markItemRead(item)
    setOpen(false)
    router.push(item.link)
  }

  if (!user) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className={BELL_BUTTON_CLASS} aria-label="알림">
        <BellIcon className="h-3.5 w-3.5" />
        {badgeCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {formatBadge(badgeCount)}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5">
          <span className="text-sm font-semibold text-zinc-900">알림</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void markAllRead()
            }}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-800"
          >
            모두 읽음
          </button>
        </div>

        <div className="flex gap-0.5 border-b border-zinc-100 px-2 py-1.5">
          {(
            [
              { key: 'all' as const, label: '전체' },
              { key: 'message' as const, label: '메시지' },
              { key: 'notice' as const, label: '공지' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFilter(key)
              }}
              className={cn(
                SEGMENT_BASE,
                filter === key
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading && filteredItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-400">
              불러오는 중…
            </p>
          ) : filteredItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-400">
              새로운 알림이 없어요
            </p>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleItemClick(item)}
                className={cn(
                  'flex w-full gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50',
                  !item.isRead && 'bg-blue-50/50'
                )}
              >
                <CategoryIcon category={item.category} title={item.title} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {item.description}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">
                    {formatRelativeTime(item.createdAt)}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
