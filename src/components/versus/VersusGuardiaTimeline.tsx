'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import type { VersusPlayer, VersusSeries } from '@/lib/versus/types'

type Props = {
  series: VersusSeries[]
  players: VersusPlayer[]
  playerId: string | null
}

// Cronología de la guardia: cada jugador es un trazo que avanza mientras
// acierta y SE CORTA donde cayó, con su cara clavada en ese punto. En Guardia
// no importa quién puntuó más sino quién aguantó más, así que lo que hay que
// leer de un vistazo es en qué pregunta murió cada uno.

const SERIES_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#4a3aa7', '#e34948',
] as const

const MAX_SERIES = SERIES_COLORS.length

const INK = '#2c3e50'
const MUTED = '#7D8A96'
const GRID = '#EAE4E2'
const SURFACE = '#ffffff'

const HEIGHT = 260
const PAD = { top: 22, right: 46, bottom: 30, left: 34 }
const LINE_WIDTH = 5
const FACE = 30

const DRAW_MS = 2600
const STAGGER_MS = 420
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

const useMeasureEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  )
}

// Interpolación cúbica monótona: suaviza sin sobrepasar. Los aciertos
// acumulados nunca bajan, así que un sobrepaso dibujaría un retroceso que no
// ocurrió.
function monotonePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  const n = points.length
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i += 1) {
    const h = points[i + 1].x - points[i].x
    dx.push(h)
    slope.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h)
  }

  const m: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i += 1) m.push((slope[i - 1] + slope[i]) / 2)
  m.push(slope[n - 2])

  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * slope[i]
      m[i + 1] = t * b * slope[i]
    }
  }

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3
    d += ` C ${points[i].x + h} ${points[i].y + m[i] * h}`
    d += ` ${points[i + 1].x - h} ${points[i + 1].y - m[i + 1] * h}`
    d += ` ${points[i + 1].x} ${points[i + 1].y}`
  }
  return d
}

