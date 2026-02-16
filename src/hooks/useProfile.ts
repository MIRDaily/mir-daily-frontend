'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { AVATAR_CATALOG } from '@/lib/avatar'
import { parseApiError, USERNAME_REGEX } from '@/lib/profile'
import type { AuthUser } from '@/providers/AuthProvider'

export type UserProfile = AuthUser

const AVATAR_CATALOG_SET = new Set<number>(AVATAR_CATALOG)
const USERNAME_LOCK_STORAGE_KEY = 'profile.username_lock_until'

type UpdateResult = {
  ok: boolean
  error?: string
}

type UsernameUpdateResult = UpdateResult & {
  nextAvailableAt?: string
}

export function useProfile() {
  const { user, loading, setUser, refreshUser } = useAuth()
  const authenticatedFetch = useAuthenticatedFetch()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

  const [error, setError] = useState<string | null>(null)
  const [updatingDisplayName, setUpdatingDisplayName] = useState(false)
  const [updatingAvatar, setUpdatingAvatar] = useState(false)
  const [updatingUsername, setUpdatingUsername] = useState(false)
  const [usernameLockedUntil, setUsernameLockedUntil] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.sessionStorage.getItem(USERNAME_LOCK_STORAGE_KEY)
    if (!stored) return
    const expiresAt = new Date(stored).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(USERNAME_LOCK_STORAGE_KEY)
      return
    }
    setUsernameLockedUntil(stored)
  }, [])

  const refreshProfile = useCallback(async () => {
    setError(null)
    try {
      const next = await refreshUser()
      return !!next
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el perfil.')
      return false
    }
  }, [refreshUser])

  const updateDisplayName = useCallback(
    async (name: string): Promise<UpdateResult> => {
      if (!user) {
        return { ok: false, error: 'Perfil no disponible.' }
      }

      const nextDisplayName = name.trim()
      const previousDisplayName = user.display_name

      setUpdatingDisplayName(true)
      setError(null)
      setUser((prev) => (prev ? { ...prev, display_name: nextDisplayName } : prev))

      try {
        const response = await authenticatedFetch(`${apiUrl}/api/profile/display-name`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ displayName: nextDisplayName }),
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }

        return { ok: true }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo actualizar el nombre.'
        setUser((prev) =>
          prev ? { ...prev, display_name: previousDisplayName } : prev,
        )
        setError(message)
        return { ok: false, error: message }
      } finally {
        setUpdatingDisplayName(false)
      }
    },
    [apiUrl, authenticatedFetch, setUser, user],
  )

  const updateAvatar = useCallback(
    async (avatarId: number): Promise<UpdateResult> => {
      if (!user) {
        return { ok: false, error: 'Perfil no disponible.' }
      }
      if (!AVATAR_CATALOG_SET.has(avatarId)) {
        return { ok: false, error: 'Avatar invalido.' }
      }

      const previousAvatarId = user.avatar_id

      setUpdatingAvatar(true)
      setError(null)
      setUser((prev) => (prev ? { ...prev, avatar_id: avatarId } : prev))

      try {
        const response = await authenticatedFetch(`${apiUrl}/api/profile/avatar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ avatarId }),
        })

        if (!response.ok) {
          throw new Error(await parseApiError(response))
        }
        return { ok: true }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo actualizar el avatar.'
        setUser((prev) => (prev ? { ...prev, avatar_id: previousAvatarId } : prev))
        setError(message)
        return { ok: false, error: message }
      } finally {
        setUpdatingAvatar(false)
      }
    },
    [apiUrl, authenticatedFetch, setUser, user],
  )

  const updateUsername = useCallback(
    async (username: string): Promise<UsernameUpdateResult> => {
      if (!user) {
        return { ok: false, error: 'Perfil no disponible.' }
      }
      const normalizedUsername = username.trim().toLowerCase()
      if (!USERNAME_REGEX.test(normalizedUsername)) {
        return { ok: false, error: 'Username invalido.' }
      }

      setUpdatingUsername(true)
      setError(null)

      try {
        const response = await authenticatedFetch(`${apiUrl}/api/profile/username`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: normalizedUsername }),
        })

        if (response.ok) {
          setUsernameLockedUntil(null)
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(USERNAME_LOCK_STORAGE_KEY)
          }
          await refreshUser()
          return { ok: true }
        }

        if (response.status === 403) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: unknown; nextAvailableAt?: unknown }
            | null
          const message =
            payload && typeof payload.error === 'string'
              ? payload.error
              : 'Username bloqueado temporalmente.'
          const nextAvailableAt =
            payload && typeof payload.nextAvailableAt === 'string'
              ? payload.nextAvailableAt
              : undefined
          if (nextAvailableAt) {
            setUsernameLockedUntil(nextAvailableAt)
            if (typeof window !== 'undefined') {
              window.sessionStorage.setItem(USERNAME_LOCK_STORAGE_KEY, nextAvailableAt)
            }
          }
          setError(message)
          return { ok: false, error: message, nextAvailableAt }
        }

        throw new Error(await parseApiError(response))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo actualizar el username.'
        setError(message)
        return { ok: false, error: message }
      } finally {
        setUpdatingUsername(false)
      }
    },
    [apiUrl, authenticatedFetch, refreshUser, user],
  )

  return useMemo(
    () => ({
      profile: user,
      loading,
      error,
      updatingDisplayName,
      updatingAvatar,
      updatingUsername,
      usernameLockedUntil,
      updateDisplayName,
      updateAvatar,
      updateUsername,
      refreshProfile,
    }),
    [
      error,
      loading,
      refreshProfile,
      updateAvatar,
      updateDisplayName,
      updateUsername,
      updatingAvatar,
      updatingDisplayName,
      updatingUsername,
      user,
      usernameLockedUntil,
    ],
  )
}

