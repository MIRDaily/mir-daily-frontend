'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import GooFissionLoader from '@/components/studio/GooFissionLoader'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'
import { DeckBannerGradient, DEFAULT_DECK_GRADIENT, isDeckGradientId } from '@/components/studio/deckUi'
import { useProfile } from '@/hooks/useProfile'
import { restoreDeck, softDeleteDeck } from '@/lib/studio/trash'
import { supabase } from '@/lib/supabaseBrowser'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

type Deck = {
  id: string | number
  name: string
  subject?: string | null
  totalItems?: number | null
  total_items?: number | null
  masteryPercentage?: number | null
  accuracy?: number | null
  visual_state?: string | null
  texture?: string | null
  samples?: number | null
  total_reviews?: number | null
  dueToday?: number | null
  deleted_at?: string | null
  system_generated?: boolean
  auto_type?: string | null
  position?: number | null
  banner_gradient?: string | null
  description?: string | null
  subjects?: Array<{ subject: string; percent: number }> | null
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

function getDomainColor(percent: number): string {
  if (percent < 40) return 'bg-red-400'
  if (percent < 70) return 'bg-orange-400'
  if (percent < 85) return 'bg-yellow-400'
  return 'bg-emerald-500'
}

function getDeckTheme(subject?: string | null): DeckTheme {
  const value = String(subject || '').toLowerCase()

  if (value.includes('cardio')) {
    return {
      cardClass: '',
      badgeClass: 'bg-white/80 text-slate-500',
      progressClass: 'bg-emerald-500',
      dueValueClass: 'text-[#8BA888]',
      subjectClass: 'text-[#7FA07B]',
    }
  }

  if (value.includes('neuro')) {
    return {
      cardClass: '',
      badgeClass: 'bg-white/80 text-slate-500',
      progressClass: 'bg-slate-500',
      dueValueClass: 'text-[#7D8A96]',
      subjectClass: 'text-[#7D8A96]',
    }
  }

  if (value.includes('infecc')) {
    return {
      cardClass: '',
      badgeClass: 'bg-white/80 text-slate-500',
      progressClass: 'bg-emerald-500',
      dueValueClass: 'text-[#E8A598]',
      subjectClass: 'text-[#C79374]',
    }
  }

  return {
    cardClass: '',
    badgeClass: 'bg-white/80 text-slate-500',
    progressClass: 'bg-emerald-500',
    dueValueClass: 'text-[#E8A598]',
    subjectClass: 'text-[#D49A8D]',
  }
}

function getStableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getDeckTextureFromVisualState(deck: Deck): string {
  const visualState = String(deck.visual_state ?? '').trim().toLowerCase()
  const numericId = Number(deck.id)
  const stableBase = Number.isFinite(numericId)
    ? Math.abs(Math.trunc(numericId))
    : getStableHash(String(deck.id))
  const variant = (stableBase % 8) + 1

  if (visualState === 'perfect') return '/textures/decks/perfect_1.svg'
  if (visualState === 'clean') return `/textures/decks/clean_${variant}.svg`
  if (visualState === 'torn' || visualState === 'destroyed') return `/textures/decks/torn_${variant}.svg`
  return `/textures/decks/clean_${variant}.svg`
}

function getDeckTexture(deck: Deck): string {
  const explicitTexture = String(deck.texture ?? '').trim()
  if (explicitTexture) return explicitTexture

  return getDeckTextureFromVisualState(deck)
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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  const res = await fetch(`${API_URL}/api/studio/decks`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout)
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudieron cargar los mazos (${res.status})`))
  }

  const payload = (await res.json().catch(() => null)) as unknown

  const normalizeDecks = (entries: unknown[]): Deck[] =>
    entries.map((entry) => {
      if (!entry || typeof entry !== 'object') return {} as Deck
      const row = entry as Record<string, unknown>
      return {
        ...(row as unknown as Deck),
        texture:
          typeof row.texture === 'string'
            ? row.texture
            : typeof row.deck_texture === 'string'
              ? row.deck_texture
              : typeof row.texture_path === 'string'
                ? row.texture_path
                : null,
      }
    })

  if (Array.isArray(payload)) return normalizeDecks(payload)
  if (payload && typeof payload === 'object') {
    const asRecord = payload as Record<string, unknown>
    if (Array.isArray(asRecord.decks)) return normalizeDecks(asRecord.decks)
    const data = asRecord.data
    if (data && typeof data === 'object') {
      const dataRecord = data as Record<string, unknown>
      if (Array.isArray(dataRecord.decks)) return normalizeDecks(dataRecord.decks)
    }
  }
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

async function reorderDecks(token: string, orderedDeckIds: string[]): Promise<void> {
  const res = await fetch(`${API_URL}/api/studio/decks/reorder`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderedDeckIds }),
  })

  if (!res.ok) {
    throw new Error(await readError(res, `No se pudo guardar el orden de mazos (${res.status})`))
  }
}

function DeckCard({
  deck,
  deckTexture,
  textureTransition,
  onTextureTransitionEnd,
  isFailedQuestions,
  galleryStyle,
  onOpen,
  onDelete,
  deleting,
  interactive = true,
  showDeleteButton = true,
}: {
  deck: Deck
  deckTexture: string
  textureTransition: boolean
  onTextureTransitionEnd?: () => void
  isFailedQuestions: boolean
  galleryStyle: 'default' | 'gradient'
  onOpen: () => void
  onDelete?: () => void
  deleting: boolean
  interactive?: boolean
  showDeleteButton?: boolean
}) {
  const isGradientStyle = galleryStyle === 'gradient'
  // "Mis preguntas falladas" no admite elegir gradiente (igual que en su
  // propia pantalla): banner_gradient nunca se le llega a guardar, así que
  // cae sola en el valor por defecto (albaricoque) al no ser un id válido.
  const gradientId = isDeckGradientId(deck.banner_gradient) ? deck.banner_gradient : DEFAULT_DECK_GRADIENT
  // Bio del mazo (o el aviso fijo del mazo de fallos) en vez de la etiqueta
  // "PERSONAL", que salía igual para cualquier mazo propio y no aportaba
  // nada. El resto — nombre, dominio, nº de tarjetas, papelera — se queda.
  const subtitle = isFailedQuestions
    ? 'Tus fallos recientes, listos para repasar.'
    : deck.description?.trim() || null
  const samplesCount = Math.max(0, Math.round(toSafeNumber(deck.total_reviews ?? deck.samples)))
  const hasUnknownMastery = deck.accuracy === null || samplesCount < 25
  const accuracyPercent = hasUnknownMastery
    ? 0
    : clampPercent(Math.round(toSafeNumber(deck.accuracy) * 100))
  const domainColorClass = getDomainColor(accuracyPercent)
  const totalItems = Math.max(0, Math.round(toSafeNumber(deck.totalItems)))
  const [shimmerDirection, setShimmerDirection] = useState<ShimmerDirection>('left')
  const [shimmerActive, setShimmerActive] = useState(false)
  const [isPointerInside, setIsPointerInside] = useState(false)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shimmerFrameRef = useRef<number | null>(null)
  const defaultTheme = getDeckTheme(deck.subject)
  const theme: DeckTheme = isFailedQuestions
    ? {
        cardClass: '',
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

  const shimmerFromTopLeft = shimmerDirection === 'bottom' || shimmerDirection === 'right'
  const coreBandShapeClass = 'shimmer-core'
  const glowBandShapeClass = 'shimmer-glow'
  const coreAnimationClass = shimmerActive
    ? shimmerFromTopLeft
      ? 'animate-shimmer-diag-down-core'
      : 'animate-shimmer-diag-up-core'
    : ''
  const glowAnimationClass = shimmerActive
    ? shimmerFromTopLeft
      ? 'animate-shimmer-diag-down-glow'
      : 'animate-shimmer-diag-up-glow'
    : ''
  const tiltTransform = `translateY(${isPointerInside ? -3 : 0}px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
  const hoverShadowOpacity = isPointerInside ? 1 : 0

  return (
    <article
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : -1}
      style={{
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        transform: interactive ? tiltTransform : undefined,
        ['--light-x' as string]: '50%',
        ['--light-y' as string]: '50%',
      }}
      onClick={interactive ? onOpen : undefined}
      onMouseEnter={interactive ? (event) => {
        const direction = getMouseEntryDirection(event.currentTarget, event.clientX, event.clientY)
        setIsPointerInside(true)
        triggerDirectionalShimmer(direction)
      } : undefined}
      onMouseMove={interactive ? (event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        const rotateY = Math.max(-3, Math.min(3, (x - 0.5) * 6))
        const rotateX = Math.max(-3, Math.min(3, (0.5 - y) * 6))
        event.currentTarget.style.setProperty('--light-x', `${x * 100}%`)
        event.currentTarget.style.setProperty('--light-y', `${y * 100}%`)
        setTilt({ rotateX, rotateY })
      } : undefined}
      onMouseLeave={interactive ? () => {
        setIsPointerInside(false)
        setTilt({ rotateX: 0, rotateY: 0 })
      } : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      } : undefined}
      className={`deck-card group relative aspect-[900/336] min-h-[210px] overflow-visible p-0 hover:z-40 focus-within:z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A598] sm:min-h-[230px] [transform-style:preserve-3d] ${theme.cardClass}`}
    >
      {isGradientStyle ? (
        // Mismo degradado que la cabecera del mazo individual, pero congelado
        // (ver DeckBannerGradient). Ya no se recorta con la silueta de carta
        // ilustrada — lleva el borde de tinta y la sombra dura del propio
        // mazo (StickerCard/Hero), no el contorno que dibujaba la textura.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl border-2 border-[#2c3e50]"
          style={{ boxShadow: '6px 6px 0 0 #2c3e50' }}
        >
          <DeckBannerGradient id={gradientId} animated={false} />
        </div>
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat [background-size:100%_100%] transition-opacity duration-200"
            style={{
              backgroundImage: `url(${deckTexture})`,
              filter:
                'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.08)) drop-shadow(0 20px 48px rgba(0, 0, 0, 0.10))',
              opacity: hoverShadowOpacity,
            }}
          />
          <span
            aria-hidden
            onAnimationEnd={() => {
              if (textureTransition) onTextureTransitionEnd?.()
            }}
            className={`pointer-events-none absolute inset-0 z-[1] bg-center bg-no-repeat [background-size:100%_100%] ${
              textureTransition ? 'deck-texture-transition' : ''
            }`}
            style={{ backgroundImage: `url(${deckTexture})` }}
          />
        </>
      )}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[2] ${coreBandShapeClass} ${coreAnimationClass}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[2] ${glowBandShapeClass} ${glowAnimationClass}`}
      />
      {/* top-7% (antes 11%): con la bio siempre reservada (2 líneas) más
          Dominio, el contenido llegaba a solo ~19px del borde inferior real
          de la tarjeta — encima del marco decorativo dibujado en la textura
          ilustrada. bottom-X no sirve aquí para dar margen (el contenido no
          está pegado a ese borde, crece desde arriba y ya lo desbordaba, así
          que moverlo no cambiaba nada — comprobado midiendo antes/después);
          hay que subir el punto de partida para que todo el bloque suba. */}
      {/* El hueco total arriba+abajo (~57-60px) no se puede reducir sin
          achicar la tarjeta o el contenido — top-X%/padding solo reparten
          ese hueco entre los dos bordes, no lo bajan (comprobado: mover uno
          siempre suma lo mismo al otro). pt-5 reparte lo más parecido
          posible entre arriba y abajo dentro de ese margen fijo. */}
      <div className="absolute left-[3.1%] right-[3.1%] top-[3%] bottom-[8.3%] z-10 flex flex-col px-4 pb-3 pt-8 sm:px-5">
        <div className="flex items-center justify-end gap-2">
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${theme.badgeClass}`}>
            {totalItems} cards
          </span>
          {showDeleteButton ? (
            <button
              type="button"
              aria-label="Enviar mazo a papelera"
              disabled={deleting}
              onClick={(event) => {
                event.stopPropagation()
                event.preventDefault()
                onDelete?.()
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50/70 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          ) : null}
        </div>

        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-[clamp(1.25rem,1.5vw,1.9rem)] font-semibold leading-[1.2] text-slate-800">
            {deck.name || `Mazo ${deck.id}`}
          </h3>
        </div>

        {/* Hueco de la bio siempre reservado (2 líneas), tenga o no tenga
            texto el mazo — si no, un mazo sin bio dejaba la barra de Dominio
            pegada al título mientras que uno con bio la empujaba más abajo,
            así que la misma pieza aparecía en una posición distinta según el
            mazo. min-h fuerza el mismo punto de partida siempre.
            leading-snug (en vez de leading-relaxed) para que esas 2 líneas
            reservadas ocupen menos alto sin dejar de ser 2 líneas. */}
        <p className="mt-1 line-clamp-2 min-h-[33px] break-words text-xs font-medium leading-snug text-slate-500 sm:min-h-[39px] sm:text-sm">
          {subtitle}
        </p>

        {/* El mazo de fallos no tiene Dominio: su contenido cambia solo con
            cada acierto/fallo, un % de largo plazo no significa nada ahí
            (mismo criterio que ya se aplica en su cabecera). */}
        {isFailedQuestions ? null : (
          <div className="mt-2">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 sm:text-sm">
              <span>Dominio</span>
              {hasUnknownMastery ? (
                <div className="group/mastery relative">
                  <button
                    type="button"
                    aria-label="Dominio no disponible aún"
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                    }}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-xs font-bold text-slate-600"
                  >
                    ?
                  </button>
                  <div
                    role="tooltip"
                    className="pointer-events-none invisible absolute right-0 top-full z-[100] mt-2 w-72 rounded-xl border border-slate-200 bg-white/95 p-3 text-left opacity-0 shadow-lg transition-opacity duration-200 group-hover/mastery:visible group-hover/mastery:opacity-100 group-focus-within/mastery:visible group-focus-within/mastery:opacity-100"
                  >
                    <p className="text-xs font-semibold text-slate-800">Dominio del mazo</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      El dominio se estima usando tus ultimas 25 respuestas en este mazo. Aun no hay
                      suficientes datos para calcularlo. Responde al menos 25 preguntas para estimar
                      tu dominio.
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-slate-600">{accuracyPercent}%</span>
              )}
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${domainColorClass}`}
                style={{ width: `${accuracyPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .deck-card::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          overflow: hidden;
          opacity: 0;
          z-index: 3;
          transition: opacity 180ms ease;
          background: radial-gradient(
            circle at var(--light-x) var(--light-y),
            rgba(255, 255, 255, 0.3),
            transparent 40%
          );
        }
        .deck-card:hover::before {
          opacity: 1;
        }
        .deck-texture-transition {
          animation: deckTextureShift 400ms ease-out;
          transform-origin: center center;
        }
        @keyframes deckTextureShift {
          0% {
            transform: scale(0.98);
            filter: brightness(0.9);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.02);
            filter: brightness(1.1);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
            opacity: 1;
          }
        }
        .shimmer-core {
          opacity: 0;
          background-image: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0) 42%,
            rgba(255, 255, 255, 0.75) 50%,
            rgba(255, 255, 255, 0) 58%
          );
          background-size: 220% 220%;
          background-repeat: no-repeat;
          background-position: -160% -160%;
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(120% 100% at 50% 50%, #000 58%, transparent 100%);
          mask-image: radial-gradient(120% 100% at 50% 50%, #000 58%, transparent 100%);
        }
        .shimmer-glow {
          opacity: 0;
          background-image: linear-gradient(
            135deg,
            rgba(255, 215, 204, 0) 38%,
            rgba(255, 215, 204, 0.9) 50%,
            rgba(255, 215, 204, 0) 62%
          );
          background-size: 260% 260%;
          background-repeat: no-repeat;
          background-position: -170% -170%;
          filter: blur(14px);
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(125% 105% at 50% 50%, #000 52%, transparent 100%);
          mask-image: radial-gradient(125% 105% at 50% 50%, #000 52%, transparent 100%);
        }
        .animate-shimmer-diag-down-core {
          animation: shimmerDiagDownCore 1850ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-up-core {
          animation: shimmerDiagUpCore 1850ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-down-glow {
          animation: shimmerDiagDownGlow 2150ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-up-glow {
          animation: shimmerDiagUpGlow 2150ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        @keyframes shimmerDiagDownCore {
          0% { background-position: -140% -140%; opacity: 0; }
          12% { opacity: 1; }
          100% { background-position: 140% 140%; opacity: 0; }
        }
        @keyframes shimmerDiagUpCore {
          0% { background-position: 140% 140%; opacity: 0; }
          12% { opacity: 1; }
          100% { background-position: -140% -140%; opacity: 0; }
        }
        @keyframes shimmerDiagDownGlow {
          0% { background-position: -160% -160%; opacity: 0; }
          18% { opacity: 0.95; }
          100% { background-position: 130% 130%; opacity: 0; }
        }
        @keyframes shimmerDiagUpGlow {
          0% { background-position: 130% 130%; opacity: 0; }
          18% { opacity: 0.95; }
          100% { background-position: -160% -160%; opacity: 0; }
        }
      `}</style>
    </article>
  )
}

function SortableDeckCard({
  deck,
  children,
}: {
  deck: Deck
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(deck.id),
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`touch-none ${isDragging ? 'z-50 cursor-grabbing' : 'cursor-grab'}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

function ConstructionDeckPlaceholder() {
  const [shimmerDirection, setShimmerDirection] = useState<ShimmerDirection>('left')
  const [shimmerActive, setShimmerActive] = useState(false)
  const [isPointerInside, setIsPointerInside] = useState(false)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shimmerFrameRef = useRef<number | null>(null)

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

  const shimmerFromTopLeft = shimmerDirection === 'bottom' || shimmerDirection === 'right'
  const coreAnimationClass = shimmerActive
    ? shimmerFromTopLeft
      ? 'animate-shimmer-diag-down-core'
      : 'animate-shimmer-diag-up-core'
    : ''
  const glowAnimationClass = shimmerActive
    ? shimmerFromTopLeft
      ? 'animate-shimmer-diag-down-glow'
      : 'animate-shimmer-diag-up-glow'
    : ''
  const tiltTransform = `translateY(${isPointerInside ? -3 : 0}px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`

  return (
    <article
      style={{
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        transform: tiltTransform,
        ['--light-x' as string]: '50%',
        ['--light-y' as string]: '50%',
      }}
      onMouseEnter={(event) => {
        const direction = getMouseEntryDirection(event.currentTarget, event.clientX, event.clientY)
        setIsPointerInside(true)
        triggerDirectionalShimmer(direction)
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        const rotateY = Math.max(-3, Math.min(3, (x - 0.5) * 6))
        const rotateX = Math.max(-3, Math.min(3, (0.5 - y) * 6))
        event.currentTarget.style.setProperty('--light-x', `${x * 100}%`)
        event.currentTarget.style.setProperty('--light-y', `${y * 100}%`)
        setTilt({ rotateX, rotateY })
      }}
      onMouseLeave={() => {
        setIsPointerInside(false)
        setTilt({ rotateX: 0, rotateY: 0 })
      }}
      className="deck-card-placeholder group relative aspect-[900/336] min-h-[210px] overflow-hidden rounded-2xl p-6 sm:min-h-[230px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat [background-size:100%_100%] transition-opacity duration-200"
        style={{
          backgroundImage: 'url(/textures/decks/clean_blue.svg)',
          filter:
            'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.08)) drop-shadow(0 20px 48px rgba(0, 0, 0, 0.10))',
          opacity: 1,
        }}
      />
      <span aria-hidden className={`pointer-events-none absolute inset-0 z-[2] shimmer-core ${coreAnimationClass}`} />
      <span aria-hidden className={`pointer-events-none absolute inset-0 z-[2] shimmer-glow ${glowAnimationClass}`} />
      <span
        aria-hidden
        className="pointer-events-none absolute left-[-18%] top-1/2 z-20 block w-[140%] -translate-y-1/2 -rotate-[17deg] border-y-2 border-black/25 bg-[repeating-linear-gradient(45deg,#facc15_0_16px,#111827_16px_32px)] py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[25] bg-white/15 backdrop-blur-[2.5px]"
      />
      <div className="relative z-30 flex h-full items-center justify-center">
        <span aria-hidden className="pointer-events-none absolute h-20 w-56 rounded-full bg-white/45 blur-2xl" />
        <h3 className="rounded-lg bg-white/85 px-5 py-3 text-2xl font-extrabold text-slate-800 shadow-sm">
          ¡En construcción!
        </h3>
      </div>

      <style jsx>{`
        .deck-card-placeholder::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          overflow: hidden;
          opacity: 0;
          z-index: 3;
          transition: opacity 180ms ease;
          background: radial-gradient(
            circle at var(--light-x) var(--light-y),
            rgba(255, 255, 255, 0.3),
            transparent 40%
          );
        }
        .deck-card-placeholder:hover::before {
          opacity: 1;
        }
        .shimmer-core {
          opacity: 0;
          background-image: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0) 42%,
            rgba(255, 255, 255, 0.75) 50%,
            rgba(255, 255, 255, 0) 58%
          );
          background-size: 220% 220%;
          background-repeat: no-repeat;
          background-position: -160% -160%;
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(120% 100% at 50% 50%, #000 58%, transparent 100%);
          mask-image: radial-gradient(120% 100% at 50% 50%, #000 58%, transparent 100%);
        }
        .shimmer-glow {
          opacity: 0;
          background-image: linear-gradient(
            135deg,
            rgba(255, 215, 204, 0) 38%,
            rgba(255, 215, 204, 0.9) 50%,
            rgba(255, 215, 204, 0) 62%
          );
          background-size: 260% 260%;
          background-repeat: no-repeat;
          background-position: -170% -170%;
          filter: blur(14px);
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(125% 105% at 50% 50%, #000 52%, transparent 100%);
          mask-image: radial-gradient(125% 105% at 50% 50%, #000 52%, transparent 100%);
        }
        .animate-shimmer-diag-down-core {
          animation: shimmerDiagDownCore 1850ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-up-core {
          animation: shimmerDiagUpCore 1850ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-down-glow {
          animation: shimmerDiagDownGlow 2150ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-up-glow {
          animation: shimmerDiagUpGlow 2150ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        @keyframes shimmerDiagDownCore {
          0% { background-position: -140% -140%; opacity: 0; }
          12% { opacity: 1; }
          100% { background-position: 140% 140%; opacity: 0; }
        }
        @keyframes shimmerDiagUpCore {
          0% { background-position: 140% 140%; opacity: 0; }
          12% { opacity: 1; }
          100% { background-position: -140% -140%; opacity: 0; }
        }
        @keyframes shimmerDiagDownGlow {
          0% { background-position: -160% -160%; opacity: 0; }
          18% { opacity: 0.95; }
          100% { background-position: 130% 130%; opacity: 0; }
        }
        @keyframes shimmerDiagUpGlow {
          0% { background-position: 130% 130%; opacity: 0; }
          18% { opacity: 0.95; }
          100% { background-position: -160% -160%; opacity: 0; }
        }
      `}</style>
    </article>
  )
}

function CreateDeckPlaceholder({ onCreate }: { onCreate: () => void }) {
  const [shimmerDirection, setShimmerDirection] = useState<ShimmerDirection>('left')
  const [shimmerActive, setShimmerActive] = useState(false)
  const [isPointerInside, setIsPointerInside] = useState(false)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const shimmerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shimmerFrameRef = useRef<number | null>(null)

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

  const shimmerFromTopLeft = shimmerDirection === 'bottom' || shimmerDirection === 'right'
  const coreAnimationClass = shimmerActive
    ? shimmerFromTopLeft
      ? 'animate-shimmer-diag-down-core'
      : 'animate-shimmer-diag-up-core'
    : ''
  const glowAnimationClass = shimmerActive
    ? shimmerFromTopLeft
      ? 'animate-shimmer-diag-down-glow'
      : 'animate-shimmer-diag-up-glow'
    : ''
  const tiltTransform = `translateY(${isPointerInside ? -3 : 0}px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
  const hoverShadowOpacity = isPointerInside ? 1 : 0

  return (
    <article
      role="button"
      tabIndex={0}
      style={{
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        transition: 'transform 180ms ease, box-shadow 180ms ease',
        transform: tiltTransform,
        ['--light-x' as string]: '50%',
        ['--light-y' as string]: '50%',
      }}
      onClick={onCreate}
      onMouseEnter={(event) => {
        const direction = getMouseEntryDirection(event.currentTarget, event.clientX, event.clientY)
        setIsPointerInside(true)
        triggerDirectionalShimmer(direction)
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
        const rotateY = Math.max(-3, Math.min(3, (x - 0.5) * 6))
        const rotateX = Math.max(-3, Math.min(3, (0.5 - y) * 6))
        event.currentTarget.style.setProperty('--light-x', `${x * 100}%`)
        event.currentTarget.style.setProperty('--light-y', `${y * 100}%`)
        setTilt({ rotateX, rotateY })
      }}
      onMouseLeave={() => {
        setIsPointerInside(false)
        setTilt({ rotateX: 0, rotateY: 0 })
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onCreate()
        }
      }}
      className="deck-card-create group relative aspect-[900/336] min-h-[210px] cursor-pointer overflow-hidden rounded-2xl p-6 sm:min-h-[230px]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat [background-size:100%_100%] transition-opacity duration-200"
        style={{
          backgroundImage: 'url(/textures/decks/clean_1.svg)',
          filter:
            'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.08)) drop-shadow(0 20px 48px rgba(0, 0, 0, 0.10))',
          opacity: hoverShadowOpacity,
        }}
      />
      <span aria-hidden className={`pointer-events-none absolute inset-0 z-[2] shimmer-core ${coreAnimationClass}`} />
      <span aria-hidden className={`pointer-events-none absolute inset-0 z-[2] shimmer-glow ${glowAnimationClass}`} />
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#E8A598] bg-white/80 text-4xl font-semibold leading-none text-[#C4655A] shadow-sm">
          +
        </span>
        <p className="text-center text-lg font-semibold text-slate-700">Crea tu primer mazo</p>
      </div>

      <style jsx>{`
        .deck-card-create::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: inherit;
          overflow: hidden;
          opacity: 0;
          z-index: 3;
          transition: opacity 180ms ease;
          background: radial-gradient(
            circle at var(--light-x) var(--light-y),
            rgba(255, 255, 255, 0.3),
            transparent 40%
          );
        }
        .deck-card-create:hover::before {
          opacity: 1;
        }
        .shimmer-core {
          opacity: 0;
          background-image: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0) 42%,
            rgba(255, 255, 255, 0.75) 50%,
            rgba(255, 255, 255, 0) 58%
          );
          background-size: 220% 220%;
          background-repeat: no-repeat;
          background-position: -160% -160%;
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(120% 100% at 50% 50%, #000 58%, transparent 100%);
          mask-image: radial-gradient(120% 100% at 50% 50%, #000 58%, transparent 100%);
        }
        .shimmer-glow {
          opacity: 0;
          background-image: linear-gradient(
            135deg,
            rgba(255, 215, 204, 0) 38%,
            rgba(255, 215, 204, 0.9) 50%,
            rgba(255, 215, 204, 0) 62%
          );
          background-size: 260% 260%;
          background-repeat: no-repeat;
          background-position: -170% -170%;
          filter: blur(14px);
          mix-blend-mode: screen;
          -webkit-mask-image: radial-gradient(125% 105% at 50% 50%, #000 52%, transparent 100%);
          mask-image: radial-gradient(125% 105% at 50% 50%, #000 52%, transparent 100%);
        }
        .animate-shimmer-diag-down-core {
          animation: shimmerDiagDownCore 1850ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-up-core {
          animation: shimmerDiagUpCore 1850ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-down-glow {
          animation: shimmerDiagDownGlow 2150ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        .animate-shimmer-diag-up-glow {
          animation: shimmerDiagUpGlow 2150ms cubic-bezier(0.2, 0.85, 0.25, 1) forwards;
        }
        @keyframes shimmerDiagDownCore {
          0% { background-position: -140% -140%; opacity: 0; }
          12% { opacity: 1; }
          100% { background-position: 140% 140%; opacity: 0; }
        }
        @keyframes shimmerDiagUpCore {
          0% { background-position: 140% 140%; opacity: 0; }
          12% { opacity: 1; }
          100% { background-position: -140% -140%; opacity: 0; }
        }
        @keyframes shimmerDiagDownGlow {
          0% { background-position: -160% -160%; opacity: 0; }
          18% { opacity: 0.95; }
          100% { background-position: 130% 130%; opacity: 0; }
        }
        @keyframes shimmerDiagUpGlow {
          0% { background-position: 130% 130%; opacity: 0; }
          18% { opacity: 0.95; }
          100% { background-position: -160% -160%; opacity: 0; }
        }
      `}</style>
    </article>
  )
}

export default function StudioDecksPage() {
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const { profile, updateAcademic } = useProfile()
  const galleryStyle: 'default' | 'gradient' = profile?.deck_gallery_style ?? 'default'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [savingGalleryStyle, setSavingGalleryStyle] = useState(false)
  const settingsPopoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isSettingsOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!settingsPopoverRef.current?.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSettingsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSettingsOpen])

  const handleSelectGalleryStyle = async (style: 'default' | 'gradient') => {
    if (style === galleryStyle || savingGalleryStyle) {
      setIsSettingsOpen(false)
      return
    }
    setSavingGalleryStyle(true)
    const result = await updateAcademic({ galleryStyle: style })
    setSavingGalleryStyle(false)
    if (result.ok) setIsSettingsOpen(false)
  }

  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio' })
    return () => setBackAction(null)
  }, [setBackAction])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  const [token, setToken] = useState<string>('')
  const [decks, setDecks] = useState<Deck[]>([])
  const [decksLoading, setDecksLoading] = useState(true)
  const [isContentVisible, setIsContentVisible] = useState(false)
  const [decksError, setDecksError] = useState<string | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [isCreatingDeck, setIsCreatingDeck] = useState(false)
  const [textureTransitionDeckIds, setTextureTransitionDeckIds] = useState<Set<string>>(new Set())
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
  const reorderMutationIdRef = useRef(0)

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
      const normalizedDecks = activeDecks.map((deck) => ({
        ...deck,
        totalItems: toSafeNumber(deck.total_items ?? deck.totalItems),
      }))

      const changedDeckIds = new Set<string>()
      if (typeof window !== 'undefined') {
        normalizedDecks.forEach((deck) => {
          const deckId = String(deck.id)
          const storageKey = `deck_visual_state_${deckId}`
          const prevState = window.localStorage.getItem(storageKey)
          const newState = String(deck.visual_state ?? '')
          if (prevState && prevState !== newState) {
            changedDeckIds.add(deckId)
          }
          window.localStorage.setItem(storageKey, newState)
        })
      }

      setTextureTransitionDeckIds(changedDeckIds)
      setDecks(normalizedDecks)
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
      try {
        const sessionResult = (await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout al obtener sesion.')), 10000)
          }),
        ])) as Awaited<ReturnType<typeof supabase.auth.getSession>>
        const {
          data: { session },
        } = sessionResult
        const accessToken = session?.access_token ?? ''

        if (!mounted) return

        if (!accessToken) {
          setDecksError('No hay sesion activa.')
          setDecksLoading(false)
          return
        }

        setToken(accessToken)
        await loadDecks(accessToken)
      } catch (err) {
        if (!mounted) return
        setDecksError(err instanceof Error ? err.message : 'No se pudo iniciar Studio Mazos.')
        setDecksLoading(false)
      }
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

  useEffect(() => {
    if (decksLoading) {
      setIsContentVisible(false)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setIsContentVisible(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [decksLoading])

  const systemDecks = useMemo(() => decks.filter((deck) => deck.system_generated === true), [decks])
  const userDecks = useMemo(() => decks.filter((deck) => deck.system_generated !== true), [decks])
  const shouldShowSystemPlaceholder = useMemo(
    () => systemDecks.some((deck) => isFailedQuestionsDeck(deck)) && systemDecks.length < 2,
    [systemDecks],
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

  const persistUserDeckOrder = useCallback(
    async (orderedDeckIds: string[], previousDecks: Deck[], mutationId: number) => {
      if (!token || orderedDeckIds.length === 0) return
      try {
        await reorderDecks(token, orderedDeckIds)
      } catch (err) {
        if (reorderMutationIdRef.current !== mutationId) return
        setDecks(previousDecks)
        setDecksError(err instanceof Error ? err.message : 'No se pudo guardar el orden de mazos.')
      }
    },
    [token],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = userDecks.findIndex((deck) => String(deck.id) === String(active.id))
      const newIndex = userDecks.findIndex((deck) => String(deck.id) === String(over.id))

      if (oldIndex < 0 || newIndex < 0) return

      const previousDecks = [...decks]
      const reorderedUserDecks = arrayMove(userDecks, oldIndex, newIndex)
      const orderedDeckIds = reorderedUserDecks.map((deck) => String(deck.id))
      setDecksError(null)
      setDecks([...systemDecks, ...reorderedUserDecks])
      const mutationId = reorderMutationIdRef.current + 1
      reorderMutationIdRef.current = mutationId
      void persistUserDeckOrder(orderedDeckIds, previousDecks, mutationId)
    },
    [decks, persistUserDeckOrder, systemDecks, userDecks],
  )

  if (decksLoading) {
    return (
      <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden">
        <GooFissionLoader label="Cargando mazos" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
      <main
        className={`mx-auto w-full max-w-7xl px-6 py-8 transition-opacity duration-500 ease-out ${
          isContentVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <section className="relative mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Studio
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-800">
              Tus mazos
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div ref={settingsPopoverRef} className="relative">
              <button
                type="button"
                aria-label="Ajustes de la galería"
                aria-expanded={isSettingsOpen}
                title="Ajustes"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {isSettingsOpen ? (
                <div
                  className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
                  role="menu"
                >
                  <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Textura de las tarjetas
                  </p>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={galleryStyle === 'default'}
                    disabled={savingGalleryStyle}
                    onClick={() => void handleSelectGalleryStyle('default')}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      galleryStyle === 'default' ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-8 w-8 shrink-0 rounded-lg bg-center bg-no-repeat [background-size:100%_100%]"
                      style={{ backgroundImage: 'url(/textures/decks/clean_1.svg)' }}
                    />
                    <span>
                      <span className="block">Predeterminado</span>
                      <span className="block text-xs font-normal text-slate-400">Cartas ilustradas de MIRDaily</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={galleryStyle === 'gradient'}
                    disabled={savingGalleryStyle}
                    onClick={() => void handleSelectGalleryStyle('gradient')}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      galleryStyle === 'gradient' ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-8 w-8 shrink-0 rounded-lg"
                      style={{ backgroundImage: 'linear-gradient(135deg, #FFDAB9 0%, #E2725B 55%, #4E2C23 100%)' }}
                    />
                    <span>
                      <span className="block">Personalizado</span>
                      <span className="block text-xs font-normal text-slate-400">El degradado de cada mazo</span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
            <Link
              href="/decks/trash"
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

        <section className="space-y-6">
            {systemDecks.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {systemDecks.map((deck) => (
                  <div key={String(deck.id)} className="cursor-default">
                    <DeckCard
                      deck={deck}
                      deckTexture={getDeckTexture(deck)}
                      textureTransition={textureTransitionDeckIds.has(String(deck.id))}
                      onTextureTransitionEnd={() => {
                        const deckId = String(deck.id)
                        setTextureTransitionDeckIds((prev) => {
                          if (!prev.has(deckId)) return prev
                          const next = new Set(prev)
                          next.delete(deckId)
                          return next
                        })
                      }}
                      isFailedQuestions={isFailedQuestionsDeck(deck)}
                      // Los mazos del sistema (no creados por el usuario) conservan
                      // siempre su textura original, sin importar el ajuste elegido
                      // para la galería — ese ajuste es solo para los mazos propios.
                      galleryStyle="default"
                      onOpen={() => router.push(`/decks/${deck.id}`)}
                      deleting={false}
                      showDeleteButton={false}
                    />
                  </div>
                ))}
                {shouldShowSystemPlaceholder ? (
                  <ConstructionDeckPlaceholder />
                ) : null}
              </div>
            ) : null}

            {systemDecks.length > 0 ? (
              <div className="flex items-center gap-4 py-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Mazos personales
                </span>
                <div className="h-px flex-1 bg-[#E6DEDA]" />
              </div>
            ) : null}

            {userDecks.length === 0 ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <CreateDeckPlaceholder
                  onCreate={() => {
                    setShowCreateForm(true)
                  }}
                />
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={userDecks.map((deck) => String(deck.id))}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {userDecks.map((deck) => (
                      <SortableDeckCard key={String(deck.id)} deck={deck}>
                        <DeckCard
                          deck={deck}
                          deckTexture={getDeckTexture(deck)}
                          textureTransition={textureTransitionDeckIds.has(String(deck.id))}
                          onTextureTransitionEnd={() => {
                            const deckId = String(deck.id)
                            setTextureTransitionDeckIds((prev) => {
                              if (!prev.has(deckId)) return prev
                              const next = new Set(prev)
                              next.delete(deckId)
                              return next
                            })
                          }}
                          isFailedQuestions={isFailedQuestionsDeck(deck)}
                      galleryStyle={galleryStyle}
                          onOpen={() => router.push(`/decks/${deck.id}`)}
                          deleting={deletingDeckIds.has(String(deck.id))}
                          onDelete={() => {
                            void handleDeleteDeck(deck)
                          }}
                        />
                      </SortableDeckCard>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
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
