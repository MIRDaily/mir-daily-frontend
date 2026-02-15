'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getUnreadCount } from '@/service/api/notifications'

type NotificationsContextValue = {
  unreadCount: number
  unreadLoading: boolean
  refreshUnreadCount: (options?: { debounced?: boolean }) => void
  decrementUnread: () => void
  clearUnread: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadLoading, setUnreadLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const runRefresh = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setUnreadLoading(true)
    try {
      const payload = await getUnreadCount({ signal: controller.signal })
      const value = Number(payload?.unreadCount ?? 0)
      setUnreadCount(Number.isFinite(value) ? Math.max(0, value) : 0)
    } catch {
      // Non-blocking; UI keeps last known count.
    } finally {
      if (!controller.signal.aborted) {
        setUnreadLoading(false)
      }
    }
  }, [])

  const refreshUnreadCount = useCallback(
    (options?: { debounced?: boolean }) => {
      if (!options?.debounced) {
        void runRefresh()
        return
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(() => {
        void runRefresh()
      }, 220)
    },
    [runRefresh],
  )

  const decrementUnread = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const clearUnread = useCallback(() => {
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    void runRefresh()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [runRefresh])

  const value = useMemo(
    () => ({
      unreadCount,
      unreadLoading,
      refreshUnreadCount,
      decrementUnread,
      clearUnread,
    }),
    [clearUnread, decrementUnread, refreshUnreadCount, unreadCount, unreadLoading],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotificationsContext debe usarse dentro de NotificationsProvider')
  }
  return ctx
}
