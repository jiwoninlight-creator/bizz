'use client'

import {
  FileTextIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    id: 'teacher',
    rotate: '-rotate-[4deg]',
    delay: '0s',
    caption: '선생님을 못 찾아 헤매지 마세요',
    content: (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
            <UserRoundIcon className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">김민수 · 수학</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              자리 있음
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          3-2 교실 · 홀수주 수업
        </div>
      </div>
    ),
  },
  {
    id: 'calendar',
    rotate: 'rotate-[3deg]',
    delay: '0.5s',
    caption: '과제와 시험 일정이 한눈에',
    content: (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'aspect-square rounded-sm bg-zinc-100',
                i === 9 && 'bg-indigo-500'
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900">수학 수행평가 D-3</p>
          <span className="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
            마감
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'materials',
    rotate: '-rotate-[2deg]',
    delay: '1s',
    caption: '카톡 자료 유효기간, 이제 걱정 끝',
    content: (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
            <FileTextIcon className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-zinc-900">
                국어 문학 요약본
              </p>
              <span className="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                NEW
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">국어 · 2학년</p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full w-2/3 rounded-full bg-indigo-500" />
        </div>
      </div>
    ),
  },
  {
    id: 'messages',
    rotate: 'rotate-[4deg]',
    delay: '1.5s',
    caption: '선생님과 바로, 정중하게 소통',
    content: (
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-xs text-white">
            수행평가 제출 기한이 언제인가요?
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100">
            <MessageCircleIcon className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
            금요일 4교시 전까지예요.
          </div>
        </div>
        <p className="pt-1 text-center text-[11px] font-medium text-zinc-400">
          선생님께 질문하기
        </p>
      </div>
    ),
  },
] as const

function FeatureCard({
  feature,
  className,
}: {
  feature: (typeof FEATURES)[number]
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div
        className={cn(
          'group w-64 rounded-2xl bg-white p-5 shadow-2xl shadow-black/20 transition-transform duration-300 hover:z-10 hover:scale-105 hover:rotate-0',
          feature.rotate
        )}
      >
        <div
          className="animate-float group-hover:[animation-play-state:paused]"
          style={{ animationDelay: feature.delay }}
        >
          {feature.content}
        </div>
      </div>
      <p className="max-w-[16rem] text-center text-sm text-zinc-400">
        {feature.caption}
      </p>
    </div>
  )
}

export default function FeatureCards() {
  return (
    <section className="relative bg-zinc-950 px-4 py-24 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <h2 className="mb-16 text-center text-3xl font-bold text-white">
          BIZZ로 할 수 있는 것들
        </h2>

        {/* Desktop: overlapping floating cards */}
        <div className="relative mx-auto hidden min-h-[420px] max-w-4xl md:block">
          <FeatureCard
            feature={FEATURES[0]}
            className="absolute left-0 top-8"
          />
          <FeatureCard
            feature={FEATURES[1]}
            className="absolute left-1/2 top-0 -translate-x-1/2"
          />
          <FeatureCard
            feature={FEATURES[2]}
            className="absolute right-0 top-12"
          />
          <FeatureCard
            feature={FEATURES[3]}
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
          />
        </div>

        {/* Mobile: vertical stack */}
        <div className="flex flex-col items-center gap-10 md:hidden">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
