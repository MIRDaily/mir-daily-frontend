'use client'

import { AuthProvider } from '@/providers/AuthProvider'
import { HeaderUIProvider } from '@/providers/HeaderUIProvider'
import { NotificationsProvider } from '@/providers/NotificationsProvider'
import OnboardingGuard from '@/components/auth/OnboardingGuard'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HeaderUIProvider>
        <NotificationsProvider>
          <OnboardingGuard />
          {children}
        </NotificationsProvider>
      </HeaderUIProvider>
    </AuthProvider>
  )
}
