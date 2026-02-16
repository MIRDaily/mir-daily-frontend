'use client'

import { AuthProvider } from '@/providers/AuthProvider'
import { HeaderUIProvider } from '@/providers/HeaderUIProvider'
import { NotificationsProvider } from '@/providers/NotificationsProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HeaderUIProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </HeaderUIProvider>
    </AuthProvider>
  )
}
