'use client'

import { useCallback } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

// Navegacion dura tras signOut: garantiza que el middleware vea las cookies ya
// borradas y no rebote /auth -> /dashboard (condicion de carrera de la
// navegacion de cliente que dejaba al usuario atascado en el dashboard).
function redirectToAuth() {
  if (typeof window !== 'undefined') {
    window.location.replace('/auth')
  }
}

export function useAuthenticatedFetch() {
  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const { data, error } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (error || !token) {
        await supabase.auth.signOut()
        redirectToAuth()
        throw new Error('No hay sesion activa.')
      }

      const headers = new Headers(init?.headers ?? {})
      headers.set('Authorization', `Bearer ${token}`)

      const response = await fetch(input, {
        ...init,
        headers,
      })

      if (response.status === 401) {
        await supabase.auth.signOut()
        redirectToAuth()
      }

      return response
    },
    [],
  )
}
