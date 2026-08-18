'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { AVATAR_CATALOG } from '@/lib/avatar'
import { parseApiError, USERNAME_REGEX } from '@/lib/profile'
import {
  updateAcademicProfile,
  type AcademicPayload,
} from '@/services/profileOnboardingService'
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
  const [updatingAcademic, setUpdatingAcademic] = useState(false)
  const [localLockUntil, setLocalLockUntil] = useState<string | null>(null)

  // El bloqueo lo decide el servidor (`username_next_change_at`); la copia en
  // sessionStorage solo cubre el hueco entre el cambio y el siguiente refresco
  // del perfil. Gana la fecha más tardía de las dos.
  const usernameLockedUntil = useMemo(() => {
    const fromServer = user?.username_next_change_at ?? null
    if (!fromServer) return localLockUntil
    if (!localLockUntil) return fromServer
    return new Date(fromServer) > new Date(localLockUntil) ? fromServer : localLockUntil
  }, [localLockUntil, user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.sessionStorage.getItem(USERNAME_LOCK_STORAGE_KEY)
    if (!stored) return
    const expiresAt = new Date(stored).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(USERNAME_LOCK_STORAGE_KEY)
      return
    }
    setLocalLockUntil(stored)
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
        const avatarUrl = `${apiUrl}/api/profile/avatar`
        const requestInit = {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ avatarId }),
        } as const

        let response = await authenticatedFetch(avatarUrl, {
          method: 'POST',
          ...requestInit,
        })

        if (response.status === 404) {
          response = await authenticatedFetch(avatarUrl, {
            method: 'PATCH',
            ...requestInit,
          })
        }

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

  const updateAcademic = useCallback(
    async (payload: AcademicPayload): Promise<UpdateResult> => {
      if (!user) {
        return { ok: false, error: 'Perfil no disponible.' }
      }

      setUpdatingAcademic(true)
      setError(null)

      try {
        await updateAcademicProfile(apiUrl, authenticatedFetch, payload)
        // Sin optimismo aquí: el objetivo o la universidad se muestran ya
        // resueltos (nombre de la facultad, de la especialidad…) y el
        // servidor es quien sabe traducir los ids.
        await refreshUser()
        return { ok: true }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudieron guardar los datos.'
        setError(message)
        return { ok: false, error: message }
      } finally {
        setUpdatingAcademic(false)
      }
    },
    [apiUrl, authenticatedFetch, refreshUser, user],
  )

  const updateUsername = useCallback(
    async (username: string): Promise<UsernameUpdateResult> => {
      if (!user) {
        return { ok: false, error: 'Perfil no disponible.' }
      }
      const normalizedUsername = username.trim().toLowerCase()
      if (!USERNAME_REGEX.test(normalizedUsername)) {
        return { ok: false, error: 'El username debe tener entre 3 y 20 caracteres.' }
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
          // El servidor responde con la fecha en que volverá a poder
          // cambiarse: así el bloqueo se ve al momento y no en la siguiente
          // visita, cuando ya no se entiende de dónde sale.
          const payload = (await response.json().catch(() => null)) as
            | { nextAvailableAt?: unknown }
            | null
          const nextAvailableAt =
            payload && typeof payload.nextAvailableAt === 'string'
              ? payload.nextAvailableAt
              : null

          setLocalLockUntil(nextAvailableAt)
          if (typeof window !== 'undefined') {
            if (nextAvailableAt) {
              window.sessionStorage.setItem(USERNAME_LOCK_STORAGE_KEY, nextAvailableAt)
            } else {
              window.sessionStorage.removeItem(USERNAME_LOCK_STORAGE_KEY)
            }
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
            setLocalLockUntil(nextAvailableAt)
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
      updatingAcademic,
      usernameLockedUntil,
      updateDisplayName,
      updateAvatar,
      updateUsername,
      updateAcademic,
      refreshProfile,
    }),
    [
      error,
      loading,
      refreshProfile,
      updateAcademic,
      updateAvatar,
      updateDisplayName,
      updateUsername,
      updatingAcademic,
      updatingAvatar,
      updatingDisplayName,
      updatingUsername,
      user,
      usernameLockedUntil,
    ],
  )
}
