import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

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
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'hello@voltastudio.dev'

  const isAuthRoute = ['/login', '/signup', '/verify-email', '/reset-password'].some((r) =>
    pathname.startsWith(r)
  )
  const isDashboard = pathname.startsWith('/dashboard')
  const isWorker = pathname.startsWith('/worker')
  const isOnboarding = pathname.startsWith('/onboarding')
  const isAdmin = pathname.startsWith('/admin')
  const isProtected = isDashboard || isWorker || isOnboarding

  // Admin route — must be authenticated admin email
  if (isAdmin) {
    if (!user || user.email !== ADMIN_EMAIL) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // No session → send to login
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged-in user hitting auth pages → send to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // For protected routes, check email verification and subscription status
  if (user && isProtected) {
    const emailVerified = user.email_confirmed_at != null

    if (!emailVerified) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      return NextResponse.redirect(url)
    }

    // Check subscription status — skip for billing and onboarding to avoid loops
    const skipStatusCheck =
      pathname.startsWith('/billing') || pathname.startsWith('/onboarding')

    if (!skipStatusCheck) {
      const { data: shop } = await supabase
        .from('shops')
        .select('subscription_status')
        .eq('owner_id', user.id)
        .single()

      if (shop?.subscription_status === 'expired') {
        const url = request.nextUrl.clone()
        url.pathname = '/billing'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
