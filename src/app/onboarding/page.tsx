'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'
import { useUser } from '@/hooks/useUser'
import { CLASS_OPTIONS } from '@/lib/school-schedule'
import { getGradeFromEmail } from '@/lib/grade-utils'
import type { ClassLeaderType } from '@/types/database'
import { cn, getErrorMessage } from '@/lib/utils'
import { setWelcomeFlag } from '@/components/WelcomeSheet'
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

type OnboardingStep = 'role' | 'student' | 'teacher'
type LeaderChoice = 'none' | 'leader' | 'vice_leader'

const LEADER_OPTIONS: { value: LeaderChoice; label: string; hint: string }[] = [
  { value: 'none', label: '아니오', hint: '일반 학생' },
  { value: 'leader', label: '반장', hint: '승인 후 반 공지 게시 가능' },
  { value: 'vice_leader', label: '부반장', hint: '승인 후 반 공지 게시 가능' },
]

const GRADE_OPTIONS = [
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
  { value: 'none', label: '해당 없음' },
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

const MANAGED_GRADES = [1, 2, 3] as const

function defaultDisplayName(user: ReturnType<typeof useUser>['user']) {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  if (typeof metadata.full_name === 'string' && metadata.full_name.trim()) {
    return metadata.full_name.trim()
  }
  if (typeof metadata.name === 'string' && metadata.name.trim()) {
    return metadata.name.trim()
  }
  return user?.email?.split('@')[0] ?? ''
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading } = useUser()

  const [step, setStep] = useState<OnboardingStep>('role')
  const [submitting, setSubmitting] = useState(false)

  // Student form
  const [gradeSelection, setGradeSelection] = useState<string>('')
  const [classNumber, setClassNumber] = useState<string>('')
  const [leaderChoice, setLeaderChoice] = useState<LeaderChoice>('none')

  // Teacher form
  const [subject, setSubject] = useState('')
  const [managedGrades, setManagedGrades] = useState<number[]>([])
  const [officeLocation, setOfficeLocation] = useState('')
  const [displayName, setDisplayName] = useState('')

  const email = user?.email ?? ''
  const autoGrade = useMemo(() => getGradeFromEmail(email), [email])
  const hasAutoGrade = autoGrade !== null
  const needsManualGrade = !hasAutoGrade
  const suggestStudent = /^\d/.test(email)

  useEffect(() => {
    if (!loading && profile?.onboarded) {
      router.replace('/calendar')
    }
  }, [profile?.onboarded, loading, router])

  useEffect(() => {
    if (hasAutoGrade && autoGrade) {
      setGradeSelection(String(autoGrade))
    }
  }, [hasAutoGrade, autoGrade])

  useEffect(() => {
    if (user) {
      setDisplayName(defaultDisplayName(user))
    }
  }, [user])

  const gradeChosen = gradeSelection !== ''
  const isNoneGrade = gradeSelection === 'none'
  const classRequired = gradeChosen && !isNoneGrade

  const canSubmitStudent =
    !submitting &&
    gradeChosen &&
    (!classRequired || classNumber !== '')

  const canSubmitTeacher =
    !submitting &&
    subject !== '' &&
    managedGrades.length > 0 &&
    displayName.trim().length > 0

  const finishOnboarding = (variant: 'student' | 'teacher') => {
    setWelcomeFlag(variant)
    router.replace('/calendar')
    router.refresh()
  }

  const handleStudentSubmit = async () => {
    if (!user || !canSubmitStudent) return
    setSubmitting(true)
    try {
      const supabase = createClient()

      const finalGrade =
        isNoneGrade || gradeSelection === '' ? null : Number(gradeSelection)
      const finalClass =
        classRequired && classNumber ? Number(classNumber) : null

      const leaderType: ClassLeaderType | null =
        leaderChoice === 'none' || !classRequired ? null : leaderChoice
      const leaderStatus =
        leaderChoice === 'none' || !classRequired ? 'none' : 'pending'

      const { error } = await supabase
        .from('users')
        .update({
          role: 'student',
          grade: finalGrade,
          class_number: finalClass,
          class_leader_type: leaderType,
          class_leader_status: leaderStatus,
          onboarded: true,
        })
        .eq('id', user.id)
      if (error) throw error

      finishOnboarding('student')
    } catch (err) {
      console.error('Student onboarding failed:', err)
      toast.error(`저장에 실패했어요: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTeacherSubmit = async () => {
    if (!user || !canSubmitTeacher) return
    setSubmitting(true)
    try {
      const supabase = createClient()
      const trimmedName = displayName.trim()

      const { error: userError } = await supabase
        .from('users')
        .update({
          name: trimmedName,
          role: 'student',
          teacher_status: 'pending',
          onboarded: true,
        })
        .eq('id', user.id)
      if (userError) throw userError

      const { error: teacherError } = await supabase.from('teachers').insert({
        user_id: user.id,
        name: trimmedName,
        subject,
        office_location: officeLocation.trim(),
        managed_grades: managedGrades.sort(),
        managed_classes: [],
        is_self_registered: true,
        current_status: 'unknown',
      })
      if (teacherError) throw teacherError

      toast.success('가입 신청이 완료됐어요. 관리자 승인을 기다려주세요.')
      finishOnboarding('teacher')
    } catch (err) {
      console.error('Teacher onboarding failed:', err)
      toast.error(`저장에 실패했어요: ${getErrorMessage(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleManagedGrade = (grade: number) => {
    setManagedGrades((prev) =>
      prev.includes(grade)
        ? prev.filter((g) => g !== grade)
        : [...prev, grade].sort()
    )
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
          {step === 'role' ? (
            <>
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-zinc-900">
                  <span className="text-lg font-bold text-white">B</span>
                </div>
                <CardTitle className="text-xl">어떤 계정으로 시작할까요?</CardTitle>
                <CardDescription>
                  역할을 선택하면 맞춤 온보딩을 진행할 수 있어요.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <button
                  type="button"
                  onClick={() => setStep('student')}
                  className={cn(
                    'relative flex items-start gap-4 rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-900',
                    suggestStudent && 'ring-1 ring-indigo-200'
                  )}
                >
                  <span className="text-3xl" aria-hidden>
                    🎓
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-zinc-900">
                        학생이에요
                      </span>
                      {suggestStudent && (
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                          추천
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      반·일정·자료를 이용해요
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('teacher')}
                  className="flex items-start gap-4 rounded-lg border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-900"
                >
                  <span className="text-3xl" aria-hidden>
                    👩‍🏫
                  </span>
                  <div>
                    <span className="text-base font-semibold text-zinc-900">
                      선생님이에요
                    </span>
                    <p className="mt-1 text-sm text-zinc-500">
                      자료 등록·학생 소통 (승인 필요)
                    </p>
                  </div>
                </button>
              </CardContent>
            </>
          ) : step === 'student' ? (
            <>
              <CardHeader>
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-800"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  뒤로
                </button>
                <CardTitle className="text-xl">학생 정보 입력</CardTitle>
                <CardDescription>
                  학년과 반을 알려주면 맞춤 화면을 보여드릴게요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="grade-select">
                    학년 <span className="text-red-500">*</span>
                  </Label>
                  {hasAutoGrade ? (
                    <div className="flex h-9 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                      {autoGrade}학년
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
                      학번 형식이 아닌 이메일이라 자동 판별되지 않았어요. 학교
                      학생이 아닌 경우 &quot;해당 없음&quot;을 선택하세요.
                    </p>
                  )}
                </div>

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
                              <div className="text-xs opacity-70">
                                {opt.hint}
                              </div>
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
                  onClick={handleStudentSubmit}
                  disabled={!canSubmitStudent}
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
            </>
          ) : (
            <>
              <CardHeader>
                <button
                  type="button"
                  onClick={() => setStep('role')}
                  className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-800"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  뒤로
                </button>
                <CardTitle className="text-xl">선생님 정보 입력</CardTitle>
                <CardDescription>
                  선생님 계정은 관리자 승인 후 활성화돼요. 승인 전까지는 학생
                  화면으로 이용할 수 있어요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="teacher-name">표시 이름</Label>
                  <Input
                    id="teacher-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="선생님 이름"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="teacher-subject">
                    담당 과목 <span className="text-red-500">*</span>
                  </Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger id="teacher-subject" className="h-9 w-full">
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

                <div className="space-y-2">
                  <Label>
                    담당 학년 <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {MANAGED_GRADES.map((g) => {
                      const active = managedGrades.includes(g)
                      return (
                        <button
                          key={g}
                          type="button"
                          onClick={() => toggleManagedGrade(g)}
                          className={cn(
                            'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
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
                  <Label htmlFor="teacher-office">교과 연구실 위치</Label>
                  <Input
                    id="teacher-office"
                    value={officeLocation}
                    onChange={(e) => setOfficeLocation(e.target.value)}
                    placeholder='예: "3층 수학교과연구실"'
                  />
                </div>

                <Button
                  onClick={handleTeacherSubmit}
                  disabled={!canSubmitTeacher}
                  className="h-10 w-full rounded-lg bg-zinc-900 text-white hover:bg-zinc-800"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      <span className="ml-1">저장 중…</span>
                    </>
                  ) : (
                    '가입 신청하기'
                  )}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
