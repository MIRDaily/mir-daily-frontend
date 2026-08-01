'use client'

import Image from 'next/image'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import type { VersusMode, VersusPlayer } from '@/lib/versus/types'

// Momentos "de estudio": la entrada de la partida y la caída de un jugador en
// Guardia. Van con las caras y los nombres de verdad, porque una eliminación
// duele mucho más cuando ves quién ha caído.
//
// Regla que atraviesa todo este fichero: la animación es DECORACIÓN. El estado
// natural de cada overlay es invisible y sin capturar el ratón; es la animación
// la que lo saca y lo vuelve a esconder. Si por lo que sea no llegara a
// ejecutarse, no se ve nada — que es infinitamente mejor que quedarse con un
// cartel pegado encima de la partida.

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

// Un overlay que se enseña y se retira solo. `runKey` cambia con cada momento
// (partida nueva, ronda nueva) y eso lo revive.
//
// El reinicio va en el RENDER y no en un efecto: reiniciar estado al cambiar
// una prop es exactamente el caso que React resuelve ajustando en render, y
// hacerlo en un efecto encadena un render de más cada vez.
function useTransientOverlay(runKey: string, ms: number) {
  const [gone, setGone] = useState(false)
  const [seenKey, setSeenKey] = useState(runKey)

  if (seenKey !== runKey) {
    setSeenKey(runKey)
    setGone(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => setGone(true), ms)
    return () => window.clearTimeout(id)
  }, [runKey, ms])

  return gone
}

const KEYFRAMES = `
  @keyframes vs-backdrop {
    0%   { opacity: 0 }
    12%  { opacity: 1 }
    80%  { opacity: 1 }
    100% { opacity: 0 }
  }
  @keyframes vs-from-left {
    0%   { opacity: 0; transform: translate3d(-120%, 0, 0) rotate(-8deg) }
    22%  { opacity: 1; transform: translate3d(6%, 0, 0) rotate(2deg) }
    30%  { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) }
    80%  { opacity: 1; transform: translate3d(0, 0, 0) }
    100% { opacity: 0; transform: translate3d(0, -12px, 0) }
  }
  @keyframes vs-from-right {
    0%   { opacity: 0; transform: translate3d(120%, 0, 0) rotate(8deg) }
    22%  { opacity: 1; transform: translate3d(-6%, 0, 0) rotate(-2deg) }
    30%  { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) }
    80%  { opacity: 1; transform: translate3d(0, 0, 0) }
    100% { opacity: 0; transform: translate3d(0, -12px, 0) }
  }
  @keyframes vs-stamp {
    0%   { opacity: 0; transform: scale(2.6) rotate(-12deg); filter: blur(6px) }
    18%  { opacity: 1; transform: scale(1) rotate(-3deg); filter: blur(0) }
    24%  { transform: scale(1.06) rotate(-3deg) }
    30%  { transform: scale(1) rotate(-3deg) }
    82%  { opacity: 1 }
    100% { opacity: 0; transform: scale(1.1) rotate(-3deg) }
  }
  @keyframes vs-shockwave {
    0%   { opacity: 0; transform: scale(0.2) }
    16%  { opacity: 0.5 }
    60%  { opacity: 0; transform: scale(2.6) }
    100% { opacity: 0; transform: scale(2.6) }
  }
  /* La caída: el avatar se va de lado, gira y se hunde. */
  @keyframes vs-fall {
    0%   { opacity: 0; transform: translate3d(0, -40px, 0) scale(1.5) }
    14%  { opacity: 1; transform: translate3d(0, 0, 0) scale(1) }
    22%  { transform: translate3d(-10px, 0, 0) rotate(-6deg) }
    30%  { transform: translate3d(10px, 0, 0) rotate(6deg) }
    38%  { transform: translate3d(0, 0, 0) rotate(0deg) }
    60%  { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) }
    100% { opacity: 0; transform: translate3d(0, 220px, 0) rotate(24deg) scale(0.7) }
  }
  @keyframes vs-flatline {
    0%   { opacity: 0; stroke-dashoffset: 1 }
    20%  { opacity: 1 }
    70%  { opacity: 1; stroke-dashoffset: 0 }
    100% { opacity: 0; stroke-dashoffset: 0 }
  }
  @keyframes vs-rise {
    0%   { opacity: 0; transform: translate3d(0, 18px, 0) }
    20%  { opacity: 1; transform: translate3d(0, 0, 0) }
    82%  { opacity: 1 }
    100% { opacity: 0 }
  }
`

// ---------------------------------------------------------------------------

const MODE_NAME: Record<VersusMode, string> = {
  classic: 'Clásico',
  mir_rank: 'Número de orden',
  survival: 'Guardia',
  image: 'Ojo clínico',
  progressive: 'Diagnóstico progresivo',
}

type IntroProps = {
  players: VersusPlayer[]
  mode: VersusMode
  /** Cambia con cada partida: reinicia la animación. */
  runKey: string
}

const INTRO_MS = 2800

