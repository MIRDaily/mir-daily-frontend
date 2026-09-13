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

  /* Redirigir SIN perder las cookies que el refresco acaba de escribir.

     `createServerClient` guarda el token renovado en las cookies de
     `response`. Devolver un `NextResponse.redirect(url)` recién creado es
     devolver OTRO objeto, y esas cookies se van con el que se descarta.

     El resultado era un bucle: al refrescar, Supabase rota el refresh token;
     el navegador se queda con el viejo; y como Supabase tolera reusarlo unos
     segundos, la siguiente petición vuelve a refrescar, vuelve a redirigir y
     vuelve a tirar las cookies. La pantalla rebota entre /auth y /dashboard
     varias veces por segundo hasta que el token deja de valer y el usuario
     aparece deslogueado sin haber hecho nada.

     Le pasa a cualquiera que vuelva a una pestaña abierta más de una hora. */
  const redirigirA = (destino: string) => {
    const url = request.nextUrl.clone()
    url.pathname = destino
    const redireccion = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) {
      redireccion.cookies.set(cookie)
    }
    return redireccion
  }

  if (pathname.startsWith('/auth/callback')) {
    return response
  }

  if (pathname.startsWith('/auth') && session) {
    return redirigirA('/dashboard')
  }

  if (pathname.startsWith('/complete-profile') && !session) {
    return redirigirA('/auth')
  }

  if (pathname.startsWith('/onboarding') && !session) {
    return redirigirA('/auth')
  }

  if (pathname.startsWith('/dashboard') && !session) {
    return redirigirA('/auth')
  }

  if (pathname.startsWith('/panel') && !session) {
    return redirigirA('/auth')
  }

  return response
}

export const config = {
  matcher: ['/auth/:path*', '/dashboard/:path*', '/panel/:path*', '/complete-profile', '/onboarding'],
}
