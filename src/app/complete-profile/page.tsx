'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { DISPLAY_NAME_REGEX, USERNAME_REGEX, normalizeDisplayNameInput } from '@/lib/profile'
import { checkUsernameAvailability, submitOnboarding } from '@/services/profileOnboardingService'

type UsernameCheckStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'unavailable' | 'error'

function RequiredIndicator() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#E8A598]/12 px-2 py-0.5 align-middle text-[11px] font-semibold text-[#D68C7F]">
      <span className="material-symbols-outlined text-[14px] leading-none">warning</span>
      Obligatorio
    </span>
  )
}

function normalizeUsernameInput(value: string) {
  let normalized = value.trim().toLowerCase()
  if (normalized.includes('@')) {
    normalized = normalized.split('@')[0] ?? ''
  }
  normalized = normalized.replace(/\s+/g, '.')
  normalized = normalized.replace(/[^a-z0-9._]/g, '')
  normalized = normalized.replace(/\.{2,}/g, '.')
  normalized = normalized.replace(/_{2,}/g, '_')
  normalized = normalized.replace(/^[._]+|[._]+$/g, '')
  return normalized.slice(0, 20)
}

export default function CompleteProfilePage() {
  const router = useRouter()
  const { user, loading, refreshUser } = useAuth()
  const authenticatedFetch = useAuthenticatedFetch()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isChecking, setIsChecking] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<UsernameCheckStatus>('idle')
  const [usernameCheckMessage, setUsernameCheckMessage] = useState<string | null>(null)
  const usernameRequestSeqRef = useRef(0)
  const normalizedUsername = normalizeUsernameInput(username)
  const normalizedDisplayName = normalizeDisplayNameInput(displayName)
  const isDisplayNameValid = DISPLAY_NAME_REGEX.test(normalizedDisplayName)
  const isUsernameFormatValid = USERNAME_REGEX.test(normalizedUsername)
  const isSubmitDisabled =
    isSaving ||
    !isDisplayNameValid ||
    !isUsernameFormatValid ||
    usernameCheckStatus === 'checking' ||
    usernameCheckStatus === 'error' ||
    usernameCheckStatus !== 'available'

  useEffect(() => {
    if (loading) return

    let cancelled = false
    const checkProfile = async () => {
      try {
        if (!user) {
          router.replace('/auth')
          return
        }
        if (!cancelled && user.email) {
          setUsername((prev) => prev || normalizeUsernameInput(user.email ?? ''))
        }
        if (user.username) {
          router.replace('/dashboard')
          return
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo validar el perfil.')
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false)
        }
      }
    }

    void checkProfile()
    return () => {
      cancelled = true
    }
  }, [loading, router, user])

  useEffect(() => {
    if (!apiUrl || !user || isChecking) return

    const normalizedUsername = normalizeUsernameInput(username)
    const currentUsername = normalizeUsernameInput(user.username ?? '')

    if (!normalizedUsername) {
      setUsernameCheckStatus('idle')
      setUsernameCheckMessage(null)
      return
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setUsernameCheckStatus('invalid')
      setUsernameCheckMessage('El username debe tener entre 3 y 20 caracteres.')
      return
    }

    if (normalizedUsername === currentUsername) {
      setUsernameCheckStatus('available')
      setUsernameCheckMessage('Disponible')
      return
    }

    const requestSeq = ++usernameRequestSeqRef.current
    const controller = new AbortController()
    setUsernameCheckStatus('checking')
    setUsernameCheckMessage('Comprobando...')

    const timeoutId = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailability(
          apiUrl,
          authenticatedFetch,
          normalizedUsername,
          controller.signal,
        )
        if (requestSeq !== usernameRequestSeqRef.current) return

        if (available) {
          setUsernameCheckStatus('available')
          setUsernameCheckMessage('Disponible')
          return
        }

        setUsernameCheckStatus('unavailable')
        setUsernameCheckMessage('Este nombre de usuario ya está en uso.')
      } catch (err) {
        if (requestSeq !== usernameRequestSeqRef.current) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setUsernameCheckStatus('error')
        setUsernameCheckMessage(
          err instanceof Error ? err.message : 'No se pudo comprobar el username.',
        )
      }
    }, 350)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [apiUrl, authenticatedFetch, isChecking, user, username])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    setUsername(normalizedUsername)
    setDisplayName(normalizedDisplayName)

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setError('El username debe tener entre 3 y 20 caracteres.')
      return
    }

    if (!DISPLAY_NAME_REGEX.test(normalizedDisplayName)) {
      setError('El nombre visible debe tener entre 2 y 16 caracteres.')
      return
    }

    if (usernameCheckStatus !== 'available') {
      if (usernameCheckStatus === 'checking') {
        setError('Comprobando disponibilidad del username...')
        return
      }
      if (usernameCheckStatus === 'unavailable') {
        setError('Este nombre de usuario ya está en uso.')
        return
      }
      if (usernameCheckStatus === 'invalid') {
        setError('El username debe tener entre 3 y 20 caracteres.')
        return
      }
      if (usernameCheckStatus === 'error') {
        setError(usernameCheckMessage ?? 'No se pudo validar el username.')
        return
      }
      setError('Debes validar un username disponible para continuar.')
      return
    }

    if (!apiUrl) {
      setError('API_URL no definida: revisa variables de entorno')
      return
    }

    setIsSaving(true)
    try {
      await submitOnboarding(apiUrl, authenticatedFetch, {
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        medicalYear: null,
        mirSpecialtyId: null,
        mainGoal: null,
        universityId: null,
        customUniversity: null,
        profilePublic: false,
      })
      await refreshUser()
      router.replace('/dashboard')
    } catch (err) {
      if (err instanceof Error && err.message === 'Endpoint no encontrado') {
        setError('No se pudo completar el registro: endpoint no disponible en backend.')
        return
      }
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isChecking) {
    return (
      <main className="min-h-screen bg-[#FAF7F4] flex items-center justify-center text-[#7D8A96]">
        Comprobando perfil...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-[#E9E4E1] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]">
        <h1 className="text-2xl font-bold text-[#2D3748]">Completa tu perfil</h1>
        <p className="mt-2 text-sm text-[#7D8A96]">
          Necesitamos tu username para habilitar el dashboard.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#4B5563]">
              Username
              <RequiredIndicator />
            </span>
            <input
              value={username}
              onChange={(event) => {
                setUsername(normalizeUsernameInput(event.target.value))
                if (error) setError(null)
              }}
              placeholder="tu.username"
              className="w-full rounded-xl border border-[#E9E4E1] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              required
            />
            {usernameCheckStatus !== 'idle' ? (
              <p
                className={`mt-2 text-xs ${
                  usernameCheckStatus === 'available'
                    ? 'text-emerald-700'
                    : usernameCheckStatus === 'checking'
                      ? 'text-[#7D8A96]'
                      : usernameCheckStatus === 'invalid' || usernameCheckStatus === 'unavailable'
                        ? 'text-amber-700'
                        : 'text-red-700'
                }`}
              >
                {usernameCheckMessage}
              </p>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#4B5563]">
              Display name
              <RequiredIndicator />
            </span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(normalizeDisplayNameInput(event.target.value))}
              placeholder="Tu nombre publico"
              className="w-full rounded-xl border border-[#E9E4E1] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30"
              autoComplete="name"
              maxLength={16}
              required
            />
          </label>

          <p className="text-xs text-[#7D8A96]">
            Username: 3-20 caracteres. Display name: 2-16 caracteres.
          </p>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full rounded-xl bg-[#E8A598] px-4 py-3 text-sm font-semibold text-white hover:bg-[#E08E7D] disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </section>
    </main>
  )
}
