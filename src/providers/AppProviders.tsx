'use client'

import { AuthProvider } from '@/providers/AuthProvider'
import { NotificationsProvider } from '@/providers/NotificationsProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationsProvider>{children}</NotificationsProvider>
    </AuthProvider>
  )
}

