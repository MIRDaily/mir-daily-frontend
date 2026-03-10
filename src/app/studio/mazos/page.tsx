'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'
import { restoreDeck, softDeleteDeck } from '@/lib/studio/trash'
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

function isFailedQuestionsDeck(deck: Deck): boolean {
  return String(deck.name || '').trim().toLowerCase() === 'mis preguntas falladas'
}

type ShimmerDirection = 'top' | 'right' | 'bottom' | 'left'

function getMouseEntryDirection(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): ShimmerDirection {
  const rect = element.getBoundingClientRect()
  const topDistance = Math.abs(clientY - rect.top)
  const bottomDistance = Math.abs(rect.bottom - clientY)
  const leftDistance = Math.abs(clientX - rect.left)
  const rightDistance = Math.abs(rect.right - clientX)
  const minDistance = Math.min(topDistance, bottomDistance, leftDistance, rightDistance)

  if (minDistance === topDistance) return 'top'
  if (minDistance === bottomDistance) return 'bottom'
  if (minDistance === leftDistance) return 'left'
  return 'right'
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
  isFailedQuestions,
  onOpen,
  onDelete,
  deleting,
}: {
  deck: Deck
  isFailedQuestions: boolean
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const mastery = clampPercent(deck.masteryPercentage)
  const totalItems = Math.max(0, Math.round(toSafeNumber(deck.totalItems)))
  const dueToday = Math.max(0, Math.round(toSafeNumber(deck.dueToday)))
  const subject = (deck.subject || 'PERSONAL').toUpperCase()
  const [shimmerDirection, setShimmerDirection] = useState<ShimmerDirection>('left')
  const [shimmerActive, setShimmerActive] = useState(false)
  const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shimmerFrameRef = useRef<number | null>(null)
  const defaultTheme = getDeckTheme(deck.subject)
  const theme: DeckTheme = isFailedQuestions
    ? {
        cardClass: 'bg-gradient-to-br from-[#FDF1F1] to-white border border-[#F3D9D9]',
        badgeClass: 'bg-white/80 text-rose-600',
        progressClass: 'bg-rose-400',
        dueValueClass: 'text-rose-500',
        subjectClass: 'text-rose-400',
      }
    : defaultTheme

  useEffect(() => {
    return () => {
      if (shimmerTimeoutRef.current) {
        clearTimeout(shimmerTimeoutRef.current)
        shimmerTimeoutRef.current = null
      }
      if (shimmerFrameRef.current != null) {
        window.cancelAnimationFrame(shimmerFrameRef.current)
        shimmerFrameRef.current = null
      }
      }
  }, [])

  const triggerDirectionalShimmer = (direction: ShimmerDirection) => {
    if (shimmerTimeoutRef.current) {
      clearTimeout(shimmerTimeoutRef.current)
      shimmerTimeoutRef.current = null
    }
    if (shimmerFrameRef.current != null) {
      window.cancelAnimationFrame(shimmerFrameRef.current)
      shimmerFrameRef.current = null
    }

    setShimmerDirection(direction)
    setShimmerActive(false)
    shimmerFrameRef.current = window.requestAnimationFrame(() => {
      shimmerFrameRef.current = null
      setShimmerActive(true)
    })

    shimmerTimeoutRef.current = setTimeout(() => {
      shimmerTimeoutRef.current = null
      setShimmerActive(false)
    }, 1100)
  }

  const isVerticalTravel = shimmerDirection === 'top' || shimmerDirection === 'bottom'
  const coreBandShapeClass = isVerticalTravel
    ? 'left-[-8%] w-[116%] h-[12%]'
    : 'top-[-8%] h-[116%] w-[12%]'
  const glowBandShapeClass = isVerticalTravel
    ? 'left-[-10%] w-[120%] h-[18%]'
    : 'top-[-10%] h-[120%] w-[18%]'
  const coreAnimationClass =
    shimmerActive && shimmerDirection === 'top'
      ? 'animate-shimmer-top-core'
      : shimmerActive && shimmerDirection === 'bottom'
        ? 'animate-shimmer-bottom-core'
        : shimmerActive && shimmerDirection === 'left'
          ? 'animate-shimmer-left-core'
          : shimmerActive && shimmerDirection === 'right'
            ? 'animate-shimmer-right-core'
            : ''
  const glowAnimationClass =
    shimmerActive && shimmerDirection === 'top'
      ? 'animate-shimmer-top-glow'
      : shimmerActive && shimmerDirection === 'bottom'
        ? 'animate-shimmer-bottom-glow'
        : shimmerActive && shimmerDirection === 'left'
          ? 'animate-shimmer-left-glow'
          : shimmerActive && shimmerDirection === 'right'
            ? 'animate-shimmer-right-glow'
            : ''

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onMouseEnter={(event) => {
        const direction = getMouseEntryDirection(event.currentTarget, event.clientX, event.clientY)
        triggerDirectionalShimmer(direction)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
      className={`group relative overflow-hidden rounded-2xl p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A598] ${theme.cardClass}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute z-0 ${coreBandShapeClass} ${coreAnimationClass} bg-gradient-to-r from-transparent via-white to-transparent opacity-0 mix-blend-screen`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute z-0 ${glowBandShapeClass} ${glowAnimationClass} bg-gradient-to-r from-transparent via-[#FFD7CC] to-transparent opacity-0 blur-[10px] mix-blend-screen`}
      />
      <div className="relative z-10">
        <p className={`text-xs uppercase tracking-wide ${theme.subjectClass}`}>{subject}</p>

        <div className="mt-3 flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-800">{deck.name || `Mazo ${deck.id}`}</h3>
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${theme.badgeClass}`}>
              {totalItems} cards
            </span>
            <button
              type="button"
              aria-label="Enviar mazo a papelera"
              disabled={deleting}
              onClick={(event) => {
                event.stopPropagation()
                event.preventDefault()
                onDelete()
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
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
      </div>

      <style jsx>{`
        .animate-shimmer-top-core {
          animation: shimmerTopCore 920ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-bottom-core {
          animation: shimmerBottomCore 920ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-left-core {
          animation: shimmerLeftCore 920ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-right-core {
          animation: shimmerRightCore 920ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-top-glow {
          animation: shimmerTopGlow 1060ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-bottom-glow {
          animation: shimmerBottomGlow 1060ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-left-glow {
          animation: shimmerLeftGlow 1060ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-right-glow {
          animation: shimmerRightGlow 1060ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        @keyframes shimmerTopCore {
          0% { transform: translateY(-140%); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateY(820%); opacity: 0; }
        }
        @keyframes shimmerBottomCore {
          0% { transform: translateY(820%); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateY(-140%); opacity: 0; }
        }
        @keyframes shimmerLeftCore {
          0% { transform: translateX(-140%); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateX(820%); opacity: 0; }
        }
        @keyframes shimmerRightCore {
          0% { transform: translateX(820%); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translateX(-140%); opacity: 0; }
        }
        @keyframes shimmerTopGlow {
          0% { transform: translateY(-170%); opacity: 0; }
          18% { opacity: 0.95; }
          100% { transform: translateY(640%); opacity: 0; }
        }
        @keyframes shimmerBottomGlow {
          0% { transform: translateY(640%); opacity: 0; }
          18% { opacity: 0.95; }
          100% { transform: translateY(-170%); opacity: 0; }
        }
        @keyframes shimmerLeftGlow {
          0% { transform: translateX(-170%); opacity: 0; }
          18% { opacity: 0.95; }
          100% { transform: translateX(640%); opacity: 0; }
        }
        @keyframes shimmerRightGlow {
          0% { transform: translateX(640%); opacity: 0; }
          18% { opacity: 0.95; }
          100% { transform: translateX(-170%); opacity: 0; }
        }
      `}</style>
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
  const [deletingDeckIds, setDeletingDeckIds] = useState<Set<string>>(new Set())
  const [undoDeck, setUndoDeck] = useState<{ deck: Deck; index: number } | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [undoToast, setUndoToast] = useState<{
    message: string
    tone: 'neutral' | 'success' | 'error'
    showAction: boolean
    isVisible: boolean
  } | null>(null)
  const undoExpireTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoToastAnimationFrameRef = useRef<number | null>(null)
  const pendingDeleteRequestsRef = useRef<Map<string, Promise<void>>>(new Map())

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

  const clearUndoToastAnimationFrame = () => {
    if (undoToastAnimationFrameRef.current == null) return
    window.cancelAnimationFrame(undoToastAnimationFrameRef.current)
    undoToastAnimationFrameRef.current = null
  }

  const hideUndoToast = () => {
    setUndoToast((prev) => (prev ? { ...prev, isVisible: false } : null))
    clearUndoToastTimeout()
    undoToastTimeoutRef.current = setTimeout(() => {
      undoToastTimeoutRef.current = null
      setUndoToast(null)
    }, 240)
  }

  const showUndoToast = (
    message: string,
    tone: 'neutral' | 'success' | 'error',
    showAction: boolean,
  ) => {
    clearUndoToastAnimationFrame()
    clearUndoToastTimeout()
    setUndoToast({ message, tone, showAction, isVisible: false })
    undoToastAnimationFrameRef.current = window.requestAnimationFrame(() => {
      undoToastAnimationFrameRef.current = null
      setUndoToast((prev) => (prev ? { ...prev, isVisible: true } : prev))
    })
  }

  const showTimedToast = (message: string, tone: 'neutral' | 'success' | 'error') => {
    showUndoToast(message, tone, false)
    clearUndoToastTimeout()
    undoToastTimeoutRef.current = setTimeout(() => {
      undoToastTimeoutRef.current = null
      hideUndoToast()
    }, 2500)
  }

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

  useEffect(() => {
    const pendingDeleteRequests = pendingDeleteRequestsRef.current

    return () => {
      clearUndoExpireTimeout()
      clearUndoToastTimeout()
      clearUndoToastAnimationFrame()
      pendingDeleteRequests.clear()
    }
  }, [])

  const sortedDecks = useMemo(
    () => {
      const alphaSorted = [...decks].sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), 'es', {
          sensitivity: 'base',
        }),
      )

      if (alphaSorted.length <= 1) return alphaSorted

      const failedDeck = alphaSorted.find((deck) => isFailedQuestionsDeck(deck))
      if (!failedDeck) return alphaSorted

      return [
        failedDeck,
        ...alphaSorted.filter((deck) => String(deck.id) !== String(failedDeck.id)),
      ]
    },
    [decks],
  )

  const failedDeckId = sortedDecks.length > 0 ? String(sortedDecks[0].id) : null

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

  const handleDeleteDeck = async (deck: Deck) => {
    if (undoBusy) return

    const deckId = String(deck.id)
    if (!deckId) return
    const index = decks.findIndex((entry) => String(entry.id) === deckId)
    if (index < 0) return

    clearUndoExpireTimeout()
    clearUndoToastTimeout()
    clearUndoToastAnimationFrame()
    setDecksError(null)
    setUndoDeck({ deck, index })
    showUndoToast('Mazo enviado a papelera (24h)', 'neutral', true)

    undoExpireTimeoutRef.current = setTimeout(() => {
      undoExpireTimeoutRef.current = null
      setUndoDeck(null)
      hideUndoToast()
    }, 6000)

    setDeletingDeckIds((prev) => {
      const next = new Set(prev)
      next.add(deckId)
      return next
    })
    setDecks((prev) => prev.filter((entry) => String(entry.id) !== deckId))

    const deletePromise = softDeleteDeck(deckId)
    pendingDeleteRequestsRef.current.set(deckId, deletePromise)

    try {
      await deletePromise
    } catch (err) {
      setDecks((prev) => {
        if (prev.some((entry) => String(entry.id) === deckId)) return prev
        const next = [...prev]
        const insertIndex = Math.max(0, Math.min(index, next.length))
        next.splice(insertIndex, 0, deck)
        return next
      })
      setUndoDeck((prev) => (prev?.deck.id === deck.id ? null : prev))
      hideUndoToast()
      showTimedToast(
        err instanceof Error ? err.message : 'No se pudo enviar el mazo a la papelera.',
        'error',
      )
    } finally {
      pendingDeleteRequestsRef.current.delete(deckId)
      setDeletingDeckIds((prev) => {
        const next = new Set(prev)
        next.delete(deckId)
        return next
      })
    }
  }

  const handleUndoDeleteDeck = async () => {
    if (!undoDeck || undoBusy) return

    const deckId = String(undoDeck.deck.id)
    setUndoBusy(true)
    clearUndoExpireTimeout()
    setDecksError(null)

    try {
      const pendingDelete = pendingDeleteRequestsRef.current.get(deckId)
      if (pendingDelete) await pendingDelete
      await restoreDeck(deckId)
      setDecks((prev) => {
        if (prev.some((entry) => String(entry.id) === deckId)) return prev
        const next = [...prev]
        const insertIndex = Math.max(0, Math.min(undoDeck.index, next.length))
        next.splice(insertIndex, 0, undoDeck.deck)
        return next
      })
      setUndoDeck(null)
      showTimedToast('Mazo restaurado', 'success')
    } catch (err) {
      setUndoDeck(null)
      showTimedToast(err instanceof Error ? err.message : 'No se pudo restaurar el mazo.', 'error')
    } finally {
      setUndoBusy(false)
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
          <div className="flex items-center gap-2">
            <Link
              href="/studio/trash"
              aria-label="Papelera de mazos"
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
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Crear mazo
            </button>
          </div>
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
                isFailedQuestions={String(deck.id) === failedDeckId}
                onOpen={() => router.push(`/studio/${deck.id}`)}
                deleting={deletingDeckIds.has(String(deck.id))}
                onDelete={() => {
                  void handleDeleteDeck(deck)
                }}
              />
            ))}
          </section>
        )}
      </main>
      {undoToast ? (
        <UndoDeleteToast
          message={undoToast.message}
          tone={undoToast.tone}
          isVisible={undoToast.isVisible}
          actionLabel={undoToast.showAction && undoDeck ? 'Deshacer' : undefined}
          actionDisabled={undoBusy}
          onAction={
            undoToast.showAction && undoDeck
              ? () => {
                  void handleUndoDeleteDeck()
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}