// Entrada de la partida: las caras entran desde los dos lados y el nombre del
// modo cae encima como un sello.
export function VersusIntro({ players, mode, runKey }: IntroProps) {
  const instant = useReducedMotion()
  const gone = useTransientOverlay(runKey, INTRO_MS + 200)

  if (instant || gone || players.length === 0) return null

  const half = Math.ceil(players.length / 2)
  const left = players.slice(0, half)
  const right = players.slice(half)

  return (
    <div
      key={runKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden opacity-0"
      style={{ animation: `vs-backdrop ${INTRO_MS}ms ease-out both` }}
    >
      <style>{KEYFRAMES}</style>

      <div className="absolute inset-0 bg-[#2c3e50]/70 backdrop-blur-sm" />

      <div
        className="absolute size-72 rounded-full bg-[#E8A598]/40 opacity-0"
        style={{ animation: `vs-shockwave ${INTRO_MS}ms ease-out both` }}
      />

      <div className="relative flex w-full max-w-3xl items-center justify-between gap-4 px-6">
        <PlayerColumn players={left} from="left" duration={INTRO_MS} />

        <div
          className="shrink-0 text-center opacity-0"
          style={{ animation: `vs-stamp ${INTRO_MS}ms cubic-bezier(0.2, 1.4, 0.3, 1) both` }}
        >
          <p className="text-4xl font-black tracking-tighter text-white drop-shadow-lg sm:text-6xl">
            VS
          </p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#E8A598]">
            {MODE_NAME[mode]}
          </p>
        </div>

        <PlayerColumn players={right} from="right" duration={INTRO_MS} />
      </div>
    </div>
  )
}

function PlayerColumn({
  players,
  from,
  duration,
}: {
  players: VersusPlayer[]
  from: 'left' | 'right'
  duration: number
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      {players.map((player, index) => (
        <div
          key={player.id}
          className="flex flex-col items-center opacity-0"
          style={{
            // El retraso se descuenta de la duración para que TODO acabe a la
            // vez que el fondo. Si no, las últimas décimas de las caras
            // quedarían corriendo detrás de un fondo ya invisible.
            animation: `vs-from-${from} ${duration - index * 90}ms cubic-bezier(0.16, 1, 0.3, 1) ${
              index * 90
            }ms both`,
          }}
        >
          <Image
            src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
            alt=""
            width={64}
            height={64}
            className="size-14 rounded-full border-[3px] border-white object-cover shadow-lg sm:size-16"
          />
          <span className="mt-1.5 max-w-24 truncate text-xs font-bold text-white drop-shadow">
            {player.nickname}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

const FALL_MS = 3200

type EliminationProps = {
  fallen: VersusPlayer[]
  /** Ronda en la que cayeron: reinicia la animación en cada eliminación. */
  runKey: string
  /** Si el que cae eres tú, el mensaje cambia. */
  playerId: string | null
}

// La caída de Guardia. Es el momento del modo, así que se lleva la pantalla:
// la cara del que cae, su nombre, y una línea que se aplana.
export function VersusElimination({ fallen, runKey, playerId }: EliminationProps) {
  const instant = useReducedMotion()
  const gone = useTransientOverlay(runKey, FALL_MS + 200)

  if (instant || gone || fallen.length === 0) return null

  const meCaigo = playerId !== null && fallen.some((p) => p.id === playerId)

  return (
    <div
      key={runKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden opacity-0"
      style={{ animation: `vs-backdrop ${FALL_MS}ms ease-out both` }}
    >
      <style>{KEYFRAMES}</style>

      <div className="absolute inset-0 bg-[#2c3e50]/75 backdrop-blur-sm" />

      <div className="relative flex flex-col items-center px-6">
        <div className="flex flex-wrap items-start justify-center gap-6">
          {fallen.map((player, index) => (
            <div
              key={player.id}
              className="flex flex-col items-center opacity-0"
              style={{
                animation: `vs-fall ${FALL_MS - index * 140}ms cubic-bezier(0.5, 0, 0.75, 0) ${
                  index * 140
                }ms both`,
              }}
            >
              <Image
                src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                alt=""
                width={88}
                height={88}
                className="size-20 rounded-full border-4 border-[#C4655A] object-cover shadow-2xl grayscale"
              />
              <span className="mt-2 text-sm font-black text-white drop-shadow">
                {player.nickname}
              </span>
            </div>
          ))}
        </div>

        {/* El pitido plano del monitor, dibujándose */}
        <svg width="220" height="36" viewBox="0 0 220 36" className="mt-4">
          <path
            d="M0 18 H70 l8 -13 l9 26 l8 -13 H220"
            fill="none"
            stroke="#C4655A"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1.02}
            strokeDashoffset={0}
            opacity={0}
            style={{ animation: `vs-flatline ${FALL_MS - 200}ms ease-out 200ms both` }}
          />
        </svg>

        <p
          className="mt-1 text-center text-lg font-black uppercase tracking-[0.15em] text-[#E8A598] opacity-0 sm:text-2xl"
          style={{ animation: `vs-rise ${FALL_MS - 400}ms ease-out 400ms both` }}
        >
          {meCaigo
            ? 'Se acabó tu guardia'
            : fallen.length > 1
              ? `${fallen.length} caen`
              : 'Cae'}
        </p>
      </div>
    </div>
  )
}
