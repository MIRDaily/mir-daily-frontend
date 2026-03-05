'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
}

type ItemQuestion = {
  statement?: string | null
  correct_answer?: number | string | null
  question_options?: QuestionOption[] | null
}

type ItemProgress = {
  total_reviews?: number | null
  correct_reviews?: number | null
  current_streak?: number | null
  last_is_correct?: boolean | null
  last_studied_at?: string | null
  status?: string | null
}

type DeckSummary = {
  new: number
  failed: number
  learning: number
  mastered: number
}

type Item = {
  id: string | number
  deckItemId?: string | number | null
  deck_item_id?: string | number | null
  statement?: string | null
  questions?: ItemQuestion | null
  progress?: ItemProgress | null
}

type LogDeckItemStudyQuestionPayload = {
  deckItemId: number
  selectedOption: number
  sessionId: string
}

type LogDeckItemStudyFlashcardPayload = {
  deckItemId: number
  isCorrect: boolean
  sessionId: string
}

type LogDeckItemStudyPayload = LogDeckItemStudyQuestionPayload | LogDeckItemStudyFlashcardPayload

type LogDeckItemStudyResponse = {
  ok: true
  deckId: string | number
  deckItemId: number
  isCorrect?: boolean | null
  selectedOption?: number | null
  progress?: ItemProgress | null
}

type DeckSummaryResponse = {
  summary?: Partial<Record<keyof DeckSummary, number | null>> | null
}

type DeckBootstrapResponse = {
  deck: Deck | null
  items: Item[]
  summary: DeckSummary | null
  summaryError?: string | null
}

type StartStudySessionResponse = {
  sessionId: string
  limit: number
  reused: boolean
}

type EndStudySessionResponse = {
  success?: boolean | null
  metrics?: unknown
  [key: string]: unknown
}

type NextDeckItemResponse =
  | {
      item: Item
      done?: false | null
      limitReached?: false | null
      expired?: false | null
    }
  | {
      done: true
      item?: null
      limitReached?: false | null
      expired?: false | null
    }
  | {
      limitReached: true
      item?: null
      done?: false | null
      expired?: false | null
    }
  | {
      expired: true
      item?: null
      done?: false | null
      limitReached?: false | null
    }

const API_URL = process.env.NEXT_PUBLIC_API_URL
const STUDY_SESSION_STORAGE_KEY_PREFIX = 'studio:deck:study-session:'
const EMPTY_DECK_SUMMARY: DeckSummary = {
  new: 0,
  failed: 0,
  learning: 0,
  mastered: 0,
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

async function fetchDeckBootstrap(token: string, deckId: string): Promise<DeckBootstrapResponse> {
  if (!deckId) throw new Error('deckId no valido.')

  const res = await fetch(`/api/studio/decks/${deckId}/bootstrap`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar el mazo (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as DeckBootstrapResponse | null

  if (!payload) {
    throw new Error('No se recibieron datos validos del mazo.')
  }

  return payload
}

function normalizeSummaryCount(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0
}

async function getDeckSummary(deckId: string): Promise<DeckSummary> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!deckId) throw new Error('deckId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/summary`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar el summary (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as DeckSummaryResponse | null
  const summary = payload?.summary

  return {
    new: normalizeSummaryCount(summary?.new),
    failed: normalizeSummaryCount(summary?.failed),
    learning: normalizeSummaryCount(summary?.learning),
    mastered: normalizeSummaryCount(summary?.mastered),
  }
}

async function logDeckItemStudy(
  deckId: string,
  payload: LogDeckItemStudyPayload,
): Promise<LogDeckItemStudyResponse> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!deckId) throw new Error('deckId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo registrar estudio (${res.status})`))
  }

  return (await res.json()) as LogDeckItemStudyResponse
}

async function startDeckStudySession(
  deckId: string,
  limit: number,
): Promise<StartStudySessionResponse> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!deckId) throw new Error('deckId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/start-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ limit }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo iniciar sesion (${res.status})`))
  }

  return (await res.json()) as StartStudySessionResponse
}

