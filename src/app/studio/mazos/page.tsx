'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'

type Deck = {
  id: string
  name: string
  deleted_at?: string | null
}

type DeckItem = {
  id: string
  question_id?: string | number | null
  questionId?: string | number | null
}

type MockDeckCard = {
  slug: string
  title: string
  subject: string
  cards: number
  dueToday: number
  mastered: number
  color: string
}

const mockDecks: ReadonlyArray<MockDeckCard> = [
  {
    slug: 'digestivo-esofago',
    title: 'Esofago y Estomago',
    subject: 'Digestivo',
    cards: 128,
    dueToday: 24,
    mastered: 68,
    color: 'from-[#FCEEE9] to-white',
  },
  {
    slug: 'cardio-ecg-basico',
    title: 'ECG Basico',
    subject: 'Cardiologia',
    cards: 96,
    dueToday: 15,
    mastered: 72,
    color: 'from-[#EEF5EE] to-white',
  },
  {
    slug: 'neuro-sindromes',
    title: 'Sindrome Neurologico',
    subject: 'Neurologia',
    cards: 84,
    dueToday: 12,
    mastered: 49,
    color: 'from-[#EEF2F7] to-white',
  },
  {
    slug: 'infecciosas-antibioticos',
    title: 'Antibioticos Clave',
    subject: 'Infecciosas',
    cards: 112,
    dueToday: 31,
    mastered: 54,
    color: 'from-[#FFF4EC] to-white',
  },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL

if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL no definida.')
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

async function deleteDeck(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/studio/decks/${id}/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo eliminar el mazo (${res.status})`))
  }
}

async function restoreDeck(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/studio/decks/${id}/restore`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo restaurar el mazo (${res.status})`))
  }
}

async function fetchItems(token: string, id: string): Promise<DeckItem[]> {
  const res = await fetch(`${API_URL}/api/studio/decks/${id}/items`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudieron cargar los items (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as
    | DeckItem[]
    | { items?: DeckItem[] }
    | null
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.items)) return payload.items
  return []
}

async function addItem(
  token: string,
  deckId: string,
  questionId: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ questionId }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo anadir el item (${res.status})`))
  }
}

