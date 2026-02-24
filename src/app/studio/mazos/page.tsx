'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'

type Deck = {
  id: string | number
  name: string
  subject?: string | null
  totalItems?: number | null
  masteryPercentage?: number | null
  dueToday?: number | null
  deleted_at?: string | null
}

type DeckTheme = {
  cardClass: string
  badgeClass: string
  progressClass: string
  dueValueClass: string
  subjectClass: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL no definida.')
}

function toSafeNumber(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

function clampPercent(value: unknown): number {
  const num = toSafeNumber(value)
  if (num < 0) return 0
  if (num > 100) return 100
  return Math.round(num)
}

function getDeckTheme(subject?: string | null): DeckTheme {
  const value = String(subject || '').toLowerCase()

  if (value.includes('cardio')) {
    return {
      cardClass: 'bg-gradient-to-br from-[#EEF5EE] to-white border border-[#E6EFE6]',
      badgeClass: 'bg-white/80 text-slate-500',
      progressClass: 'bg-emerald-500',
      dueValueClass: 'text-[#8BA888]',
      subjectClass: 'text-[#7FA07B]',
    }
  }

  if (value.includes('neuro')) {
    return {
      cardClass: 'bg-gradient-to-br from-[#EEF2F7] to-white border border-[#E5EAF1]',
      badgeClass: 'bg-white/80 text-slate-500',
      progressClass: 'bg-slate-500',
      dueValueClass: 'text-[#7D8A96]',
      subjectClass: 'text-[#7D8A96]',
    }
  }

  if (value.includes('infecc')) {
    return {
      cardClass: 'bg-gradient-to-br from-[#FFF4EC] to-white border border-[#F6E7DB]',
      badgeClass: 'bg-white/80 text-slate-500',
      progressClass: 'bg-emerald-500',
      dueValueClass: 'text-[#E8A598]',
      subjectClass: 'text-[#C79374]',
    }
  }

  return {
    cardClass: 'bg-gradient-to-br from-[#FCEEE9] to-white border border-[#F2E3DE]',
    badgeClass: 'bg-white/80 text-slate-500',
    progressClass: 'bg-emerald-500',
    dueValueClass: 'text-[#E8A598]',
    subjectClass: 'text-[#D49A8D]',
  }
}

async function readError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = (await res.json().catch(() => null)) as
      | { message?: string; error?: string }
      | null
    if (payload?.message) return payload.message
    if (payload?.error) return payload.error
  }
  const text = await res.text().catch(() => '')
  return text || fallback
}

async function fetchDecks(token: string): Promise<Deck[]> {
  const res = await fetch(`${API_URL}/api/studio/decks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudieron cargar los mazos (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as
    | Deck[]
    | { decks?: Deck[] }
    | null

  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.decks)) return payload.decks
  return []
}

async function createDeck(token: string, name: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/studio/decks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo crear el mazo (${res.status})`))
  }
}

async function fetchDeckItemsCount(deckId: string): Promise<number> {
  const { count, error } = await supabase
    .from('deck_items')
    .select('id', { count: 'exact', head: true })
    .eq('deck_id', deckId)
    .is('deleted_at', null)

  if (error) {
    throw new Error(error.message || 'No se pudo contar los items del mazo.')
  }

  return typeof count === 'number' ? count : 0
}

