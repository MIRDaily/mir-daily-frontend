'use client'

import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import AppHeader from '@/components/AppHeader'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

type HeaderTab = 'studio' | 'library' | 'daily' | 'dashboard' | 'versus' | 'medguess' | null

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
    pathname.startsWith('/versus') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/medguess')
  )
}

function resolveActiveTab(pathname: string): HeaderTab {
  // Zen ya no tiene pestaña propia: se entra desde la tarjeta "Sala Zen" del
  // Studio, así que mantiene esa pestaña marcada en vez de dejar el header sin
  // ninguna activa.
  if (
    pathname.startsWith('/studio') ||
    pathname.startsWith('/decks') ||
    pathname.startsWith('/session') ||
    pathname.startsWith('/zen')
  ) return 'studio'
  if (pathname.startsWith('/library')) return 'library'
  if (pathname.startsWith('/panel')) return 'dashboard'
  if (pathname.startsWith('/dashboard')) return 'daily'
  if (pathname.startsWith('/versus')) return 'versus'
  if (pathname.startsWith('/medguess')) return 'medguess'
  return null
}

export default function GlobalHeader() {
  const pathname = usePathname()
  const { blurred, backAction } = useHeaderUI()

  const visible = useMemo(() => shouldShowHeader(pathname), [pathname])
  const activeTab = useMemo(() => resolveActiveTab(pathname), [pathname])

  if (!visible) return null

  return <AppHeader activeTab={activeTab} blurred={blurred} backAction={backAction} />
}
