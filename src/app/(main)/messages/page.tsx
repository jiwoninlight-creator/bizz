'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  HelpCircleIcon,
  Loader2Icon,
  MessagesSquareIcon,
  SendIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import type { Message, MessagePurpose, MessageTone } from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import EmptyState from '@/components/EmptyState'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PURPOSE_META: Record<
  MessagePurpose,
  {
    label: string
    Icon: React.ComponentType<{ className?: string }>
    color: string
  }
> = {
  question: {
    label: '질문',
    Icon: HelpCircleIcon,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  },
  counsel: {
    label: '상담',
    Icon: MessagesSquareIcon,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  },
  report: {
    label: '보고',
    Icon: ClipboardListIcon,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  research: {
    label: '연구',
    Icon: FlaskConicalIcon,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
  },
}

const TONE_LABEL: Record<MessageTone, string> = {
  formal: '정중',
  casual: '친근',
}

const PURPOSE_OPTIONS: { value: MessagePurpose; label: string }[] = [
  { value: 'question', label: '질문' },
  { value: 'counsel', label: '상담' },
  { value: 'report', label: '보고' },
  { value: 'research', label: '연구과제' },
]

const TONE_OPTIONS: { value: MessageTone; label: string }[] = [
  { value: 'formal', label: '정중하게' },
  { value: 'casual', label: '친근하게' },
]

type PartnerMeta = {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  role: string
}

type Conversation = {
  partner: PartnerMeta
  lastMessage: Message
  unreadCount: number
  purposeSummary: MessagePurpose // 최신 메시지 목적
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const daysDiff = Math.floor(
    (now.getTime() - d.getTime()) / (24 * 3600 * 1000)
  )
  if (daysDiff < 7) return `${daysDiff}일 전`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatFullWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
          <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">불러오는 중…</span>
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  )
}

