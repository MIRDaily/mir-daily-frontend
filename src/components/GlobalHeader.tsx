'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

type HeaderTab = 'studio' | 'daily' | 'dashboard' | null

function shouldShowHeader(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/studio') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/notifications')
  )
}

function resolveActiveTab(pathname: string): HeaderTab {
  if (pathname.startsWith('/studio')) return 'studio'
  if (pathname.startsWith('/dashboard')) return 'daily'
  return null
}

export default function GlobalHeader() {
  const pathname = usePathname()
  const { blurred } = useHeaderUI()

  const visible = useMemo(() => shouldShowHeader(pathname), [pathname])
  const activeTab = useMemo(() => resolveActiveTab(pathname), [pathname])

  if (!visible) return null

  return <AppHeader activeTab={activeTab} blurred={blurred} />
}

