import Link from 'next/link'
import { ArrowDownIcon } from 'lucide-react'
import FeatureCards from '@/components/marketing/FeatureCards'
import StartButton from '@/components/marketing/StartButton'

function BizzLogo({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const box =
    size === 'lg'
      ? 'h-14 w-14 rounded-2xl'
      : 'h-8 w-8 rounded-lg'
  const letter = size === 'lg' ? 'text-2xl' : 'text-sm'

  return (
    <div
      className={`flex ${box} items-center justify-center bg-white`}
    >
      <span className={`${letter} font-bold text-zinc-900`}>B</span>
    </div>
  )
}

function GradientBlobs({ subtle = false }: { subtle?: boolean }) {
  if (subtle) {
    return (
      <>
        <div className="absolute left-1/3 top-24 h-80 w-80 rounded-full bg-indigo-600/20 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-violet-600/15 blur-[100px]" />
      </>
    )
  }

  return (
    <>
      <div className="absolute left-1/4 top-20 h-96 w-96 rounded-full bg-indigo-600/30 blur-[100px]" />
      <div className="absolute right-1/4 top-40 h-80 w-80 rounded-full bg-violet-600/30 blur-[100px]" />
      <div className="absolute bottom-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-600/30 blur-[100px]" />
    </>
  )
}

export default function LandingPage({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div className="bg-zinc-950 text-white">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">
        <GradientBlobs />

        <nav className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <BizzLogo />
            <span className="text-sm font-semibold tracking-tight text-white">
              BIZZ
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
          >
            로그인
          </Link>
        </nav>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-8 text-center">
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-7xl">
            학교 생활의
            <br />
            모든 순간을, 한 곳에.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-lg text-zinc-400">
            선생님을 찾고, 일정을 챙기고, 자료를 모으는 그 모든 불편함을
            끝내세요
          </p>
          <StartButton isLoggedIn={isLoggedIn} variant="hero" />
        </div>

        <div className="relative z-10 flex justify-center pb-10">
          <ArrowDownIcon className="h-5 w-5 animate-bounce text-zinc-500" />
        </div>
      </section>

      <FeatureCards />

      {/* Bottom CTA */}
      <section className="relative overflow-hidden bg-zinc-950 px-6 py-24 text-center sm:px-10">
        <GradientBlobs subtle />
        <div className="relative z-10 mx-auto max-w-lg">
          <p className="text-xl font-semibold text-white sm:text-2xl">
            학교 계정으로 3초 만에 시작하세요
          </p>
          <StartButton isLoggedIn={isLoggedIn} variant="cta" />
          <p className="mt-12 text-xs text-zinc-500">
            BIZZ · 우리 학교 학생들이 만든 서비스
          </p>
        </div>
      </section>
    </div>
  )
}