function MessagesInner() {
  const { user, loading: userLoading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPartner = searchParams.get('with')

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [partners, setPartners] = useState<Map<string, PartnerMeta>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(
    initialPartner
  )

  const fetchConversations = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: msgRows, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
      if (error) throw error

      const msgs = (msgRows ?? []) as Message[]
      const partnerIds = new Set<string>()
      for (const m of msgs) {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id
        partnerIds.add(other)
      }

      // 상대방(파트너)이 대화중인 대상이 없으면 초기 진입 파트너도 추가
      if (initialPartner) partnerIds.add(initialPartner)

      const partnerList = Array.from(partnerIds)
      let partnerMap = new Map<string, PartnerMeta>()
      if (partnerList.length > 0) {
        const { data: userRows, error: uErr } = await supabase
          .from('users')
          .select('id, name, email, avatar_url, role')
          .in('id', partnerList)
        if (uErr) throw uErr
        for (const u of userRows ?? []) {
          const row = u as {
            id: string
            name: string
            email: string
            avatar_url: string | null
            role: string
          }
          partnerMap.set(row.id, {
            id: row.id,
            name: row.name,
            email: row.email,
            avatarUrl: row.avatar_url,
            role: row.role,
          })
        }
      }

      // Conversation 그룹핑
      const grouped = new Map<string, { last: Message; unread: number }>()
      for (const m of msgs) {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id
        const g = grouped.get(other)
        if (!g) {
          grouped.set(other, {
            last: m,
            unread:
              !m.is_read && m.receiver_id === user.id ? 1 : 0,
          })
        } else {
          if (!m.is_read && m.receiver_id === user.id) g.unread += 1
          if (
            new Date(m.created_at).getTime() >
            new Date(g.last.created_at).getTime()
          ) {
            g.last = m
          }
        }
      }

      const convList: Conversation[] = Array.from(grouped.entries()).map(
        ([partnerId, g]) => ({
          partner:
            partnerMap.get(partnerId) ?? {
              id: partnerId,
              name: '알 수 없음',
              email: '',
              avatarUrl: null,
              role: 'unknown',
            },
          lastMessage: g.last,
          unreadCount: g.unread,
          purposeSummary: g.last.purpose,
        })
      )

      // initialPartner가 아직 대화가 없어도 상단에 노출
      if (initialPartner && !grouped.has(initialPartner)) {
        const p = partnerMap.get(initialPartner)
        if (p) {
          // 가짜(?) 대화 항목: lastMessage 없음. UI에서 처리.
        }
      }

      convList.sort(
        (a, b) =>
          new Date(b.lastMessage.created_at).getTime() -
          new Date(a.lastMessage.created_at).getTime()
      )

      setPartners(partnerMap)
      setConversations(convList)
    } catch (err) {
      console.error('load conversations failed:', err)
      alert(`대화 목록 로드 실패: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }, [user, initialPartner])

  useEffect(() => {
    if (!userLoading && user) fetchConversations()
  }, [userLoading, user, fetchConversations])

  useEffect(() => {
    if (initialPartner) setActivePartnerId(initialPartner)
  }, [initialPartner])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.partner.id === activePartnerId),
    [conversations, activePartnerId]
  )
  const activePartner = activePartnerId
    ? partners.get(activePartnerId) ??
      activeConversation?.partner ??
      null
    : null

  const clearWithParam = useCallback(() => {
    if (searchParams.get('with')) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('with')
      const qs = params.toString()
      router.replace(qs ? `/messages?${qs}` : '/messages')
    }
  }, [router, searchParams])

  if (userLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
        <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          메시지
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          주고받은 대화를 확인하고 답장할 수 있어요.
        </p>
      </div>

      {/* 모바일: 리스트 or 상세 전환. 데스크톱(sm+): 2단 레이아웃 */}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Conversation list */}
        <div
          className={cn(
            'space-y-2',
            activePartnerId ? 'hidden sm:block' : 'block'
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center py-10 text-zinc-400">
              <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              <span className="text-sm">불러오는 중…</span>
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={MessagesSquareIcon}
              title="아직 대화가 없어요"
              description="학생들이 보낸 메시지가 여기 나타나요. 답장은 원한 톤/목적으로 편안하게."
              compact
            />
          ) : (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
              {conversations.map((c) => (
                <ConversationRow
                  key={c.partner.id}
                  conversation={c}
                  active={c.partner.id === activePartnerId}
                  onClick={() => setActivePartnerId(c.partner.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div
          className={cn(
            activePartnerId ? 'block' : 'hidden sm:block',
            'min-h-[calc(100vh-16rem)]'
          )}
        >
          {activePartnerId && activePartner ? (
            <ConversationDetail
              user={user}
              partner={activePartner}
              onBack={() => {
                setActivePartnerId(null)
                clearWithParam()
              }}
              onMessagesChanged={fetchConversations}
            />
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400">
              대화를 선택하면 여기에 표시돼요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================ Conversation row ============================ */

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation
  active: boolean
  onClick: () => void
}) {
  const { partner, lastMessage, unreadCount, purposeSummary } = conversation
  const meta = PURPOSE_META[purposeSummary]
  const initial = partner.name.trim().slice(0, 1) || '?'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-zinc-50',
          active && 'bg-indigo-50 hover:bg-indigo-50'
        )}
      >
        <Avatar className="h-10 w-10 shrink-0">
          {partner.avatarUrl ? (
            <AvatarImage src={partner.avatarUrl} alt={partner.name} />
          ) : null}
          <AvatarFallback className="bg-zinc-100 text-sm font-semibold text-zinc-700">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[10px]',
                meta.color
              )}
              title={meta.label}
            >
              <meta.Icon className="h-2.5 w-2.5" />
            </span>
            <span
              className={cn(
                'truncate text-sm font-semibold text-zinc-900',
                active && 'text-indigo-900'
              )}
            >
              {partner.name}
              {partner.role === 'teacher' && (
                <span className="ml-1 text-[10px] font-medium text-indigo-500">
                  선생님
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className="line-clamp-1 min-w-0 flex-1 text-xs text-zinc-500">
              {lastMessage.title || lastMessage.body}
            </p>
            <span className="shrink-0 text-[10px] text-zinc-400 tabular-nums">
              {formatWhen(lastMessage.created_at)}
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}

/* ============================ Conversation detail ========================= */

function ConversationDetail({
  user,
  partner,
  onBack,
  onMessagesChanged,
}: {
  user: SupabaseUser
  partner: PartnerMeta
  onBack: () => void
  onMessagesChanged: () => Promise<void> | void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [replyTone, setReplyTone] = useState<MessageTone>('formal')
  const [replyPurpose, setReplyPurpose] = useState<MessagePurpose>('question')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true })
      if (error) throw error
      const list = (data ?? []) as Message[]
      setMessages(list)

      // 마지막 메시지의 tone/purpose를 기본값으로
      const lastFromPartner = [...list]
        .reverse()
        .find((m) => m.sender_id === partner.id)
      const seed =
        lastFromPartner ?? [...list].reverse().find((m) => m.sender_id === user.id)
      if (seed) {
        setReplyTone(seed.tone)
        setReplyPurpose(seed.purpose)
      }

      // 안읽음 메시지 read 처리
      const unreadIds = list
        .filter((m) => m.receiver_id === user.id && !m.is_read)
        .map((m) => m.id)
      if (unreadIds.length > 0) {
        const { error: updErr } = await supabase
          .from('messages')
          .update({ is_read: true })
          .in('id', unreadIds)
        if (updErr) {
          console.warn('mark read failed:', updErr)
        } else {
          await onMessagesChanged()
        }
      }
    } catch (err) {
      console.error('load messages failed:', err)
      alert(`대화 로드 실패: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }, [partner.id, user.id, onMessagesChanged])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages])

  const handleSend = async () => {
    if (!reply.trim() || sending) return
    setSending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: partner.id,
        tone: replyTone,
        purpose: replyPurpose,
        title: '답장', // 대화 내 답장은 제목 간소화
        body: reply.trim(),
      })
      if (error) throw error
      setReply('')
      await loadMessages()
      await onMessagesChanged()
    } catch (err) {
      console.error('send failed:', err)
      alert(`전송 실패: ${getErrorMessage(err)}`)
    } finally {
      setSending(false)
    }
  }

  const initial = partner.name.trim().slice(0, 1) || '?'

  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="뒤로"
          className="sm:hidden"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          {partner.avatarUrl ? (
            <AvatarImage src={partner.avatarUrl} alt={partner.name} />
          ) : null}
          <AvatarFallback className="bg-zinc-100 text-sm font-semibold text-zinc-700">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-900">
            {partner.name}
            {partner.role === 'teacher' && (
              <span className="text-[10px] font-medium text-indigo-500">
                선생님
              </span>
            )}
            {partner.role === 'admin' && (
              <span className="text-[10px] font-medium text-red-500">
                관리자
              </span>
            )}
          </div>
          {partner.email && (
            <div className="truncate text-[11px] text-zinc-400">
              {partner.email}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-sm">불러오는 중…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
            아직 주고받은 메시지가 없어요.
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} own={m.sender_id === user.id} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply composer */}
      <div className="border-t border-zinc-200 p-3">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Select
            value={replyTone}
            onValueChange={(v) => setReplyTone(v as MessageTone)}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={replyPurpose}
            onValueChange={(v) => setReplyPurpose(v as MessagePurpose)}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PURPOSE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="답장 내용을 입력하세요"
            rows={2}
            className="min-h-[42px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!reply.trim() || sending}
            className="shrink-0 bg-zinc-900 text-white hover:bg-zinc-800"
          >
            {sending ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <SendIcon className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">전송</span>
              </>
            )}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-zinc-400">
          Ctrl/⌘ + Enter 로 빠르게 전송할 수 있어요.
        </p>
      </div>
    </div>
  )
}

