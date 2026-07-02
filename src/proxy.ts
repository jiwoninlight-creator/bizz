import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = path === '/login'
  const isLandingPage = path === '/'
  const isAuthCallback = path.startsWith('/auth')
  const isPublicAsset =
    path.startsWith('/_next') || path.includes('.')

  if (isPublicAsset || isAuthCallback) {
    return response
  }

  if (!user) {
    if (isAuthPage || isLandingPage) return response
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPage) {
    return NextResponse.redirect(new URL('/calendar', request.url))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, onboarded')
    .eq('id', user.id)
    .single<{ role: string; onboarded: boolean }>()

  const isOnboardingPage = path === '/onboarding'
  const isAdminPath = path.startsWith('/admin')
  const role = profile?.role
  const onboarded = profile?.onboarded ?? false
  const isAdmin = role === 'admin'

  if (isAdmin && isOnboardingPage) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  if (!isAdmin && !onboarded && !isOnboardingPage) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  if (onboarded && isOnboardingPage) {
    return NextResponse.redirect(new URL('/calendar', request.url))
  }

  if (isAdminPath && !isAdmin) {
    return NextResponse.redirect(new URL('/calendar', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
