import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieOptions = {
  domain?: string
  path?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin)
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const appOrigin = url.searchParams.get('app_origin')

  if (appOrigin && isLocalhostOrigin(appOrigin)) {
    const currentHost = url.hostname
    const targetHost = new URL(appOrigin).hostname

    if (currentHost !== targetHost) {
      const localUrl = new URL('/auth/callback', appOrigin)
      url.searchParams.forEach((value, key) => {
        localUrl.searchParams.set(key, value)
      })
      return NextResponse.redirect(localUrl)
    }
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  const response = NextResponse.redirect(
    new URL('/dashboard', request.url)
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string): string | undefined {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions): void {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions): void {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  await supabase.auth.exchangeCodeForSession(code)

  return response
}
