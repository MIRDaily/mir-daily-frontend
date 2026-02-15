'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'

export function useAuthenticatedFetch() {
  const router = useRouter()

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const { data, error } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (error || !token) {
        await supabase.auth.signOut()
        router.replace('/auth')
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
        router.replace('/auth')
      }

      return response
    },
    [router],
  )
}
