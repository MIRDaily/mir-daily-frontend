'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DeckTrashList from '@/components/studio/DeckTrashList'
import DeckItemsList from '@/components/studio/DeckItemsList'
import GooFissionLoader from '@/components/studio/GooFissionLoader'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'
import {
  fetchDeckItemsTrash,
  restoreDeckItem,
  softDeleteDeckItem,
  type DeckTrashItem,
} from '@/lib/studio/trash'
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
  explanation?: string | null
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

type UndoDeckItem = {
  key: string
  item: Item
  itemIndex: number
  deckItemId: number
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

type DeckSubjectsResponse = {
  subjects?: Array<{
    subject?: string | null
    count?: number | null
  }> | null
}

type SubjectPerformance = {
  subject: string
  accuracy: number
  total: number
}

type SubjectPerformanceResponse = {
  subjects?: SubjectPerformance[] | null
}

type StudyStatus = 'new' | 'failed' | 'learning' | 'mastered'
type StudyRequestMode = 'normal' | 'smart'

type StudyFilters = {
  subjects: string[]
  status: StudyStatus | null
  mode: StudyRequestMode
}

type SubjectFilterOption = {
  value: string
  label: string
  count: number
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
const STUDY_STATUS_OPTIONS: Array<{
  value: StudyStatus
  label: string
  dotClass: string
}> = [
  { value: 'new', label: 'Nuevas', dotClass: 'bg-blue-500' },
  { value: 'failed', label: 'Falladas', dotClass: 'bg-rose-500' },
  { value: 'learning', label: 'En aprendizaje', dotClass: 'bg-amber-500' },
  { value: 'mastered', label: 'Dominadas', dotClass: 'bg-emerald-500' },
]
const EMPTY_DECK_SUMMARY: DeckSummary = {
  new: 0,
  failed: 0,
  learning: 0,
  mastered: 0,
}
const SMART_REVIEW_STATUS_PRIORITY: StudyStatus[] = ['failed', 'learning', 'new', 'mastered']

function isAllSubjectValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'all subjects' || normalized === 'all'
}

function isAllStatusValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'all status' || normalized === 'all' || normalized === 'todas' || normalized === 'todos'
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

async function getDeckSubjects(deckId: string): Promise<DeckSubjectsResponse> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!deckId) throw new Error('deckId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/subjects`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar asignaturas del mazo (${res.status})`))
  }

  return (await res.json().catch(() => ({}))) as DeckSubjectsResponse
}

