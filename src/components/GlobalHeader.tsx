'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

type HeaderTab = 'studio' | 'library' | 'daily' | 'dashboard' | 'zen' | null

function shouldShowHeader(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/panel') ||
    pathname.startsWith('/studio') ||
    pathname.startsWith('/decks') ||
    pathname.startsWith('/session') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/zen') ||
    pathname.startsWith('/library')
  )
}

function resolveActiveTab(pathname: string): HeaderTab {
  if (pathname.startsWith('/studio') || pathname.startsWith('/decks') || pathname.startsWith('/session')) return 'studio'
  if (pathname.startsWith('/library')) return 'library'
  if (pathname.startsWith('/panel')) return 'dashboard'
  if (pathname.startsWith('/dashboard')) return 'daily'
  if (pathname.startsWith('/zen')) return 'zen'
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