function DeckCard({
  deck,
  onStudy,
  onEdit,
}: {
  deck: Deck
  onStudy: () => void
  onEdit: () => void
}) {
  const mastery = clampPercent(deck.masteryPercentage)
  const totalItems = Math.max(0, Math.round(toSafeNumber(deck.totalItems)))
  const dueToday = Math.max(0, Math.round(toSafeNumber(deck.dueToday)))
  const subject = (deck.subject || 'PERSONAL').toUpperCase()
  const theme = getDeckTheme(deck.subject)

  return (
    <article
      className={`rounded-2xl p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${theme.cardClass}`}
    >
      <p className={`text-xs uppercase tracking-wide ${theme.subjectClass}`}>{subject}</p>

      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-800">{deck.name || `Mazo ${deck.id}`}</h3>
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${theme.badgeClass}`}>
          {totalItems} cards
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Dominio</span>
          <span>{mastery}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${theme.progressClass}`}
            style={{ width: `${mastery}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
        <span className="text-sm font-medium text-slate-500">Para hoy</span>
        <span className={`text-lg font-bold ${theme.dueValueClass}`}>{dueToday}</span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onStudy}
          className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Estudiar
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
        >
          Editar
        </button>
      </div>
    </article>
  )
}

export default function StudioDecksPage() {
  const router = useRouter()
  const [token, setToken] = useState<string>('')
  const [decks, setDecks] = useState<Deck[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [decksError, setDecksError] = useState<string | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [isCreatingDeck, setIsCreatingDeck] = useState(false)

  const loadDecks = useCallback(async (authToken: string) => {
    setDecksLoading(true)
    setDecksError(null)
    try {
      const result = await fetchDecks(authToken)
      const activeDecks = result.filter((deck) => deck.deleted_at == null)
      const counts = await Promise.all(
        activeDecks.map(async (deck) => {
          try {
            const count = await fetchDeckItemsCount(String(deck.id))
            return [String(deck.id), count] as const
          } catch (err) {
            console.error(err)
            return [String(deck.id), toSafeNumber(deck.totalItems)] as const
          }
        }),
      )

      const countMap = Object.fromEntries(counts)
      setDecks(
        activeDecks.map((deck) => ({
          ...deck,
          totalItems: countMap[String(deck.id)] ?? toSafeNumber(deck.totalItems),
        })),
      )
    } catch (err) {
      setDecksError(
        err instanceof Error ? err.message : 'No se pudieron cargar los mazos.',
      )
    } finally {
      setDecksLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadSessionAndDecks = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      if (!mounted) return

      if (!accessToken) {
        setDecksError('No hay sesion activa.')
        setDecksLoading(false)
        return
      }

      setToken(accessToken)
      await loadDecks(accessToken)
    }

    void loadSessionAndDecks()

    return () => {
      mounted = false
    }
  }, [loadDecks])

  const sortedDecks = useMemo(
    () =>
      [...decks].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'es', {
          sensitivity: 'base',
        }),
      ),
    [decks],
  )

  const handleCreateDeck = async () => {
    if (!token) return
    const trimmedName = newDeckName.trim()
    if (!trimmedName) return

    setDecksError(null)
    setIsCreatingDeck(true)
    try {
      await createDeck(token, trimmedName)
      setNewDeckName('')
      setShowCreateForm(false)
      await loadDecks(token)
    } catch (err) {
      setDecksError(err instanceof Error ? err.message : 'No se pudo crear el mazo.')
    } finally {
      setIsCreatingDeck(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Studio
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-800">
              Tus mazos
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Crear mazo
          </button>
        </section>

        {showCreateForm ? (
          <section className="mb-6 rounded-2xl border border-[#EAE4E2] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={newDeckName}
                onChange={(event) => setNewDeckName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleCreateDeck()
                  }
                }}
                placeholder="Nombre del mazo..."
                className="h-11 flex-1 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 text-sm outline-none focus:border-[#E8A598]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateDeck()}
                  disabled={isCreatingDeck || !newDeckName.trim()}
                  className="h-11 rounded-xl bg-[#E8A598] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCreatingDeck ? 'Creando...' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewDeckName('')
                  }}
                  className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-slate-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {decksError ? (
          <p className="mb-6 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
            {decksError}
          </p>
        ) : null}

        {decksLoading ? (
          <div className="rounded-2xl border border-dashed border-[#EAE4E2] bg-white p-8 text-center text-sm text-slate-500">
            Cargando mazos...
          </div>
        ) : sortedDecks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#EAE4E2] bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Aun no tienes mazos</p>
            <p className="mt-1 text-sm text-slate-500">
              Crea tu primer mazo para empezar a organizar tu estudio.
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {sortedDecks.map((deck) => (
              <DeckCard
                key={String(deck.id)}
                deck={deck}
                onStudy={() => router.push(`/studio/${deck.id}`)}
                onEdit={() => router.push(`/studio/${deck.id}`)}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