async function getNextDeckItem(deckId: string, sessionId: string): Promise<NextDeckItemResponse> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!deckId) throw new Error('deckId no valido.')
  if (!sessionId) throw new Error('sessionId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const url = new URL(`${API_URL}/api/studio/decks/${deckId}/next`)
  url.searchParams.set('sessionId', sessionId)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar el siguiente item (${res.status})`))
  }

  return (await res.json()) as NextDeckItemResponse
}

async function endStudySession(sessionId: string): Promise<EndStudySessionResponse> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!sessionId) throw new Error('sessionId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const res = await fetch(`${API_URL}/api/studio/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cerrar la sesion (${res.status})`))
  }

  return (await res.json().catch(() => ({}))) as EndStudySessionResponse
}

function resolveDeckItemId(item: Item): number | null {
  const rawId = item.deckItemId ?? item.deck_item_id ?? item.id
  const parsed = Number(rawId)

  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.trunc(parsed)
}

function patchItemProgressStatus(item: Item, status: string | null | undefined): Item {
  return {
    ...item,
    progress: {
      ...(item.progress ?? {}),
      status: status ?? null,
    },
  }
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

function getQuestionCorrectIndex(item: Item): number | null {
  const raw = item.questions?.correct_answer
  const parsed =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN

  if (!Number.isFinite(parsed)) return null
  return Math.trunc(parsed)
}

// Studio option_index viene 1-based desde DB.
// Lo convertimos a 0-based para generar letras correctamente.

function getOptionLetter(option: QuestionOption, fallbackIndex: number): string {
  const index =
    typeof option.option_index === 'number'
      ? option.option_index - 1   // 👈 ajuste a 0-based
      : fallbackIndex

  const safeIndex =
    Number.isFinite(index) && index >= 0
      ? Math.floor(index)
      : fallbackIndex

  return String.fromCharCode(65 + safeIndex)
}

export default function StudioDeckDetailPage() {
  console.log('RENDER STUDY PAGE')

  const params = useParams<{ deckId: string }>()
  const router = useRouter()
  const deckId = String(params?.deckId ?? '')

  const [deck, setDeck] = useState<Deck | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studyMode, setStudyMode] = useState(false)
  const [studySessionId, setStudySessionId] = useState<string | null>(null)
  const [studyItem, setStudyItem] = useState<Item | null>(null)
  const [studyLoading, setStudyLoading] = useState(false)
  const [studyClosing, setStudyClosing] = useState(false)
  const [deckSummary, setDeckSummary] = useState<DeckSummary>(EMPTY_DECK_SUMMARY)
  const [deckSummaryLoading, setDeckSummaryLoading] = useState(true)
  const [deckSummaryError, setDeckSummaryError] = useState<string | null>(null)
  const [studyActionError, setStudyActionError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [nextQuestionCache, setNextQuestionCache] = useState<Item | null>(null)
  const [nextEndReason, setNextEndReason] = useState<'done' | 'limitReached' | 'expired' | null>(null)
  const [preloadInFlight, setPreloadInFlight] = useState(false)
  const sessionClosedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      setLoading(true)
      setError(null)
      setDeck(null)
      setItems([])
      setStudySessionId(null)
      setStudyItem(null)
      setStudyLoading(false)
      setStudyClosing(false)
      setDeckSummary(EMPTY_DECK_SUMMARY)
      setDeckSummaryLoading(true)
      setDeckSummaryError(null)
      setStudyActionError(null)
      setSelectedOption(null)
      setIsAnswered(false)
      setIsLoadingNext(false)
      setNextQuestionCache(null)
      setPreloadInFlight(false)
      sessionClosedRef.current = false

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

        // Fetch bootstrap data in one request to avoid client-side waterfalls and reduce
        // total time-to-interactive while keeping the same UI behavior.
        const bootstrap = await fetchDeckBootstrap(token, deckId)

        if (!mounted) return

        setDeck(bootstrap.deck)
        setItems(bootstrap.items)
        if (bootstrap.summary) {
          setDeckSummary(bootstrap.summary)
          setDeckSummaryError(null)
        } else {
          setDeckSummary(EMPTY_DECK_SUMMARY)
          setDeckSummaryError(bootstrap.summaryError ?? 'No se pudo cargar el summary.')
        }
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar el mazo.')
      } finally {
        if (mounted) setDeckSummaryLoading(false)
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

  const studySessionStorageKey = `${STUDY_SESSION_STORAGE_KEY_PREFIX}${deckId}`

  const saveStudySessionId = (sessionId: string | null) => {
    if (typeof window === 'undefined') return

    if (sessionId) {
      window.localStorage.setItem(studySessionStorageKey, sessionId)
      return
    }

    window.localStorage.removeItem(studySessionStorageKey)
  }

  const clearStudySession = () => {
    setStudySessionId(null)
    setStudyItem(null)
    setSelectedOption(null)
    setIsAnswered(false)
    setIsLoadingNext(false)
    setNextQuestionCache(null)
    setNextEndReason(null)
    setPreloadInFlight(false)
    saveStudySessionId(null)
  }

  const closeStudySessionAndNavigate = async (sessionId: string): Promise<void> => {
    if (sessionClosedRef.current) return

    sessionClosedRef.current = true
    setStudyClosing(true)
    setStudyActionError(null)

    try {
      const endResponse = await endStudySession(sessionId)
      if (endResponse.success !== true) {
        throw new Error('No se pudo cerrar la sesion.')
      }

      clearStudySession()
      router.push(`/studio/${deckId}/session/${sessionId}/summary`)
    } catch (err) {
      sessionClosedRef.current = false
      setStudyClosing(false)
      throw err
    }
  }

  const askStudyLimit = (message: string): number | null => {
    if (typeof window === 'undefined') return null

    const raw = window.prompt(message, '20')
    if (raw == null) return null

    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStudyActionError('Ingresa un numero valido mayor a 0.')
      return null
    }

    return Math.trunc(parsed)
  }

  const loadNextStudyItem = async (sessionIdOverride?: string): Promise<void> => {
    const activeSessionId = sessionIdOverride ?? studySessionId

    if (!activeSessionId) {
      setStudyActionError('No hay una sesion de estudio activa.')
      return
    }

    setStudyActionError(null)
    setStudyLoading(true)

    try {
      const response = await getNextDeckItem(deckId, activeSessionId)

      if ('expired' in response && response.expired) {
        await closeStudySessionAndNavigate(activeSessionId)
        return
      }

      if ('limitReached' in response && response.limitReached) {
        await closeStudySessionAndNavigate(activeSessionId)
        return
      }

      if ('done' in response && response.done) {
        await closeStudySessionAndNavigate(activeSessionId)
        return
      }

      setStudyItem(response.item)
      setSelectedOption(null)
      setIsAnswered(false)
    } catch (err) {
      setStudyActionError(err instanceof Error ? err.message : 'No se pudo cargar el siguiente item.')
    } finally {
      setStudyLoading(false)
    }
  }

  const preloadNextQuestion = async (
    sessionIdOverride?: string,
    ignoreExistingCache = false,
  ): Promise<void> => {
    const activeSessionId = sessionIdOverride ?? studySessionId

    if (
      !activeSessionId ||
      preloadInFlight ||
      (!ignoreExistingCache && nextQuestionCache) ||
      sessionClosedRef.current
    ) {
      return
    }

    setPreloadInFlight(true)
    try {
      const response = await getNextDeckItem(deckId, activeSessionId)

      if ('expired' in response && response.expired) {
        setNextQuestionCache(null)
        setNextEndReason('expired')
        return
      }

      if ('limitReached' in response && response.limitReached) {
        setNextQuestionCache(null)
        setNextEndReason('limitReached')
        return
      }

      if ('done' in response && response.done) {
        setNextQuestionCache(null)
        setNextEndReason('done')
        return
      }

      setNextQuestionCache(response.item)
      setNextEndReason(null)
    } catch (err) {
      setStudyActionError(
        err instanceof Error ? err.message : 'No se pudo precargar la siguiente pregunta.',
      )
    } finally {
      setPreloadInFlight(false)
    }
  }

  const handleStartStudy = async () => {
    if (studyLoading || studyClosing) return

    setStudyMode(true)
    setStudyActionError(null)
    setStudyClosing(false)
    setStudyItem(null)
    setSelectedOption(null)
    setIsAnswered(false)
    setIsLoadingNext(false)
    setNextQuestionCache(null)
    setNextEndReason(null)
    setPreloadInFlight(false)
    sessionClosedRef.current = false

    clearStudySession()

    const limit = askStudyLimit('¿Cuántas tarjetas quieres estudiar?')
    if (limit == null) {
      setStudyMode(false)
      return
    }

    setStudyLoading(true)
    try {
      let session = await startDeckStudySession(deckId, limit)

      if (session.reused) {
        await endStudySession(session.sessionId).catch(() => null)
        clearStudySession()
        sessionClosedRef.current = false
        session = await startDeckStudySession(deckId, limit)
      }

      sessionClosedRef.current = false
      setStudySessionId(session.sessionId)
      saveStudySessionId(session.sessionId)
      await loadNextStudyItem(session.sessionId)
    } catch (err) {
      setStudyActionError(err instanceof Error ? err.message : 'No se pudo iniciar la sesion.')
      setStudyMode(false)
    } finally {
      setStudyLoading(false)
    }
  }
  if (studyMode) {
    const currentItem = studyItem
    const currentOptions = currentItem ? getSortedQuestionOptions(currentItem) : []
    const currentCorrectIndex = currentItem ? getQuestionCorrectIndex(currentItem) : null
    const isStudyBusy = studyLoading || studyClosing || isLoadingNext

    const handleSelectOption = (option: QuestionOption, optionIndex: number) => {
      if (!currentItem) return
      if (!studySessionId) {
        setStudyActionError('No hay una sesion de estudio activa.')
        return
      }

      const resolvedDeckItemId = resolveDeckItemId(currentItem)

      if (resolvedDeckItemId == null) {
        setStudyActionError('No se pudo identificar el item del mazo.')
        return
      }

      if (isStudyBusy) return

      const selectedOption =
        typeof option.option_index === 'number' ? option.option_index : optionIndex + 1
      const isCorrectSelection =
        currentCorrectIndex != null && selectedOption === currentCorrectIndex
      const optimisticStatus =
        currentCorrectIndex == null
          ? currentItem.progress?.status
          : isCorrectSelection
            ? 'correct'
            : 'incorrect'

      setStudyActionError(null)
      setSelectedOption(selectedOption)
      setIsAnswered(true)
      setStudyItem((prev) => (prev ? patchItemProgressStatus(prev, optimisticStatus) : prev))

      void logDeckItemStudy(deckId, {
        deckItemId: resolvedDeckItemId,
        selectedOption,
        sessionId: studySessionId,
      })
        .then((result) => {
          setStudyItem((prev) => {
            if (!prev) return prev
            return {
              ...patchItemProgressStatus(prev, result.progress?.status),
              progress: {
                ...(prev.progress ?? {}),
                ...(result.progress ?? {}),
                status: result.progress?.status ?? prev.progress?.status ?? null,
              },
            }
          })
        })
        .catch((err: unknown) => {
          setStudyActionError(
            err instanceof Error ? err.message : 'No se pudo registrar la respuesta.',
          )
        })

      void getDeckSummary(deckId)
        .then((summary) => {
          setDeckSummary(summary)
          setDeckSummaryError(null)
        })
        .catch((summaryErr: unknown) => {
          setDeckSummaryError(
            summaryErr instanceof Error ? summaryErr.message : 'No se pudo cargar el summary.',
          )
        })

      void preloadNextQuestion(studySessionId)
    }

    const handleNextQuestion = async () => {
      if (!isAnswered || isStudyBusy) return

      if (nextQuestionCache) {
        setIsLoadingNext(true)
        setStudyActionError(null)

        const cachedItem = nextQuestionCache
        setStudyItem(cachedItem)
        setNextQuestionCache(null)
        setNextEndReason(null)
        setSelectedOption(null)
        setIsAnswered(false)
        setIsLoadingNext(false)
        void preloadNextQuestion(undefined, true)
        return
      }

      if (nextEndReason) {
        const activeSessionId = studySessionId
        if (!activeSessionId) {
          setStudyActionError('No hay una sesion de estudio activa.')
          return
        }

        setStudyActionError(null)
        try {
          await closeStudySessionAndNavigate(activeSessionId)
        } catch (err) {
          setStudyActionError(
            err instanceof Error ? err.message : 'No se pudo cerrar la sesion de estudio.',
          )
        }
        return
      }

      void preloadNextQuestion(undefined, true)
    }

    return (
      <div className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Modo estudio</h2>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          {studyClosing ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              <p className="text-sm font-medium text-slate-700">Cerrando sesión...</p>
            </div>
          ) : null}
          {!studyClosing && studyLoading && !currentItem ? <div>Cargando...</div> : null}
          {!studyClosing && currentItem ? (
            <div className={`transition-opacity duration-200 ${isLoadingNext ? 'opacity-0' : 'opacity-100'}`}>
              <div>{currentItem.questions?.statement || currentItem.statement || 'Item'}</div>
            </div>
          ) : null}
          {!studyClosing &&
          currentItem &&
          currentOptions.length > 0 ? (
            <div
              className={`mt-4 space-y-2 transition-opacity duration-200 ${isLoadingNext ? 'opacity-0' : 'opacity-100'}`}
            >
              {currentOptions.map((option, optionIndex) => {
                const optionValue =
                  typeof option.option_index === 'number' ? option.option_index : optionIndex + 1
                const isCorrect = currentCorrectIndex != null && optionValue === currentCorrectIndex
                const isSelected = selectedOption === optionValue
                const showCorrect = isAnswered && isCorrect
                const showIncorrectSelected = isAnswered && isSelected && !isCorrect

                const feedbackClass = showCorrect
                  ? 'border-emerald-300 bg-emerald-50'
                  : showIncorrectSelected
                    ? 'border-rose-300 bg-rose-50'
                    : 'border-slate-200 bg-slate-50'

                const feedbackTextClass = showCorrect
                  ? 'text-emerald-800'
                  : showIncorrectSelected
                    ? 'text-rose-800'
                    : 'text-slate-800'

                return (
                  <button
                    type="button"
                    key={String(option.id ?? `${option.option_index ?? optionIndex}-${optionIndex}`)}
                    onClick={() => {
                      void handleSelectOption(option, optionIndex)
                    }}
                    disabled={isStudyBusy || isAnswered}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${feedbackClass}`}
                  >
                    <span className="text-sm font-semibold text-slate-500">
                      {getOptionLetter(option, optionIndex)}
                    </span>
                    <span className={`text-sm ${feedbackTextClass}`}>{option.option_text}</span>
                    {showCorrect ? (
                      <span className="ml-auto text-xs font-semibold text-emerald-700">
                        Correcta
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {currentItem?.questions?.explanation ? (
                <div
                  className={`transform-gpu overflow-hidden border bg-neutral-50 transition-[max-height,opacity,transform,margin,padding,border-radius,filter,background-color,border-color] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    isAnswered
                      ? 'mt-6 max-h-80 translate-y-0 scale-100 rounded-xl border-neutral-200 bg-neutral-50 p-4 opacity-100 blur-0'
                      : 'mt-0 max-h-0 -translate-y-1 scale-[0.985] rounded-2xl border-transparent bg-neutral-50/60 p-0 opacity-0 blur-[2px]'
                  }`}
                  aria-hidden={!isAnswered}
                >
                  <div
                    className={`transition-opacity duration-500 ${
                      isAnswered ? 'opacity-100 delay-100' : 'opacity-0 delay-0'
                    }`}
                  >
                    <h4 className="mb-2 text-sm font-semibold text-neutral-700">Explicación</h4>
                    <p className="text-sm leading-relaxed text-neutral-700">
                      {currentItem.questions.explanation}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {!studyClosing &&
          currentItem &&
          currentOptions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Este item no tiene opciones disponibles.</p>
          ) : null}
          {!studyClosing && currentItem && currentOptions.length > 0 && isAnswered ? (
            <div className={`mt-4 transition-opacity duration-200 ${isLoadingNext ? 'opacity-0' : 'opacity-100'}`}>
                <button
                  type="button"
                  onClick={() => {
                    void handleNextQuestion()
                  }}
                  disabled={isStudyBusy || (nextQuestionCache == null && nextEndReason == null)}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                Siguiente
              </button>
            </div>
          ) : null}
          {studyActionError ? <p className="mt-4 text-sm text-red-600">{studyActionError}</p> : null}
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
            onClick={() => {
              void handleStartStudy()
            }}
            disabled={studyLoading}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Estudiar
          </button>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              🆕 Nuevas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.new}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              🔴 Falladas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.failed}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              🟡 En aprendizaje
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.learning}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              🟢 Dominadas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.mastered}
            </p>
          </div>
        </section>
        {deckSummaryError ? <p className="text-sm text-slate-600">{deckSummaryError}</p> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Preguntas</h2>
            <span className="text-sm text-slate-500">{items.length} items</span>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-600">Este mazo no tiene items.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, index) => {
                const itemOptions = getSortedQuestionOptions(item)
                const itemCorrectIndex = getQuestionCorrectIndex(item)

                return (
                  <li key={String(item.id)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pregunta {index + 1}
                    </p>
                    <p className="mt-2 text-sm text-slate-800">
                      {item.questions?.statement?.trim() ||
                        item.statement?.trim() ||
                        `Item ${index + 1}`}
                    </p>
                    {itemOptions.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {itemOptions.map((option, optionIndex) => {
                          const optionValue =
                            typeof option.option_index === 'number'
                              ? option.option_index
                              : optionIndex + 1
                          const isCorrect = itemCorrectIndex != null && optionValue === itemCorrectIndex

                          return (
                            <div
                              key={String(option.id ?? `${String(item.id)}-${option.option_index ?? optionIndex}`)}
                              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <span className="text-xs font-semibold text-slate-500">
                                {getOptionLetter(option, optionIndex)}
                              </span>
                              <span className="text-sm text-slate-700">{option.option_text}</span>
                              {isCorrect ? (
                                <span className="ml-auto text-xs font-semibold text-emerald-700">
                                  Correcta
                                </span>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
