'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2Icon } from 'lucide-react'
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

// 학년: 학번 이메일이 아닌 경우 온보딩에서 직접 선택 (또는 '해당없음')
const GRADE_OPTIONS = [
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
  { value: 'none', label: '해당 없음' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading } = useUser()

  const [gradeSelection, setGradeSelection] = useState<string>('')
  const [classNumber, setClassNumber] = useState<string>('')
  const [leaderChoice, setLeaderChoice] = useState<LeaderChoice>('none')
  const [submitting, setSubmitting] = useState(false)

  // 이메일 기반 학년이 이미 감지된 경우 (학번 이메일)
  const hasAutoGrade =
    profile?.grade !== null && profile?.grade !== undefined
  const needsManualGrade = !hasAutoGrade

  useEffect(() => {
    if (!loading && profile?.onboarded) {
      router.replace('/calendar')
    }
  }, [profile?.onboarded, loading, router])

  useEffect(() => {
    if (hasAutoGrade && profile?.grade) {
      setGradeSelection(String(profile.grade))
    }
  }, [hasAutoGrade, profile?.grade])

  const gradeChosen = gradeSelection !== ''
  const isNoneGrade = gradeSelection === 'none'
  // 학년이 '해당 없음'이면 반 선택도 스킵
  const classRequired = gradeChosen && !isNoneGrade

  const canSubmit =
    !submitting &&
    gradeChosen &&
    (!classRequired || classNumber !== '')

  const handleSubmit = async () => {
    if (!user || !canSubmit) return
    setSubmitting(true)
    try {
      const supabase = createClient()

      const finalGrade =
        isNoneGrade || gradeSelection === ''
          ? null
          : Number(gradeSelection)
      const finalClass = classRequired && classNumber ? Number(classNumber) : null

      const leaderType: ClassLeaderType | null =
        leaderChoice === 'none' || !classRequired ? null : leaderChoice
      const leaderStatus =
        leaderChoice === 'none' || !classRequired ? 'none' : 'pending'

      const { error } = await supabase
        .from('users')
        .update({
          grade: finalGrade,
          class_number: finalClass,
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
      alert(`저장에 실패했습니다: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2Icon className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center">
        <Card className="w-full border border-zinc-200 shadow-none">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900">
              <span className="text-lg font-bold text-white">B</span>
            </div>
            <CardTitle className="text-xl">환영합니다!</CardTitle>
            <CardDescription>
              몇 가지 정보만 알려주면 앱을 사용할 수 있어요.
              <br />
              선생님이신 경우 가입 후 설정 페이지에서 신청할 수 있어요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 학년 */}
            <div className="space-y-1.5">
              <Label htmlFor="grade-select">
                학년 <span className="text-red-500">*</span>
              </Label>
              {hasAutoGrade ? (
                <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                  {profile?.grade}학년
                  <span className="ml-auto text-xs text-zinc-400">
                    이메일 기반
                  </span>
                </div>
              ) : (
                <Select
                  value={gradeSelection}
                  onValueChange={setGradeSelection}
                >
                  <SelectTrigger id="grade-select" className="h-9 w-full">
                    <SelectValue placeholder="학년을 선택해주세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {needsManualGrade && (
                <p className="text-[11px] text-zinc-500">
                  학번 형식이 아닌 이메일이라 자동 판별되지 않았어요. 학년을 직접
                  선택해주세요. 학교 학생이 아닌 경우 &quot;해당 없음&quot;을
                  선택하세요.
                </p>
              )}
            </div>

            {/* 반 (해당 없음일 땐 숨김) */}
            {classRequired && (
              <div className="space-y-1.5">
                <Label htmlFor="class-select">
                  반 <span className="text-red-500">*</span>
                </Label>
                <Select value={classNumber} onValueChange={setClassNumber}>
                  <SelectTrigger id="class-select" className="h-9 w-full">
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
            )}

            {/* 반장/부반장 (반이 필요한 경우만) */}
            {classRequired && (
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
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                        )}
                        aria-pressed={active}
                      >
                        <div>
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-70">{opt.hint}</div>
                        </div>
                        <span
                          className={cn(
                            'mt-1 h-4 w-4 shrink-0 rounded-full border-2',
                            active
                              ? 'border-white bg-white'
                              : 'border-zinc-300'
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
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-10 w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
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
