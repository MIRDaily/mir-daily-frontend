'use client'

import { AuthProvider } from '@/providers/AuthProvider'
import { HeaderUIProvider } from '@/providers/HeaderUIProvider'
import { NotificationsProvider } from '@/providers/NotificationsProvider'
import { ProgressProvider } from '@/providers/ProgressProvider'
import OnboardingGuard from '@/components/auth/OnboardingGuard'
import CelebracionLogros from '@/components/progress/CelebracionLogros'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HeaderUIProvider>
        <NotificationsProvider>
          <ProgressProvider>
            <OnboardingGuard />
            {children}
            {/* Vive aquí para poder aparecer sobre cualquier pantalla, pero no
                se pinta hasta que alguien da permiso al terminar una actividad. */}
            <CelebracionLogros />
          </ProgressProvider>
        </NotificationsProvider>
      </HeaderUIProvider>
    </AuthProvider>
  )
}