export default function VersusGuardiaTimeline({ series, players, playerId }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const instant = useReducedMotion()

  useMeasureEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const measure = () => setWidth(Math.max(280, Math.round(node.clientWidth)))
    measure()
    window.addEventListener('resize', measure)
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(node)
    }
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [])

  const chart = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]))

    // Orden de supervivencia: primero quien más aguantó. Los que siguen en pie
    // van arriba; entre caídos, el que cayó más tarde.
    const ranked = [...series]
      .filter((s) => byId.has(s.playerId))
      .sort((a, b) => {
        const ca = byId.get(a.playerId)?.eliminatedAtIdx ?? Infinity
        const cb = byId.get(b.playerId)?.eliminatedAtIdx ?? Infinity
        return cb - ca || (b.points.at(-1) ?? 0) - (a.points.at(-1) ?? 0)
      })

    let shown = ranked.slice(0, MAX_SERIES)
    const hidden = ranked.length - shown.length
    if (hidden > 0 && playerId && !shown.some((s) => s.playerId === playerId)) {
      const mine = ranked.find((s) => s.playerId === playerId)
      if (mine) shown = [...shown.slice(0, MAX_SERIES - 1), mine]
    }

    const rounds = shown[0]?.points.length ?? 0
    const top = Math.max(1, ...shown.flatMap((s) => s.points))

    return { shown, hidden, rounds, top, byId }
  }, [series, players, playerId])

  const { shown, hidden, rounds, top, byId } = chart

  if (shown.length === 0 || rounds === 0) return null

  const innerW = Math.max(1, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom

  const x = (round: number) => PAD.left + (innerW * round) / rounds
  const y = (value: number) => PAD.top + innerH - (innerH * value) / top

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[#7D8A96]/70">
        Cronología de la guardia
      </h2>

      <style>{`
        @keyframes vs-track { from { stroke-dashoffset: 1.02 } to { stroke-dashoffset: 0 } }
        @keyframes vs-mark  { from { opacity: 0; transform: scale(0.3) } to { opacity: 1; transform: scale(1) } }
      `}</style>

      <div
        ref={wrapRef}
        className="w-full overflow-x-auto rounded-2xl border-2 border-[#EAE4E2] bg-[#FAF7F4] p-1"
      >
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Cronología: en qué pregunta cayó cada jugador"
        >
          {/* Papel de puntos, como una hoja cuadriculada */}
          <defs>
            <pattern id="vs-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.1" fill={GRID} />
            </pattern>
          </defs>
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="url(#vs-dots)"
          />

          {/* Una marca por pregunta */}
          {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
            <text
              key={round}
              x={x(round)}
              y={HEIGHT - 10}
              textAnchor="middle"
              fontSize={10}
              fill={MUTED}
              opacity={rounds > 12 && round % 2 === 0 ? 0 : 1}
            >
              {round}
            </text>
          ))}

          {shown.map((serie, index) => {
            const color = SERIES_COLORS[index]
            const player = byId.get(serie.playerId)
            const fellAt = player?.eliminatedAtIdx ?? null
            const delay = index * STAGGER_MS

            // El trazo se corta donde cayó: dibujar más allá sería contar una
            // guardia que ya no jugó.
            const lastRound = fellAt === null ? rounds : fellAt + 1
            const points = [0, ...serie.points.slice(0, lastRound)].map((value, round) => ({
              x: x(round),
              y: y(value),
            }))

            const endX = x(lastRound)
            const endY = y(serie.points[lastRound - 1] ?? 0)

            return (
              <g key={serie.playerId}>
                <path
                  d={monotonePath(points)}
                  fill="none"
                  stroke={color}
                  strokeWidth={LINE_WIDTH}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1.02}
                  strokeDashoffset={0}
                  style={
                    instant
                      ? undefined
                      : { animation: `vs-track ${DRAW_MS}ms ${EASE} ${delay}ms both` }
                  }
                />

                {/* La cara clavada donde acabó su guardia */}
                <g
                  style={
                    instant
                      ? undefined
                      : {
                          animation: `vs-mark 420ms cubic-bezier(0.2, 1.5, 0.4, 1) ${
                            delay + DRAW_MS - 200
                          }ms both`,
                          transformOrigin: `${endX}px ${endY}px`,
                        }
                  }
                >
                  <clipPath id={`vs-face-${serie.playerId}`}>
                    <circle cx={endX} cy={endY} r={FACE / 2} />
                  </clipPath>
                  <circle
                    cx={endX}
                    cy={endY}
                    r={FACE / 2 + 2.5}
                    fill={SURFACE}
                    stroke={fellAt === null ? '#8BA888' : color}
                    strokeWidth={2.5}
                  />
                  <image
                    href={getAvatarUrl(getSafeAvatarId(player?.avatarId ?? 1))}
                    x={endX - FACE / 2}
                    y={endY - FACE / 2}
                    width={FACE}
                    height={FACE}
                    clipPath={`url(#vs-face-${serie.playerId})`}
                    style={fellAt !== null ? { filter: 'grayscale(1)' } : undefined}
                  />
                  {fellAt !== null ? (
                    <>
                      <path
                        d={`M ${endX - 6} ${endY - 6} L ${endX + 6} ${endY + 6} M ${endX + 6} ${endY - 6} L ${endX - 6} ${endY + 6}`}
                        stroke="#C4655A"
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={0.95}
                      />
                      <text
                        x={endX}
                        y={endY + FACE / 2 + 14}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={700}
                        fill={INK}
                      >
                        P{fellAt + 1}
                      </text>
                    </>
                  ) : (
                    <text
                      x={endX}
                      y={endY - FACE / 2 - 7}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={700}
                      fill="#6a8a67"
                    >
                      EN PIE
                    </text>
                  )}
                </g>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Leyenda: la identidad nunca depende solo del color */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {shown.map((serie, index) => {
          const player = byId.get(serie.playerId)
          const isMe = serie.playerId === playerId
          const fellAt = player?.eliminatedAtIdx ?? null
          return (
            <li key={serie.playerId} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-1 w-5 rounded-full"
                style={{ backgroundColor: SERIES_COLORS[index] }}
              />
              <span className={`text-xs ${isMe ? 'font-bold text-[#2c3e50]' : 'text-[#7D8A96]'}`}>
                {player?.nickname ?? 'Jugador'}
                <span className="ml-1 text-[#7D8A96]">
                  {fellAt === null ? '· en pie' : `· cayó en la ${fellAt + 1}`}
                </span>
              </span>
            </li>
          )
        })}
        {hidden > 0 ? <li className="text-xs text-[#7D8A96]/70">y {hidden} más</li> : null}
      </ul>
    </section>
  )
}