async function removeItem(
  token: string,
  deckId: string,
  itemId: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/items/${itemId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo eliminar el item (${res.status})`))
  }
}

function deckLabel(deck: Deck): string {
  return deck.name || `Mazo ${deck.id}`
}

function itemQuestionId(item: DeckItem): string {
  const value = item.question_id ?? item.questionId
  if (value == null) return 'Sin ID'
  return String(value)
}

export default function StudioDecksPage() {
  const [token, setToken] = useState<string>('')
  const [decks, setDecks] = useState<Deck[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [decksError, setDecksError] = useState<string | null>(null)

  const [newDeckName, setNewDeckName] = useState('')
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)

  const [items, setItems] = useState<DeckItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [questionId, setQuestionId] = useState('')

  const loadDecks = useCallback(
    async (authToken: string) => {
      setDecksLoading(true)
      setDecksError(null)
      try {
        const result = await fetchDecks(authToken)
        setDecks(result)
        if (!selectedDeckId && result.length > 0) {
          setSelectedDeckId(String(result[0].id))
        } else if (
          selectedDeckId &&
          !result.some((deck) => String(deck.id) === String(selectedDeckId))
        ) {
          setSelectedDeckId(result.length > 0 ? String(result[0].id) : null)
        }
      } catch (err) {
        setDecksError(
          err instanceof Error ? err.message : 'No se pudieron cargar los mazos.',
        )
      } finally {
        setDecksLoading(false)
      }
    },
    [selectedDeckId],
  )

  const loadItems = useCallback(async (authToken: string, deckId: string) => {
    setItemsLoading(true)
    setItemsError(null)
    try {
      const result = await fetchItems(authToken, deckId)
      setItems(result)
    } catch (err) {
      setItemsError(
        err instanceof Error ? err.message : 'No se pudieron cargar los items.',
      )
      setItems([])
    } finally {
      setItemsLoading(false)
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

  useEffect(() => {
    if (!token || !selectedDeckId) {
      setItems([])
      return
    }
    void loadItems(token, selectedDeckId)
  }, [loadItems, selectedDeckId, token])

  const selectedDeck = useMemo(
    () => decks.find((deck) => String(deck.id) === String(selectedDeckId)) ?? null,
    [decks, selectedDeckId],
  )

  const handleCreateDeck = async () => {
    if (!token) return
    const trimmedName = newDeckName.trim()
    if (!trimmedName) return
    setDecksError(null)

    try {
      await createDeck(token, trimmedName)
      setNewDeckName('')
      await loadDecks(token)
    } catch (err) {
      setDecksError(err instanceof Error ? err.message : 'No se pudo crear el mazo.')
    }
  }

  const handleDeleteDeck = async (deckId: string) => {
    if (!token) return
    setDecksError(null)

    try {
      await deleteDeck(token, deckId)
      await loadDecks(token)
    } catch (err) {
      setDecksError(err instanceof Error ? err.message : 'No se pudo eliminar el mazo.')
    }
  }

  const handleRestoreDeck = async (deckId: string) => {
    if (!token) return
    setDecksError(null)

    try {
      await restoreDeck(token, deckId)
      await loadDecks(token)
    } catch (err) {
      setDecksError(err instanceof Error ? err.message : 'No se pudo restaurar el mazo.')
    }
  }

  const handleAddItem = async () => {
    if (!token || !selectedDeckId) return
    const trimmedQuestionId = questionId.trim()
    if (!trimmedQuestionId) {
      setItemsError('Introduce un ID de pregunta.')
      return
    }

    setItemsError(null)
    try {
      await addItem(token, selectedDeckId, trimmedQuestionId)
      setQuestionId('')
      await loadItems(token, selectedDeckId)
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'No se pudo anadir el item.')
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    if (!token || !selectedDeckId) return
    setItemsError(null)
    try {
      await removeItem(token, selectedDeckId, itemId)
      await loadItems(token, selectedDeckId)
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'No se pudo eliminar el item.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] text-[#2C3E50]">
      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        <section className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
              Studio / Mazos
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Gestion de Mazos</h1>
          </div>
          <Link
            href="/studio"
            className="rounded-xl border border-[#EAE4E2] bg-white px-4 py-2 text-sm font-semibold text-[#7D8A96] hover:border-[#E8A598]/50"
          >
            Volver a Studio
          </Link>
        </section>

        <section className="mb-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-[#2c3e50]">Crear mazo</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newDeckName}
              onChange={(event) => setNewDeckName(event.target.value)}
              placeholder="Nombre del mazo..."
              className="h-11 flex-1 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 text-sm outline-none focus:border-[#E8A598]"
            />
            <button
              type="button"
              onClick={() => void handleCreateDeck()}
              className="h-11 rounded-xl bg-[#E8A598] px-5 text-sm font-semibold text-white hover:bg-[#d18d80]"
            >
              Crear
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <article className="rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-[#2c3e50]">Lista de mazos</h2>
            {decksLoading ? <p className="text-sm text-[#7D8A96]">Cargando...</p> : null}
            {decksError ? (
              <p className="mb-3 rounded-lg border border-[#E8A598]/35 bg-[#FFF8F6] px-3 py-2 text-sm text-[#C4655A]">
                {decksError}
              </p>
            ) : null}
            <div className="space-y-2">
              {decks.map((deck) => {
                const id = String(deck.id)
                const isDeleted = deck.deleted_at != null
                return (
                  <div
                    key={id}
                    className="rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="truncate text-sm font-semibold text-[#2c3e50]">
                        {deckLabel(deck)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDeckId(id)}
                          className="rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-xs font-bold text-[#7D8A96] hover:border-[#E8A598]/50"
                        >
                          Ver Items
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteDeck(id)}
                          className="rounded-lg border border-[#E8A598]/40 bg-[#FFF8F6] px-3 py-1.5 text-xs font-bold text-[#C4655A]"
                        >
                          Eliminar
                        </button>
                        {isDeleted ? (
                          <button
                            type="button"
                            onClick={() => void handleRestoreDeck(id)}
                            className="rounded-lg border border-[#8BA888]/35 bg-[#EEF7EE] px-3 py-1.5 text-xs font-bold text-[#8BA888]"
                          >
                            Restaurar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
              {!decksLoading && decks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#EAE4E2] bg-[#FAF7F4] px-3 py-4 text-sm text-[#7D8A96]">
                  No hay mazos todavia.
                </p>
              ) : null}
            </div>
          </article>

          <article className="rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-[#2c3e50]">
              {selectedDeck ? `Items de: ${deckLabel(selectedDeck)}` : 'Items del mazo'}
            </h2>
            {!selectedDeck ? (
              <p className="rounded-lg border border-dashed border-[#EAE4E2] bg-[#FAF7F4] px-3 py-4 text-sm text-[#7D8A96]">
                Selecciona un mazo para gestionar sus items.
              </p>
            ) : (
              <>
                <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={questionId}
                    onChange={(event) => setQuestionId(event.target.value)}
                    placeholder="ID de pregunta..."
                    className="h-10 flex-1 rounded-lg border border-[#EAE4E2] bg-[#FAF7F4] px-3 text-sm outline-none focus:border-[#E8A598]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddItem()}
                    className="h-10 rounded-lg bg-[#8BA888] px-4 text-sm font-semibold text-white hover:bg-[#769573]"
                  >
                    Anadir
                  </button>
                </div>
                {itemsError ? (
                  <p className="mb-3 rounded-lg border border-[#E8A598]/35 bg-[#FFF8F6] px-3 py-2 text-sm text-[#C4655A]">
                    {itemsError}
                  </p>
                ) : null}
                {itemsLoading ? (
                  <p className="text-sm text-[#7D8A96]">Cargando items...</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between rounded-lg border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#2c3e50]">
                            Pregunta #{itemQuestionId(item)}
                          </p>
                          <p className="text-xs text-[#7D8A96]">Item ID: {item.id}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRemoveItem(String(item.id))}
                          className="rounded-md px-2 py-1 text-xs font-bold text-[#C4655A] hover:bg-[#FFF0EE]"
                        >
                          Eliminar item
                        </button>
                      </div>
                    ))}
                    {!itemsLoading && items.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-[#EAE4E2] bg-[#FAF7F4] px-3 py-4 text-sm text-[#7D8A96]">
                        Este mazo no tiene items.
                      </p>
                    ) : null}
                  </div>
                )}
              </>
            )}
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[#2c3e50]">Mockup de Mazos</h2>
            <p className="mt-1 text-sm text-[#7D8A96]">
              Vista visual como referencia de experiencia.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {mockDecks.map((deck) => (
              <article
                key={deck.slug}
                className={`rounded-2xl border border-[#EAE4E2] bg-gradient-to-br ${deck.color} p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
                      {deck.subject}
                    </p>
                    <h3 className="mt-1 text-xl font-bold">{deck.title}</h3>
                  </div>
                  <span className="rounded-lg bg-white/80 px-2 py-1 text-xs font-bold text-[#7D8A96]">
                    {deck.cards} cards
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-[#7D8A96]">
                      <span>Dominio</span>
                      <span>{deck.mastered}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-[#8BA888]"
                        style={{ width: `${deck.mastered}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#EAE4E2] bg-white px-3 py-2 text-sm">
                    <span className="font-medium text-[#7D8A96]">Para hoy</span>
                    <span className="font-bold text-[#E8A598]">{deck.dueToday}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#E8A598] px-3 py-2 text-sm font-semibold text-white hover:bg-[#d18d80]"
                  >
                    Estudiar
                    <span className="material-symbols-outlined text-base">play_arrow</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#EAE4E2] bg-white px-3 py-2 text-sm font-semibold text-[#7D8A96] hover:border-[#E8A598]/50"
                  >
                    Editar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