/* ============================ Message bubble ============================ */

function MessageBubble({ message, own }: { message: Message; own: boolean }) {
  const meta = PURPOSE_META[message.purpose]
  return (
    <div className={cn('flex', own ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg border px-3 py-2 text-sm leading-relaxed sm:max-w-[75%]',
          own
            ? 'border-zinc-900 bg-zinc-900 text-white'
            : 'border-zinc-200 bg-zinc-100 text-zinc-900'
        )}
      >
        <div
          className={cn(
            'mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium',
            own ? 'text-white/70' : 'text-zinc-500'
          )}
        >
          <span
            className={cn(
              'inline-flex h-4 items-center gap-0.5 rounded-md border px-1',
              own
                ? 'border-white/20 bg-white/10 text-white/90'
                : meta.color
            )}
          >
            <meta.Icon className="h-2.5 w-2.5" />
            {meta.label}
          </span>
          <span
            className={cn(
              'inline-flex h-4 items-center rounded-md border px-1',
              own
                ? 'border-white/20 bg-white/10 text-white/90'
                : 'border-zinc-200 bg-white text-zinc-500'
            )}
          >
            {TONE_LABEL[message.tone]}
          </span>
          <span className="ml-auto tabular-nums">
            {formatFullWhen(message.created_at)}
          </span>
        </div>
        {message.title && message.title !== '답장' && (
          <div
            className={cn(
              'mb-0.5 text-xs font-semibold',
              own ? 'text-white' : 'text-zinc-900'
            )}
          >
            {message.title}
          </div>
        )}
        <p className="whitespace-pre-wrap">{message.body}</p>
      </div>
    </div>
  )
}
