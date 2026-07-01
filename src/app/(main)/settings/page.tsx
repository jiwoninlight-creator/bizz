'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2Icon, ClockIcon, Loader2Icon, XCircleIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { CLASS_OPTIONS } from '@/lib/school-schedule'
import type { ClassLeaderType } from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type LeaderChoice = 'none' | 'leader' | 'vice_leader'

const LEADER_OPTIONS: { value: LeaderChoice; label: string }[] = [
  { value: 'none', label: '아니오' },
  { value: 'leader', label: '반장' },
  { value: 'vice_leader', label: '부반장' },
]

export default function SettingsPage() {
  const { user, profile, loading, refresh } = useUser()

  const [classNumber, setClassNumber] = useState<string>('')
  const [leaderChoice, setLeaderChoice] = useState<LeaderChoice>('none')
  const [savingClass, setSavingClass] = useState(false)
  const [savingLeader, setSavingLeader] = useState(false)

  useEffect(() => {
    if (profile) {
      setClassNumber(profile.class_number ? String(profile.class_number) : '')
      const currentType: LeaderChoice = profile.class_leader_type
        ? profile.class_leader_type
        : 'none'
      setLeaderChoice(currentType)
    }
  }, [profile])

  const saveClass = async () => {
    if (!user || !classNumber) return
    setSavingClass(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({ class_number: Number(classNumber) })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      alert('반 정보를 저장했어요.')
    } catch (err) {
      console.error('Save class failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingClass(false)
    }
  }

  const applyLeader = async () => {
    if (!user) return
    setSavingLeader(true)
    try {
      const supabase = createClient()
      const leaderType: ClassLeaderType | null =
        leaderChoice === 'none' ? null : leaderChoice
      const leaderStatus = leaderChoice === 'none' ? 'none' : 'pending'
      const { error } = await supabase
        .from('users')
        .update({
          class_leader_type: leaderType,
          class_leader_status: leaderStatus,
        })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      alert(
        leaderChoice === 'none'
          ? '반장/부반장 신청을 취소했어요.'
          : '반장/부반장 신청이 접수되었어요. 관리자 승인을 기다려주세요.'
      )
    } catch (err) {
      console.error('Apply leader failed:', err)
      alert(`저장 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingLeader(false)
    }
  }

  const cancelApprovedLeader = async () => {
    if (!user) return
    if (!confirm('반장/부반장 권한을 취소하시겠어요?')) return
    setSavingLeader(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('users')
        .update({
          role: 'student',
          class_leader_type: null,
          class_leader_status: 'none',
        })
        .eq('id', user.id)
      if (error) throw error
      await refresh()
      setLeaderChoice('none')
      alert('권한을 취소했어요.')
    } catch (err) {
      console.error('Cancel leader failed:', err)
      alert(`취소 실패: ${getErrorMessage(err)}`)
    } finally {
      setSavingLeader(false)
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2Icon className="mr-2 h-5 w-5 animate-spin" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    )
  }

  const status = profile.class_leader_status
  const currentTypeLabel =
    profile.class_leader_type === 'vice_leader' ? '부반장' : '반장'
  const isPending = status === 'pending'
  const isApproved = status === 'approved' && profile.role === 'class_leader'
  const isRejected = status === 'rejected'

  const canReapply = status === 'none' || isRejected

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">설정</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">반 정보</CardTitle>
          <CardDescription>
            소속된 반을 변경할 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="class-select">학년 · 반</Label>
            <div className="flex gap-2">
              <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                {profile.grade ? `${profile.grade}학년` : '학년 없음'}
              </div>
              <Select value={classNumber} onValueChange={setClassNumber}>
                <SelectTrigger id="class-select" className="flex-1 h-9">
                  <SelectValue placeholder="반 선택" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((c) => (
                    <SelectItem key={c} value={String(c)}>
                      {c}반
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={saveClass}
            disabled={
              savingClass ||
              !classNumber ||
              Number(classNumber) === profile.class_number
            }
            className="w-full"
          >
            {savingClass ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                <span className="ml-1">저장 중…</span>
              </>
            ) : (
              '반 정보 저장'
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">반장 · 부반장</CardTitle>
          <CardDescription>
            반장/부반장은 관리자 승인 후 반 공지를 올릴 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isApproved && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-700">
              <CheckCircle2Icon className="h-4 w-4" />
              <span>
                현재 <strong className="font-semibold">{currentTypeLabel}</strong>{' '}
                권한이 있습니다.
              </span>
              <Badge className="ml-auto bg-green-100 text-green-700 hover:bg-green-100">
                승인됨
              </Badge>
            </div>
          )}
          {isPending && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
              <ClockIcon className="h-4 w-4" />
              <span>
                <strong className="font-semibold">{currentTypeLabel}</strong> 신청{' '}
                승인 대기 중이에요.
              </span>
              <Badge className="ml-auto bg-amber-100 text-amber-700 hover:bg-amber-100">
                대기
              </Badge>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <XCircleIcon className="h-4 w-4" />
              <span>이전 신청이 반려되었어요. 다시 신청할 수 있어요.</span>
            </div>
          )}

          {isApproved ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={cancelApprovedLeader}
              disabled={savingLeader}
            >
              {savingLeader ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1">처리 중…</span>
                </>
              ) : (
                '권한 취소'
              )}
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {LEADER_OPTIONS.map((opt) => {
                  const active = leaderChoice === opt.value
                  const disabled = isPending
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setLeaderChoice(opt.value)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                        disabled && 'cursor-not-allowed opacity-50'
                      )}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <Button
                onClick={applyLeader}
                disabled={
                  savingLeader ||
                  (!canReapply && !isPending && leaderChoice !== 'none') ||
                  (isPending && leaderChoice !== 'none')
                }
                className="w-full"
              >
                {savingLeader ? (
                  <>
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span className="ml-1">처리 중…</span>
                  </>
                ) : leaderChoice === 'none' ? (
                  isPending ? '신청 취소' : '변경 사항 저장'
                ) : (
                  '신청'
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
