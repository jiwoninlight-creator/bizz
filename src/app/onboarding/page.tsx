'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCapIcon, Loader2Icon, UsersIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { CLASS_OPTIONS } from '@/lib/school-schedule'
import { isTeacherEmail } from '@/lib/grade-utils'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ApplyAs = 'student' | 'teacher'
type LeaderChoice = 'none' | 'leader' | 'vice_leader'

const LEADER_OPTIONS: { value: LeaderChoice; label: string; hint: string }[] = [
  { value: 'none', label: '아니오', hint: '일반 학생' },
  { value: 'leader', label: '반장', hint: '승인 후 반 공지 게시 가능' },
  { value: 'vice_leader', label: '부반장', hint: '승인 후 반 공지 게시 가능' },
]

const TEACHER_SUBJECTS = [
  '국어',
  '영어',
  '수학',
  '과학',
  '사회',
  '역사',
  '물리',
  '화학',
  '생물',
  '지구과학',
  '기타',
] as const

const GRADES = [1, 2, 3] as const

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading } = useUser()

  const teacherEligible = useMemo(
    () => (user?.email ? isTeacherEmail(user.email) : false),
    [user?.email]
  )

  const [applyAs, setApplyAs] = useState<ApplyAs>('student')
  const [classNumber, setClassNumber] = useState<string>('')
  const [leaderChoice, setLeaderChoice] = useState<LeaderChoice>('none')
  const [tSubject, setTSubject] = useState<string>('')
  const [tGrades, setTGrades] = useState<number[]>([])
  const [tOffice, setTOffice] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (teacherEligible) setApplyAs('teacher')
  }, [teacherEligible])

  useEffect(() => {
    if (!loading && profile?.onboarded) {
      router.replace('/calendar')
    }
  }, [profile?.onboarded, loading, router])

  const toggleGrade = (g: number) => {
    setTGrades((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].sort()
    )
  }

  const canSubmit =
    !submitting &&
    (applyAs === 'student'
      ? classNumber !== ''
      : tSubject !== '' && tGrades.length > 0 && tOffice.trim().length > 0)

  const handleSubmit = async () => {
    if (!user || !canSubmit) return
    setSubmitting(true)
    try {
      const supabase = createClient()

      if (applyAs === 'student') {
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
      } else {
        const { error: userErr } = await supabase
          .from('users')
          .update({
            role: 'teacher',
            teacher_status: 'pending',
            onboarded: true,
          })
          .eq('id', user.id)
        if (userErr) throw userErr

        const displayName =
          profile?.name ??
          (typeof user.user_metadata.full_name === 'string'
            ? user.user_metadata.full_name
            : null) ??
          user.email?.split('@')[0] ??
          '선생님'
        const photoUrl =
          profile?.avatar_url ??
          (typeof user.user_metadata.avatar_url === 'string'
            ? user.user_metadata.avatar_url
            : null) ??
          null

        const { error: tErr } = await supabase.from('teachers').insert({
          user_id: user.id,
          name: displayName,
          subject: tSubject,
          office_location: tOffice.trim(),
          photo_url: photoUrl,
          current_status: 'unknown',
          is_self_registered: true,
          managed_grades: tGrades,
          managed_classes: [],
        })
        if (tErr) throw tErr
      }

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
            {teacherEligible && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApplyAs('teacher')}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors',
                    applyAs === 'teacher'
                      ? 'border-purple-500 bg-purple-50 text-purple-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  aria-pressed={applyAs === 'teacher'}
                >
                  <GraduationCapIcon className="h-5 w-5" />
                  <span className="text-sm font-semibold">선생님으로</span>
                </button>
                <button
                  type="button"
                  onClick={() => setApplyAs('student')}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors',
                    applyAs === 'student'
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                  aria-pressed={applyAs === 'student'}
                >
                  <UsersIcon className="h-5 w-5" />
                  <span className="text-sm font-semibold">일반 사용자로</span>
                </button>
              </div>
            )}

            {applyAs === 'student' ? (
              <>
                <div className="space-y-1.5">
                  <Label>학년</Label>
                  <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                    {profile?.grade
                      ? `${profile.grade}학년`
                      : '자동 판별 실패 (관리자에게 문의)'}
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
                            <div className="text-sm font-semibold">
                              {opt.label}
                            </div>
                            <div className="text-xs text-slate-500">
                              {opt.hint}
                            </div>
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
              </>
            ) : (
              <>
                <div className="rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-800">
                  선생님 계정은 관리자 승인 후 활성화돼요. 승인 전까지는 일반
                  사용자 권한으로 앱을 사용할 수 있어요.
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-subject">
                    담당 과목 <span className="text-red-500">*</span>
                  </Label>
                  <Select value={tSubject} onValueChange={setTSubject}>
                    <SelectTrigger id="t-subject" className="w-full h-9">
                      <SelectValue placeholder="과목 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEACHER_SUBJECTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    담당 학년 <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {GRADES.map((g) => {
                      const active = tGrades.includes(g)
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleGrade(g)}
                          className={cn(
                            'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'border-purple-500 bg-purple-50 text-purple-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          )}
                          aria-pressed={active}
                        >
                          {g}학년
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="t-office">
                    교과 연구실 위치 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="t-office"
                    value={tOffice}
                    onChange={(e) => setTOffice(e.target.value)}
                    placeholder="예: 3층 수학교과연구실"
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full h-10',
                applyAs === 'teacher' && 'bg-purple-600 hover:bg-purple-700'
              )}
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                  <span className="ml-1">저장 중…</span>
                </>
              ) : applyAs === 'teacher' ? (
                '선생님 신청'
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
