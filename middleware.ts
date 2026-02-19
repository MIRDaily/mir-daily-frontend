import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string): string | undefined {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any): void {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any): void {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  if (pathname.startsWith('/auth/callback')) {
    return response
  }

  if (pathname.startsWith('/auth') && session) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/complete-profile') && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/onboarding') && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/dashboard') && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  if (pathname.startsWith('/panel') && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/auth/:path*', '/dashboard/:path*', '/panel/:path*', '/complete-profile', '/onboarding'],
}
