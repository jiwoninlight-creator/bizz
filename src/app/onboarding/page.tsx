'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { CLASS_OPTIONS } from '@/lib/school-schedule'
import type { ClassLeaderType } from '@/types/database'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type LeaderChoice = 'none' | 'leader' | 'vice_leader'

const LEADER_OPTIONS: { value: LeaderChoice; label: string; hint: string }[] = [
  { value: 'none', label: '아니오', hint: '일반 학생' },
  { value: 'leader', label: '반장', hint: '승인 후 반 공지 게시 가능' },
  { value: 'vice_leader', label: '부반장', hint: '승인 후 반 공지 게시 가능' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading } = useUser()

  const [classNumber, setClassNumber] = useState<string>('')
  const [leaderChoice, setLeaderChoice] = useState<LeaderChoice>('none')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && profile?.onboarded) {
      router.replace('/calendar')
    }
  }, [profile?.onboarded, loading, router])

  const handleSubmit = async () => {
    if (!user || !classNumber) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const leaderType: ClassLeaderType | null =
        leaderChoice === 'none' ? null : leaderChoice
      const leaderStatus = leaderChoice === 'none' ? 'none' : 'pending'

      const { error } = await supabase
        .from('users')
        .update({
          class_number: Number(classNumber),
          class_leader_type: leaderType,
          class_leader_status: leaderStatus,
          onboarded: true,
        })
        .eq('id', user.id)
      if (error) throw error

      router.replace('/calendar')
      router.refresh()
    } catch (err) {
      console.error('Onboarding failed:', err)
      const message = err instanceof Error ? err.message : String(err)
      alert(`저장에 실패했습니다: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = classNumber !== '' && !submitting

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2Icon className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center">
        <Card className="w-full">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <span className="text-lg font-bold text-white">B</span>
            </div>
            <CardTitle className="text-xl">환영합니다!</CardTitle>
            <CardDescription>
              몇 가지 정보만 알려주면 앱을 사용할 수 있어요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>학년</Label>
              <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                {profile?.grade ? `${profile.grade}학년` : '자동 판별됨'}
                <span className="ml-auto text-xs text-slate-400">
                  이메일 기반
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="class-select">
                반 <span className="text-red-500">*</span>
              </Label>
              <Select value={classNumber} onValueChange={setClassNumber}>
                <SelectTrigger id="class-select" className="w-full h-9">
                  <SelectValue placeholder="반을 선택해주세요" />
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

            <div className="space-y-2">
              <Label>반장 / 부반장이신가요?</Label>
              <div className="grid grid-cols-1 gap-2">
                {LEADER_OPTIONS.map((opt) => {
                  const active = leaderChoice === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setLeaderChoice(opt.value)}
                      className={cn(
                        'flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      )}
                      aria-pressed={active}
                    >
                      <div>
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-slate-500">{opt.hint}</div>
                      </div>
                      <span
                        className={cn(
                          'mt-1 h-4 w-4 shrink-0 rounded-full border-2',
                          active
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300'
                        )}
                      />
                    </button>
                  )
                })}
              </div>
              {leaderChoice !== 'none' && (
                <p className="text-xs text-amber-600">
                  반장/부반장은 관리자 승인 후 반 공지를 올릴 수 있어요.
                </p>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-10"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1">저장 중…</span>
                </>
              ) : (
                '시작하기'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
