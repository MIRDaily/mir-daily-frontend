import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type SupabaseCookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        try {
          if ('set' in cookieStore) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        } catch {
          // ignore in server components
        }
      },
    },
  })
}

export async function getUserAndToken() {
  const supabase = await createSupabaseServerClient()

  // 🔐 VALIDAR USUARIO
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // 🔑 OBTENER TOKEN
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const accessToken = session?.access_token

  if (!accessToken) {
    throw new Error('No access token disponible')
  }

  return { user, accessToken }
}
