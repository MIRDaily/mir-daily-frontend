'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/service/api/notifications'

export type NotificationFilter = 'all' | 'unread' | 'study' | 'system'

export type NotificationItem = {
  id: string
  title: string
  body: string
  kind?: 'study' | 'system' | string
  icon?: string
  unread?: boolean
  createdAt?: string
  actionUrl?: string
  metricValue?: number | string
  metricUnit?: string
}

type UseNotificationsFeedParams = {
  filter: NotificationFilter
  limit?: number
  enabled?: boolean
}

export function useNotificationsFeed({
  filter,
  limit = 20,
  enabled = true,
}: UseNotificationsFeedParams) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchFirstPage = useCallback(async () => {
    if (!enabled) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const hasExistingItems = items.length > 0
    if (hasExistingItems) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const payload = await getNotifications({
        filter,
        limit,
        signal: controller.signal,
      })
      setItems(Array.isArray(payload?.items) ? payload.items : [])
      setNextCursor(typeof payload?.nextCursor === 'string' ? payload.nextCursor : null)
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar notificaciones.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [enabled, filter, items.length, limit])

  useEffect(() => {
    if (!enabled) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchFirstPage()
    }, 180)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [enabled, fetchFirstPage])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!enabled || !nextCursor || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const payload = await getNotifications({
        filter,
        limit,
        cursor: nextCursor,
      })
      const nextItems = Array.isArray(payload?.items) ? payload.items : []
      setItems((prev) => [...prev, ...nextItems])
      setNextCursor(typeof payload?.nextCursor === 'string' ? payload.nextCursor : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar mas notificaciones.')
    } finally {
      setLoadingMore(false)
    }
  }, [enabled, filter, limit, loadingMore, nextCursor])

  const markOneAsRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    )
    try {
      await markNotificationRead(id)
      return true
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, unread: true } : item)),
      )
      return false
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    const previous = items
    setItems((prev) => prev.map((item) => ({ ...item, unread: false })))
    try {
      await markAllNotificationsRead(filter)
      return true
    } catch {
      setItems(previous)
      return false
    }
  }, [filter, items])

  const unreadInView = useMemo(
    () => items.filter((item) => item.unread).length,
    [items],
  )

  return {
    items,
    nextCursor,
    loading,
    refreshing,
    loadingMore,
    error,
    unreadInView,
    refresh: fetchFirstPage,
    loadMore,
    markOneAsRead,
    markAllAsRead,
  }
}
