'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'

type Deck = {
  id: string | number
  name?: string | null
  title?: string | null
  deleted_at?: string | null
}

type QuestionOption = {
  id?: string | number | null
  option_index?: number | null
  option_text?: string | null
  is_correct?: boolean | null
}

type ItemQuestion = {
  statement?: string | null
  question_options?: QuestionOption[] | null
}

type Item = {
  id: string | number
  statement?: string | null
  questions?: ItemQuestion | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

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
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')

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

async function fetchDeckItems(token: string, deckId: string): Promise<Item[]> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')

  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/items`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudieron cargar los items (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as
    | Item[]
    | { items?: Item[] }
    | null

  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.items)) return payload.items
  return []
}

function getSortedQuestionOptions(item: Item): QuestionOption[] {
  const options = item.questions?.question_options
  if (!Array.isArray(options)) return []

  return options
    .map((option, originalIndex) => ({ option, originalIndex }))
    .filter(
      (
        entry,
      ): entry is { option: QuestionOption & { option_text: string }; originalIndex: number } =>
        Boolean(entry.option) &&
        typeof entry.option.option_text === 'string' &&
        entry.option.option_text.trim().length > 0,
    )
    .sort((a, b) => {
      const orderA =
        typeof a.option.option_index === 'number' ? a.option.option_index : Number.MAX_SAFE_INTEGER
      const orderB =
        typeof b.option.option_index === 'number' ? b.option.option_index : Number.MAX_SAFE_INTEGER

      if (orderA !== orderB) return orderA - orderB
      return a.originalIndex - b.originalIndex
    })
    .map(({ option }) => option)
}

function getOptionLetter(option: QuestionOption, fallbackIndex: number): string {
  const index = typeof option.option_index === 'number' ? option.option_index : fallbackIndex
  const safeIndex = Number.isFinite(index) && index >= 0 ? Math.floor(index) : fallbackIndex
  return String.fromCharCode(65 + safeIndex)
}

export default function StudioDeckDetailPage() {
  const params = useParams<{ deckId: string }>()
  const deckId = String(params?.deckId ?? '')

  const [deck, setDeck] = useState<Deck | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyMode, setStudyMode] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)
      setDeck(null)
      setItems([])

      try {
        if (!deckId) {
          throw new Error('deckId no valido.')
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        const token = session?.access_token ?? ''

        if (!token) {
          throw new Error('No hay sesion activa.')
        }

        const [allDecks, deckItems] = await Promise.all([
          fetchDecks(token),
          fetchDeckItems(token, deckId),
        ])

        const selectedDeck =
          allDecks.find((current) => String(current.id) === deckId && current.deleted_at == null) ??
          null

        if (!mounted) return

        setDeck(selectedDeck)
        setItems(deckItems)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el mazo.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadData()

    return () => {
      mounted = false
    }
  }, [deckId])

  if (loading) return <div>Cargando...</div>

  if (error) return <div>Error: {error}</div>

  if (!deck) return <div>Mazo no encontrado</div>

  if (studyMode && items.length > 0) {
    const currentItem = items[currentIndex]
    const currentOptions = currentItem ? getSortedQuestionOptions(currentItem) : []

    return (
      <div className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Modo estudio</h2>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div>
            {currentItem?.questions?.statement ||
              currentItem?.statement ||
              `Item ${currentIndex + 1}`}
          </div>
          {currentOptions.length > 0 && (
            <div className="mt-4 space-y-2">
              {currentOptions.map((option, optionIndex) => (
                <div
                  key={String(option.id ?? `${option.option_index ?? optionIndex}-${optionIndex}`)}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm font-semibold text-slate-500">
                    {getOptionLetter(option, optionIndex)}
                  </span>
                  <span className="text-sm text-slate-800">{option.option_text}</span>
                  {option.is_correct ? (
                    <span className="ml-auto text-xs font-semibold text-emerald-700">
                      Correcta
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            className="rounded-lg border px-4 py-2 disabled:opacity-50"
          >
            Anterior
          </button>

          <button
            disabled={currentIndex === items.length - 1}
            onClick={() => setCurrentIndex((prev) => prev + 1)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-white disabled:opacity-50"
          >
            Siguiente
          </button>

          <button
            onClick={() => {
              setStudyMode(false)
              setCurrentIndex(0)
            }}
            className="rounded-lg border px-4 py-2"
          >
            Salir
          </button>
        </div>
      </div>
    )
  }

  const deckTitle = deck.name || deck.title || `Mazo ${deckId}`

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workspace de aprendizaje
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{deckTitle}</h1>
          </div>

          <button
            type="button"
            onClick={() => setStudyMode(true)}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Estudiar
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{items.length}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pendientes
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ultima sesion
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">--</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Preguntas</h2>
            <span className="text-sm text-slate-500">{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-600">Este mazo no tiene items.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, index) => (
                <li key={String(item.id)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pregunta {index + 1}
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {item.questions?.statement?.trim() ||
                      item.statement?.trim() ||
                      `Item ${index + 1}`}
                  </p>
                  {getSortedQuestionOptions(item).length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {getSortedQuestionOptions(item).map((option, optionIndex) => (
                        <div
                          key={String(option.id ?? `${String(item.id)}-${option.option_index ?? optionIndex}`)}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <span className="text-xs font-semibold text-slate-500">
                            {getOptionLetter(option, optionIndex)}
                          </span>
                          <span className="text-sm text-slate-700">{option.option_text}</span>
                          {option.is_correct ? (
                            <span className="ml-auto text-xs font-semibold text-emerald-700">
                              Correcta
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