async function getSubjectPerformance(deckId: string): Promise<SubjectPerformance[]> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL no definida.')
  if (!deckId) throw new Error('deckId no valido.')

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const token = session?.access_token ?? ''

  if (!token) {
    throw new Error('No hay sesion activa.')
  }

  const res = await fetch(`${API_URL}/api/studio/decks/${deckId}/subject-performance`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo cargar acierto por asignatura (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as SubjectPerformanceResponse | null
  const subjects = Array.isArray(payload?.subjects) ? payload.subjects : []

  return subjects
    .filter((entry) => Boolean(entry?.subject))
    .map((entry) => ({
      subject: entry.subject,
      accuracy:
        typeof entry.accuracy === 'number' && Number.isFinite(entry.accuracy)
          ? Math.max(0, Math.min(100, Math.round(entry.accuracy)))
          : 0,
      total:
        typeof entry.total === 'number' && Number.isFinite(entry.total) && entry.total >= 0
          ? Math.trunc(entry.total)
          : 0,
    }))
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

async function getNextDeckItem(
  deckId: string,
  sessionId: string,
  filters?: StudyFilters,
): Promise<NextDeckItemResponse> {
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

  const subjects =
    Array.isArray(filters?.subjects)
      ? filters.subjects
          .map((subject) => (typeof subject === 'string' ? subject.trim() : ''))
          .filter((subject) => Boolean(subject) && !isAllSubjectValue(subject))
      : []
  const status =
    typeof filters?.status === 'string' && !isAllStatusValue(filters.status) ? filters.status : null

  const params = new URLSearchParams({ sessionId })
  if (subjects.length > 0) {
    subjects.forEach((subject) => {
      params.append('subject', subject)
    })
  }
  if (status) {
    params.set('status', status)
  }

  const url = `${API_URL}/api/studio/decks/${deckId}/next?${params.toString()}`

  const res = await fetch(url, {
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
      ? option.option_index - 1 // ajuste a 0-based
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
  const [deckSubjects, setDeckSubjects] = useState<{ name: string; percent: number }[]>([])
  const [subjectFilterOptions, setSubjectFilterOptions] = useState<SubjectFilterOption[]>([])
  const [subjectFilter, setSubjectFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<StudyStatus | null>(null)
  const [studyRequestMode, setStudyRequestMode] = useState<StudyRequestMode>('normal')
  const [studyFilters, setStudyFilters] = useState<StudyFilters>({
    subjects: [],
    status: null,
    mode: 'normal',
  })
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance[]>([])
  const [activeDeckTab, setActiveDeckTab] = useState<'items' | 'trash'>('items')
  const [trashCount, setTrashCount] = useState(0)
  const [trashCountLoading, setTrashCountLoading] = useState(true)
  const [trashItems, setTrashItems] = useState<DeckTrashItem[]>([])
  const [trashItemsLoading, setTrashItemsLoading] = useState(false)
  const [trashItemsError, setTrashItemsError] = useState<string | null>(null)
  const [restoringTrashItemIds, setRestoringTrashItemIds] = useState<Set<string>>(new Set())
  const [deletingItemIds, setDeletingItemIds] = useState<Set<string>>(new Set())
  const [undoItem, setUndoItem] = useState<UndoDeckItem | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [undoToast, setUndoToast] = useState<{
    message: string
    tone: 'neutral' | 'success' | 'error'
    showAction: boolean
    isVisible: boolean
  } | null>(null)
  const [deckItemsActionError, setDeckItemsActionError] = useState<string | null>(null)
  const [studyActionError, setStudyActionError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [nextQuestionCache, setNextQuestionCache] = useState<Item | null>(null)
  const [nextEndReason, setNextEndReason] = useState<'done' | 'limitReached' | 'expired' | null>(null)
  const [preloadInFlight, setPreloadInFlight] = useState(false)
  const [isContentVisible, setIsContentVisible] = useState(false)
  const [isStudyLimitModalOpen, setIsStudyLimitModalOpen] = useState(false)
  const [isStudyLimitModalVisible, setIsStudyLimitModalVisible] = useState(false)
  const [studyLimitInput, setStudyLimitInput] = useState('20')
  const [studyLimitError, setStudyLimitError] = useState<string | null>(null)
  const studyLimitResolverRef = useRef<((value: number | null) => void) | null>(null)
  const studyLimitCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const studyLimitPendingValueRef = useRef<number | null>(null)
  const sessionClosedRef = useRef(false)
  const undoExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoToastExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoToastReplaceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoToastAnimationFrameRef = useRef<number | null>(null)
  const pendingDeleteRequestsRef = useRef<Map<string, Promise<void>>>(new Map())
  const TOAST_EXIT_ANIMATION_MS = 220

  const clearUndoExpireTimeout = () => {
    if (!undoExpireTimeoutRef.current) return
    clearTimeout(undoExpireTimeoutRef.current)
    undoExpireTimeoutRef.current = null
  }

  const clearUndoToastTimeout = () => {
    if (!undoToastTimeoutRef.current) return
    clearTimeout(undoToastTimeoutRef.current)
    undoToastTimeoutRef.current = null
  }

  const clearUndoToastExitTimeout = () => {
    if (!undoToastExitTimeoutRef.current) return
    clearTimeout(undoToastExitTimeoutRef.current)
    undoToastExitTimeoutRef.current = null
  }

  const clearUndoToastReplaceTimeout = () => {
    if (!undoToastReplaceTimeoutRef.current) return
    clearTimeout(undoToastReplaceTimeoutRef.current)
    undoToastReplaceTimeoutRef.current = null
  }

  const clearUndoToastAnimationFrame = () => {
    if (undoToastAnimationFrameRef.current == null) return
    window.cancelAnimationFrame(undoToastAnimationFrameRef.current)
    undoToastAnimationFrameRef.current = null
  }

  const showUndoToast = ({
    message,
    tone,
    showAction,
  }: {
    message: string
    tone: 'neutral' | 'success' | 'error'
    showAction: boolean
  }) => {
    clearUndoToastAnimationFrame()
    clearUndoToastExitTimeout()
    setUndoToast({
      message,
      tone,
      showAction,
      isVisible: false,
    })
    undoToastAnimationFrameRef.current = window.requestAnimationFrame(() => {
      undoToastAnimationFrameRef.current = null
      setUndoToast((prev) => {
        if (!prev || prev.message !== message || prev.tone !== tone || prev.showAction !== showAction) {
          return prev
        }
        return {
          ...prev,
          isVisible: true,
        }
      })
    })
  }

  const hideUndoToast = () => {
    setUndoToast((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        isVisible: false,
      }
    })

    clearUndoToastExitTimeout()
    undoToastExitTimeoutRef.current = setTimeout(() => {
      undoToastExitTimeoutRef.current = null
      setUndoToast(null)
    }, TOAST_EXIT_ANIMATION_MS)
  }

  const showTimedDeckToast = (message: string, tone: 'neutral' | 'success' | 'error') => {
    const mountToastAndAutoHide = () => {
      showUndoToast({ message, tone, showAction: false })
      clearUndoToastTimeout()
      undoToastTimeoutRef.current = setTimeout(() => {
        undoToastTimeoutRef.current = null
        hideUndoToast()
      }, 2500)
    }

    clearUndoToastReplaceTimeout()
    if (undoToast) {
      clearUndoToastExitTimeout()
      setUndoToast((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          isVisible: false,
        }
      })
      undoToastReplaceTimeoutRef.current = setTimeout(() => {
        undoToastReplaceTimeoutRef.current = null
        mountToastAndAutoHide()
      }, TOAST_EXIT_ANIMATION_MS)
      return
    }

    mountToastAndAutoHide()
  }

  const loadDeckTrashItems = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) setTrashItemsLoading(true)
    setTrashItemsError(null)

    try {
      const trash = await fetchDeckItemsTrash(deckId)
      setTrashItems(trash)
      setTrashCount(trash.length)
    } catch (err) {
      setTrashItems([])
      setTrashCount(0)
      setTrashItemsError(
        err instanceof Error ? err.message : 'No se pudo cargar la papelera de preguntas.',
      )
    } finally {
      if (!silent) setTrashItemsLoading(false)
      setTrashCountLoading(false)
    }
  }

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
      setDeckSubjects([])
      setSubjectFilterOptions([])
      setSubjectFilter([])
      setStatusFilter(null)
      setStudyRequestMode('normal')
      setStudyFilters({ subjects: [], status: null, mode: 'normal' })
      setSubjectPerformance([])
      setActiveDeckTab('items')
      setTrashCount(0)
      setTrashCountLoading(true)
      setTrashItems([])
      setTrashItemsLoading(false)
      setTrashItemsError(null)
      setRestoringTrashItemIds(new Set())
      setDeletingItemIds(new Set())
      setUndoItem(null)
      setUndoBusy(false)
      setUndoToast(null)
      setDeckItemsActionError(null)
      setStudyActionError(null)
      setSelectedOption(null)
      setIsAnswered(false)
      setIsLoadingNext(false)
      setNextQuestionCache(null)
      setPreloadInFlight(false)
      sessionClosedRef.current = false
      clearUndoExpireTimeout()
      clearUndoToastTimeout()
      clearUndoToastExitTimeout()
      clearUndoToastReplaceTimeout()
      clearUndoToastAnimationFrame()
      pendingDeleteRequestsRef.current.clear()

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

  useEffect(() => {
    let mounted = true

    if (!deckId) {
      setDeckSubjects([])
      return () => {
        mounted = false
      }
    }

    void getDeckSubjects(deckId)
      .then((data) => {
        if (!mounted) return

        const subjects = Array.isArray(data.subjects) ? data.subjects : []
        const entries = subjects
          .map((entry) => {
            const name =
              typeof entry?.subject === 'string' ? entry.subject.trim() : ''
            const count = Number(entry?.count)
            if (!name || !Number.isFinite(count) || count <= 0) return null
            return {
              name,
              count: Math.trunc(count),
            }
          })
          .filter((entry): entry is { name: string; count: number } => entry !== null)

        const options = entries
          .map((entry) => ({
            value: entry.name,
            label: entry.name,
            count: entry.count,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))

        setSubjectFilterOptions(options)

        const total = entries.reduce((acc, entry) => acc + entry.count, 0)
        if (total <= 0) {
          setDeckSubjects([])
          return
        }

        const topSubjects = entries
          .map((entry) => ({
            name: entry.name,
            percent: Math.round((entry.count / total) * 100),
          }))
          .sort((a, b) => b.percent - a.percent)
          .slice(0, 5)

        setDeckSubjects(topSubjects)
      })
      .catch(() => {
        if (mounted) {
          setDeckSubjects([])
          setSubjectFilterOptions([])
        }
      })

    return () => {
      mounted = false
    }
  }, [deckId, isStudyLimitModalOpen])

  useEffect(() => {
    let mounted = true

    if (!deckId) {
      setSubjectPerformance([])
      return () => {
        mounted = false
      }
    }

    void getSubjectPerformance(deckId)
      .then((subjects) => {
        if (!mounted) return
        setSubjectPerformance(subjects)
      })
      .catch(() => {
        if (mounted) setSubjectPerformance([])
      })

    return () => {
      mounted = false
    }
  }, [deckId])

  useEffect(() => {
    let mounted = true

    if (!deckId) {
      setTrashCount(0)
      setTrashCountLoading(false)
      return () => {
        mounted = false
      }
    }

    setTrashCountLoading(true)
    void fetchDeckItemsTrash(deckId)
      .then((trash) => {
        if (!mounted) return
        setTrashCount(trash.length)
      })
      .catch(() => {
        if (!mounted) return
        setTrashCount(0)
      })
      .finally(() => {
        if (mounted) setTrashCountLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [deckId])

  useEffect(() => {
    if (activeDeckTab !== 'trash' || !deckId) return
    void loadDeckTrashItems()
  }, [activeDeckTab, deckId])

  useEffect(() => {
    if (loading) {
      setIsContentVisible(false)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setIsContentVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [loading, deckId])

  useEffect(() => {
    return () => {
      if (studyLimitCloseTimeoutRef.current) {
        clearTimeout(studyLimitCloseTimeoutRef.current)
        studyLimitCloseTimeoutRef.current = null
      }
      clearUndoExpireTimeout()
      clearUndoToastTimeout()
      clearUndoToastExitTimeout()
      clearUndoToastReplaceTimeout()
      clearUndoToastAnimationFrame()
      pendingDeleteRequestsRef.current.clear()
      const resolver = studyLimitResolverRef.current
      studyLimitResolverRef.current = null
      studyLimitPendingValueRef.current = null
      resolver?.(null)
    }
  }, [])

  if (loading)
    return (
      <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
        <GooFissionLoader label="Cargando mazo" />
      </div>
    )

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
      router.push(`/session/${sessionId}/summary?deckId=${deckId}`)
    } catch (err) {
      sessionClosedRef.current = false
      setStudyClosing(false)
      throw err
    }
  }

  const requestStudyLimit = (): Promise<number | null> =>
    new Promise((resolve) => {
      if (studyLimitCloseTimeoutRef.current) {
        clearTimeout(studyLimitCloseTimeoutRef.current)
        studyLimitCloseTimeoutRef.current = null
      }

      studyLimitResolverRef.current = resolve
      setStudyLimitInput('20')
      setStudyLimitError(null)
      setIsStudyLimitModalOpen(true)
      setIsStudyLimitModalVisible(false)
      window.requestAnimationFrame(() => {
        setIsStudyLimitModalVisible(true)
      })
    })

  const closeStudyLimitModal = (value: number | null) => {
    studyLimitPendingValueRef.current = value
    setIsStudyLimitModalVisible(false)

    if (studyLimitCloseTimeoutRef.current) {
      clearTimeout(studyLimitCloseTimeoutRef.current)
    }

    studyLimitCloseTimeoutRef.current = setTimeout(() => {
      studyLimitCloseTimeoutRef.current = null
      setIsStudyLimitModalOpen(false)
      setStudyLimitError(null)
      const resolver = studyLimitResolverRef.current
      const resolvedValue = studyLimitPendingValueRef.current
      studyLimitResolverRef.current = null
      studyLimitPendingValueRef.current = null
      resolver?.(resolvedValue)
    }, 260)
  }

  const confirmStudyLimit = () => {
    const parsed = Number(studyLimitInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setStudyLimitError('Ingresa un numero valido mayor a 0.')
      return
    }

    closeStudyLimitModal(Math.trunc(parsed))
  }

  const getNextStudyItemWithMode = async (
    sessionId: string,
    filters: StudyFilters,
  ): Promise<NextDeckItemResponse> => {
    if (filters.mode !== 'smart') {
      return getNextDeckItem(deckId, sessionId, filters)
    }

    for (const status of SMART_REVIEW_STATUS_PRIORITY) {
      const response = await getNextDeckItem(deckId, sessionId, {
        ...filters,
        status,
      })

      if ('expired' in response && response.expired) return response
      if ('limitReached' in response && response.limitReached) return response
      if ('done' in response && response.done) continue
      if ('item' in response && !response.item) continue
      return response
    }

    return { done: true }
  }

  const loadNextStudyItem = async (
    sessionIdOverride?: string,
    filtersOverride?: StudyFilters,
  ): Promise<void> => {
    const activeSessionId = sessionIdOverride ?? studySessionId
    const activeFilters = filtersOverride ?? studyFilters

    if (!activeSessionId) {
      setStudyActionError('No hay una sesion de estudio activa.')
      return
    }

    setStudyActionError(null)
    setStudyLoading(true)

    try {
      const response = await getNextStudyItemWithMode(activeSessionId, activeFilters)

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
    filtersOverride?: StudyFilters,
  ): Promise<void> => {
    const activeSessionId = sessionIdOverride ?? studySessionId
    const activeFilters = filtersOverride ?? studyFilters

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
      const response = await getNextStudyItemWithMode(activeSessionId, activeFilters)

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

    const limit = await requestStudyLimit()
    if (limit == null) return
    const selectedFilters: StudyFilters = {
      subjects: [...subjectFilter],
      status: statusFilter,
      mode: studyRequestMode,
    }
    setStudyFilters(selectedFilters)

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
      await loadNextStudyItem(session.sessionId, selectedFilters)
    } catch (err) {
      setStudyActionError(err instanceof Error ? err.message : 'No se pudo iniciar la sesion.')
      setStudyMode(false)
    } finally {
      setStudyLoading(false)
    }
  }

  const handleDeleteDeckItem = async (entryId: string) => {
    if (studyLoading || studyClosing) return
    if (undoBusy) return

    const itemIndex = items.findIndex((item) => String(item.id) === entryId)
    if (itemIndex < 0) return
    const item = items[itemIndex]

    const shouldDelete = window.confirm(
      '¿Eliminar esta pregunta del mazo?\n\nPodrás restaurarla durante 24 horas.',
    )
    if (!shouldDelete) return

    const deckItemId = resolveDeckItemId(item)
    if (deckItemId == null) {
      setDeckItemsActionError('No se pudo identificar el item del mazo.')
      return
    }

    const itemKey = String(item.id)
    clearUndoExpireTimeout()
    clearUndoToastTimeout()
    clearUndoToastExitTimeout()
    clearUndoToastReplaceTimeout()
    clearUndoToastAnimationFrame()
    setDeckItemsActionError(null)
    setUndoItem({
      key: itemKey,
      item,
      itemIndex,
      deckItemId,
    })
    showUndoToast({ message: 'Pregunta eliminada del mazo', tone: 'neutral', showAction: true })
    undoExpireTimeoutRef.current = setTimeout(() => {
      undoExpireTimeoutRef.current = null
      setUndoItem(null)
      hideUndoToast()
    }, 6000)
    setDeletingItemIds((prev) => {
      const next = new Set(prev)
      next.add(itemKey)
      return next
    })
    setItems((prev) => prev.filter((entry) => String(entry.id) !== itemKey))
    setTrashCount((prev) => prev + 1)

    const deletePromise = softDeleteDeckItem(deckId, deckItemId)
    pendingDeleteRequestsRef.current.set(itemKey, deletePromise)

    try {
      await deletePromise
    } catch (err) {
      clearUndoExpireTimeout()
      setItems((prev) => {
        if (prev.some((entry) => String(entry.id) === itemKey)) return prev
        const next = [...prev]
        const insertIndex = Math.max(0, Math.min(itemIndex, next.length))
        next.splice(insertIndex, 0, item)
        return next
      })
      setTrashCount((prev) => Math.max(0, prev - 1))
      setUndoItem((prev) => (prev?.key === itemKey ? null : prev))
      hideUndoToast()
      setDeckItemsActionError(
        err instanceof Error ? err.message : 'No se pudo eliminar la pregunta del mazo.',
      )
    } finally {
      pendingDeleteRequestsRef.current.delete(itemKey)
      setDeletingItemIds((prev) => {
        const next = new Set(prev)
        next.delete(itemKey)
        return next
      })
    }
  }

  const handleUndoDelete = async () => {
    if (!undoItem || undoBusy) return

    const currentUndoItem = undoItem
    clearUndoExpireTimeout()
    setUndoBusy(true)
    setDeckItemsActionError(null)

    try {
      const pendingDelete = pendingDeleteRequestsRef.current.get(currentUndoItem.key)
      if (pendingDelete) {
        await pendingDelete
      }

      await restoreDeckItem(deckId, currentUndoItem.deckItemId)
      setItems((prev) => {
        if (prev.some((entry) => String(entry.id) === currentUndoItem.key)) return prev
        const next = [...prev]
        const insertIndex = Math.max(0, Math.min(currentUndoItem.itemIndex, next.length))
        next.splice(insertIndex, 0, currentUndoItem.item)
        return next
      })
      setTrashCount((prev) => Math.max(0, prev - 1))
      setUndoItem(null)
      showTimedDeckToast('Pregunta restaurada', 'success')
    } catch (err) {
      setUndoItem(null)
      showTimedDeckToast(
        err instanceof Error ? err.message : 'No se pudo restaurar la pregunta.',
        'error',
      )
    } finally {
      clearUndoExpireTimeout()
      setUndoBusy(false)
    }
  }

  const handleRestoreTrashItem = async (itemId: number) => {
    const key = String(itemId)
    if (restoringTrashItemIds.has(key)) return

    setTrashItemsError(null)
    setRestoringTrashItemIds((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })

    try {
      await restoreDeckItem(deckId, itemId)
      setTrashItems((prev) => prev.filter((item) => Number(item.id) !== itemId))
      setTrashCount((prev) => Math.max(0, prev - 1))
      showTimedDeckToast('Pregunta restaurada', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo restaurar la pregunta.'
      setTrashItemsError(message)
      showTimedDeckToast(message, 'error')
    } finally {
      setRestoringTrashItemIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleExpireTrashItem = (itemId: string) => {
    setTrashItems((prev) => prev.filter((item) => String(item.id) !== itemId))
    setTrashCount((prev) => Math.max(0, prev - 1))
  }

  if (studyMode) {
    const currentItem = studyItem
    const currentOptions = currentItem ? getSortedQuestionOptions(currentItem) : []
    const currentCorrectIndex = currentItem ? getQuestionCorrectIndex(currentItem) : null
    const isStudyBusy = studyLoading || studyClosing || isLoadingNext
    const isInitialStudyLoading = !studyClosing && studyLoading && !currentItem
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
        {isInitialStudyLoading ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-50/75 backdrop-blur-[2px]">
            <GooFissionLoader label="Cargando pregunta" />
          </div>
        ) : null}
      </div>
    )
  }

  const deckTitle = deck.name || deck.title || `Mazo ${deckId}`
  const deckItemEntries = items.map((item, index) => {
    const itemOptions = getSortedQuestionOptions(item)
    const itemCorrectIndex = getQuestionCorrectIndex(item)

    return {
      id: String(item.id),
      index,
      statement: item.questions?.statement?.trim() || item.statement?.trim() || `Item ${index + 1}`,
      options: itemOptions.map((option, optionIndex) => {
        const optionValue =
          typeof option.option_index === 'number' ? option.option_index : optionIndex + 1
        const isCorrect = itemCorrectIndex != null && optionValue === itemCorrectIndex
        return {
          key: String(option.id ?? `${String(item.id)}-${option.option_index ?? optionIndex}`),
          letter: getOptionLetter(option, optionIndex),
          text: option.option_text?.trim() ?? '',
          isCorrect,
        }
      }),
      deleting: deletingItemIds.has(String(item.id)),
    }
  })

  return (
    <main
      className={`min-h-screen bg-slate-50 px-4 py-6 sm:px-6 transition-opacity duration-500 ease-out ${
        isContentVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="relative">
          <button
            type="button"
            onClick={() => router.push('/decks')}
            aria-label="Volver a mazos"
            title="Volver a mazos"
            className="mb-2 inline-flex h-9 min-w-[52px] items-center justify-center rounded-lg bg-[#E8A598] text-white transition hover:bg-[#D98C7D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A598]/60 xl:absolute xl:-left-32 xl:top-2 xl:mb-0"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
            >
              <path d="M19 12H5" />
              <path d="M11 18l-6-6 6-6" />
            </svg>
          </button>
          <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Workspace de aprendizaje
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{deckTitle}</h1>
            {deckSubjects.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {deckSubjects.map((subject) => (
                  <span
                    key={subject.name}
                    className="rounded-full border bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {subject.name} {subject.percent}%
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[340px] sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setActiveDeckTab('trash')
              }}
              aria-label="Papelera de preguntas"
              title="Papelera"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleStartStudy()
              }}
              disabled={studyLoading}
              className="inline-flex min-w-[132px] items-center justify-center rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Estudiar
            </button>
          </div>
          </header>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nuevas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.new}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Falladas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.failed}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              En aprendizaje
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.learning}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dominadas
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {deckSummaryLoading ? '--' : deckSummary.mastered}
            </p>
          </div>
        </section>
        {deckSummaryError ? <p className="text-sm text-slate-600">{deckSummaryError}</p> : null}
        {subjectPerformance.length > 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-2 font-semibold text-slate-900">Acierto por asignatura</h3>
            <div className="space-y-3">
              {subjectPerformance.map((subject) => (
                <div
                  key={subject.subject}
                  className="grid grid-cols-1 items-center gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_14rem_auto]"
                >
                  <span className="truncate text-slate-700">{subject.subject}</span>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${subject.accuracy}%` }}
                    />
                  </div>
                  <span className="font-medium text-slate-900 sm:w-12 sm:text-right">
                    {subject.accuracy}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              {activeDeckTab === 'items' ? 'PREGUNTAS' : 'PAPELERA'}
            </p>
            <span className="text-sm text-slate-500">
              {activeDeckTab === 'items'
                ? `${items.length} items`
                : `${trashCountLoading ? '--' : trashCount} en papelera`}
            </span>
          </div>
          {deckItemsActionError ? (
            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {deckItemsActionError}
            </p>
          ) : null}
          {activeDeckTab === 'items' ? (
            <DeckItemsList
              entries={deckItemEntries}
              onDelete={(entryId) => {
                void handleDeleteDeckItem(entryId)
              }}
            />
          ) : (
            <>
              {trashItemsError ? (
                <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {trashItemsError}
                </p>
              ) : null}
              {trashItemsLoading ? (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <GooFissionLoader size={64} label="Cargando papelera" showGlow={false} />
                  <span>Cargando papelera...</span>
                </div>
              ) : (
                <DeckTrashList
                  items={trashItems}
                  restoringItemIds={restoringTrashItemIds}
                  onRestore={(itemId) => {
                    void handleRestoreTrashItem(itemId)
                  }}
                  onExpire={handleExpireTrashItem}
                />
              )}
            </>
          )}
        </section>
      </div>
      {undoToast ? (
        <UndoDeleteToast
          message={undoToast.message}
          isVisible={undoToast.isVisible}
          tone={undoToast.tone}
          actionLabel={undoToast.showAction && undoItem ? 'Deshacer' : undefined}
          actionDisabled={undoBusy}
          onAction={
            undoToast.showAction && undoItem
              ? () => {
                  void handleUndoDelete()
                }
              : undefined
          }
        />
      ) : null}
      {isStudyLimitModalOpen ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[2px] transition-all duration-300 ease-out ${
            isStudyLimitModalVisible ? 'bg-slate-900/45 opacity-100' : 'bg-slate-900/0 opacity-0'
          }`}
        >
          <div
            className={`w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              subjectFilterOptions.length > 8 ? 'max-w-2xl' : 'max-w-md'
            } ${
              isStudyLimitModalVisible
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-3 scale-[0.97] opacity-0'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Configurar sesión
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">¿Cuántas tarjetas quieres estudiar?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Elige el numero de preguntas que quieres ver en esta sesion.
            </p>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">MODO DE ESTUDIO</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStudyRequestMode('normal')
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    studyRequestMode === 'normal'
                      ? 'border-[#E8A598] bg-[#FFF4F1] text-[#C4655A]'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudyRequestMode('smart')
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    studyRequestMode === 'smart'
                      ? 'border-[#E8A598] bg-[#FFF4F1] text-[#C4655A]'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                  }`}
                >
                  Smart Review
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                FILTROS
              </label>
              <div className="rounded-xl border border-[#E8A598]/60 bg-[#E8A598]/25 px-3 py-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Asignaturas
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectFilter([])
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Limpiar
                  </button>
                </div>
                <div
                  className={`space-y-2 transition-[max-height] duration-300 ease-out ${
                    subjectFilterOptions.length > 8 ? 'max-h-52 overflow-y-auto pr-1' : 'max-h-80'
                  }`}
                >
                  {subjectFilterOptions.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay asignaturas disponibles.</p>
                  ) : (
                    subjectFilterOptions.map((option) => {
                      const checked = subjectFilter.includes(option.value)
                      return (
                        <label
                          key={option.value}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          <span className="truncate">{option.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">({option.count})</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const enabled = event.target.checked
                                setSubjectFilter((prev) => {
                                  if (enabled) {
                                    if (prev.includes(option.value)) return prev
                                    return [...prev, option.value]
                                  }
                                  return prev.filter((entry) => entry !== option.value)
                                })
                              }}
                              className="h-4 w-4 rounded border-slate-300 text-[#E8A598] focus:ring-[#E8A598]/40"
                            />
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-slate-700">
                  PRIORIDAD
                </p>
                <div
                  aria-disabled={studyRequestMode === 'smart'}
                  className={`flex flex-wrap gap-2 ${
                    studyRequestMode === 'smart' ? 'opacity-45' : ''
                  }`}
                >
                  <button
                    type="button"
                    disabled={studyRequestMode === 'smart'}
                    onClick={() => {
                      setStatusFilter(null)
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      studyRequestMode === 'smart'
                        ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400'
                        : statusFilter == null
                        ? 'border-[#E8A598] bg-[#FFF4F1] text-[#C4655A]'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    Todos
                  </button>
                  {STUDY_STATUS_OPTIONS.map((option) => {
                    const selected = statusFilter === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={studyRequestMode === 'smart'}
                        onClick={() => {
                          setStatusFilter(option.value)
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          studyRequestMode === 'smart'
                            ? 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400'
                            : selected
                            ? 'border-[#E8A598] bg-[#FFF4F1] text-[#C4655A]'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${option.dotClass}`} />
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="study-limit-input" className="mb-2 block text-sm font-medium text-slate-700">
                Número de tarjetas
              </label>
              <input
                id="study-limit-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={studyLimitInput}
                autoFocus
                onChange={(event) => {
                  const digitsOnly = event.target.value.replace(/\D+/g, '')
                  setStudyLimitInput(digitsOnly)
                  if (studyLimitError) setStudyLimitError(null)
                }}
                onFocus={(event) => {
                  event.currentTarget.select()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    confirmStudyLimit()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closeStudyLimitModal(null)
                  }
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#E8A598] focus:ring-4 focus:ring-[#E8A598]/25"
              />
              {studyLimitError ? <p className="mt-2 text-sm text-rose-600">{studyLimitError}</p> : null}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  closeStudyLimitModal(null)
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmStudyLimit}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Empezar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

