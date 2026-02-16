'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { parseApiError, USERNAME_REGEX } from '@/lib/profile'

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
  return normalized.slice(0, 30)
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
          setUsername((prev) =>
            prev || normalizeUsernameInput(user.email ?? ''),
          )
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
  }, [apiUrl, authenticatedFetch, loading, router, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const normalizedUsername = normalizeUsernameInput(username)
    const trimmedDisplayName = displayName.trim()
    setUsername(normalizedUsername)

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      setError(
        'Username invalido. Usa 3-30 caracteres: minusculas, numeros, punto y guion bajo (sin @ ni dominio de email).',
      )
      return
    }
    if (!apiUrl) {
      setError('API_URL no definida: revisa variables de entorno')
      return
    }

    setIsSaving(true)
    try {
      const response = await authenticatedFetch(`${apiUrl}/api/profile/complete-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: normalizedUsername,
          displayName: trimmedDisplayName || null,
        }),
      })
      if (response.status === 401) return
      if (response.status === 409) {
        setError('Ese username ya esta en uso.')
        return
      }
      if (!response.ok) {
        throw new Error(await parseApiError(response))
      }
      const payload = await response.json().catch(() => ({}))
      if (payload && typeof payload === 'object' && 'success' in payload && payload.success === false) {
        setError('No se pudo completar el registro.')
        return
      }
      await refreshUser()
      router.replace('/dashboard')
    } catch (err) {
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
            <span className="mb-1 block text-sm font-semibold text-[#4B5563]">Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(normalizeUsernameInput(event.target.value))}
              placeholder="tu.username"
              className="w-full rounded-xl border border-[#E9E4E1] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#4B5563]">Display name (opcional)</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Tu nombre publico"
              className="w-full rounded-xl border border-[#E9E4E1] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E8A598]/30"
              autoComplete="name"
            />
          </label>

          <p className="text-xs text-[#7D8A96]">
            Formato valido: 3-30 caracteres, solo letras minusculas, numeros, punto y guion bajo.
          </p>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-xl bg-[#E8A598] px-4 py-3 text-sm font-semibold text-white hover:bg-[#E08E7D] disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </section>
    </main>
  )
}
