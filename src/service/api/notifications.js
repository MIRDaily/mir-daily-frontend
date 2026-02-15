'use client'

import { supabase } from '@/lib/supabaseBrowser'

const API_BASE = process.env.NEXT_PUBLIC_API_URL
const MAX_RETRIES = 2

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (error || !token) {
    throw new Error('No hay sesion activa.')
  }
  return token
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithAuth(path, options = {}) {
  if (!API_BASE) {
    throw new Error('API_URL no definida: revisa variables de entorno')
  }
  const token = await getAccessToken()
  const url = `${API_BASE}${path}`
  const {
    method = 'GET',
    body,
    headers = {},
    signal,
    retries = MAX_RETRIES,
  } = options

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message =
          payload?.error ??
          payload?.message ??
          `Error (${response.status})`
        if (response.status >= 500 && attempt < retries) {
          await sleep(180 * (attempt + 1))
          continue
        }
        throw new Error(message)
      }

      return response.json().catch(() => ({}))
    } catch (error) {
      if (signal?.aborted) throw error
      if (attempt >= retries) throw error
      await sleep(180 * (attempt + 1))
    }
  }

  throw new Error('No se pudo completar la solicitud.')
}

/**
 * @param {{
 *   filter?: string
 *   limit?: number
 *   cursor?: string
 *   signal?: AbortSignal
 * }} [options]
 */
export async function getNotifications(options = {}) {
  const {
    filter = 'all',
    limit = 20,
    cursor,
    signal,
  } = options
  const params = new URLSearchParams()
  params.set('filter', filter)
  params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  return fetchWithAuth(`/api/notifications?${params.toString()}`, { signal })
}

export async function getUnreadCount({ signal } = {}) {
  return fetchWithAuth('/api/notifications/unread-count', { signal })
}

export async function markNotificationRead(id) {
  return fetchWithAuth(`/api/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllNotificationsRead(filter) {
  return fetchWithAuth('/api/notifications/read-all', {
    method: 'POST',
    body: filter ? { filter } : {},
  })
}

export function formatNotificationTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'Hace unos minutos'
  if (diffHours < 24) return `Hace ${diffHours} h`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const sameDay =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  if (sameDay) return 'Ayer'

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function resolveNotificationIcon(item) {
  const icon = String(item?.icon ?? '').trim().toLowerCase()
  const kind = String(item?.kind ?? '').trim().toLowerCase()
  const title = String(item?.title ?? '').trim().toLowerCase()

  if (
    icon.includes('daily') ||
    title.includes('daily') ||
    kind === 'study'
  ) {
    return 'mail'
  }

  if (icon && /^[a-z0-9_]+$/.test(icon)) {
    return icon
  }

  return 'notifications'
}
