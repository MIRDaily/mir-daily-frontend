'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getOnboardingDeferredFlag } from '@/lib/onboarding'

function isPublicRoute(pathname: string) {
  return pathname === '/auth' || pathname.startsWith('/auth/')
}

export default function OnboardingGuard() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (isPublicRoute(pathname)) return

    const isDeferred = getOnboardingDeferredFlag()

    if (!user.onboarding_completed && pathname !== '/onboarding') {
      router.replace('/onboarding')
      return
    }

    if (user.onboarding_completed && pathname === '/onboarding' && !isDeferred) {
      router.replace('/dashboard')
    }
  }, [loading, pathname, router, user])

  return null
}
