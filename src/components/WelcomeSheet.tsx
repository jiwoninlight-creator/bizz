'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export type WelcomeVariant = 'student' | 'teacher'

const WELCOME_STORAGE_KEY = 'bizz_welcome'

export function setWelcomeFlag(variant: WelcomeVariant) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(WELCOME_STORAGE_KEY, variant)
}

export default function WelcomeSheetGate() {
  const [open, setOpen] = useState(false)
  const [variant, setVariant] = useState<WelcomeVariant>('student')

  useEffect(() => {
    const stored = sessionStorage.getItem(WELCOME_STORAGE_KEY) as
      | WelcomeVariant
      | null
    if (stored === 'student' || stored === 'teacher') {
      setVariant(stored)
      setOpen(true)
      sessionStorage.removeItem(WELCOME_STORAGE_KEY)
    }
  }, [])

  const copy =
    variant === 'teacher'
      ? {
          title: '선생님 가입 신청이 완료됐어요',
          description:
            '관리자 승인 전까지는 학생 화면으로 이용할 수 있어요. 승인되면 자료 등록과 메시지 기능을 사용할 수 있습니다.',
        }
      : {
          title: 'BIZZ에 오신 걸 환영해요',
          description:
            '선생님 찾기, 일정 관리, 수업 자료까지 학교 생활을 한곳에서 시작해 보세요.',
        }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button
            className="w-full bg-zinc-900 text-white hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            시작하기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
