'use client'

import Image from 'next/image'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import type { VersusMode, VersusPlayer } from '@/lib/versus/types'

// Los momentos "de estudio" de Guardia: la entrada, la pérdida de una vida, la
// caída y el relevo entre preguntas. Van con las caras y los nombres de verdad,
// porque perder una vida duele mucho más cuando ves de quién es la cara.
//
// Regla que atraviesa todo este fichero: la animación es DECORACIÓN. El estado
// natural de cada overlay es invisible y sin capturar el ratón; es la animación
// la que lo saca y lo vuelve a esconder. Si no llegara a ejecutarse no se ve
// nada, que es infinitamente mejor que quedarse con un cartel pegado encima de
// la partida.

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
    10%  { opacity: 1 }
    82%  { opacity: 1 }
    100% { opacity: 0 }
  }
  /* Cada cara entra girando desde abajo con un rebote corto. Corto a propósito:
     con veinte jugadores, un rebote largo convierte la entrada en una espera. */
  @keyframes vs-pop {
    0%   { opacity: 0; transform: scale(0.2) translate3d(0, 26px, 0) }
    55%  { opacity: 1; transform: scale(1.12) translate3d(0, -4px, 0) }
    75%  { transform: scale(0.97) }
    100% { opacity: 1; transform: scale(1) translate3d(0, 0, 0) }
  }
  @keyframes vs-title {
    0%   { opacity: 0; transform: scale(2.4); letter-spacing: 0.5em; filter: blur(8px) }
    30%  { opacity: 1; transform: scale(1); letter-spacing: 0.12em; filter: blur(0) }
    36%  { transform: scale(1.05) }
    44%  { transform: scale(1) }
    100% { opacity: 1; transform: scale(1) }
  }
  @keyframes vs-shockwave {
    0%   { opacity: 0; transform: scale(0.2) }
    18%  { opacity: 0.45 }
    70%  { opacity: 0; transform: scale(2.8) }
    100% { opacity: 0; transform: scale(2.8) }
  }
  /* Pérdida de vida: el corazón se agrieta y salta hacia arriba */
  @keyframes vs-heartbreak {
    0%   { opacity: 0; transform: scale(0.4) }
    18%  { opacity: 1; transform: scale(1.35) }
    28%  { transform: scale(1) rotate(-8deg) }
    36%  { transform: scale(1) rotate(8deg) }
    44%  { transform: scale(1) rotate(0deg) }
    70%  { opacity: 1; transform: translate3d(0, 0, 0) scale(1) }
    100% { opacity: 0; transform: translate3d(0, -46px, 0) scale(0.6) }
  }
  @keyframes vs-shake {
    0%, 100% { transform: translate3d(0, 0, 0) }
    12% { transform: translate3d(-7px, 0, 0) }
    24% { transform: translate3d(7px, 0, 0) }
    36% { transform: translate3d(-5px, 0, 0) }
    48% { transform: translate3d(5px, 0, 0) }
    60% { transform: translate3d(0, 0, 0) }
  }
  /* La caída: el avatar aterriza, tiembla y se hunde girando */
  @keyframes vs-fall {
    0%   { opacity: 0; transform: translate3d(0, -44px, 0) scale(1.5) }
    12%  { opacity: 1; transform: translate3d(0, 0, 0) scale(1) }
    20%  { transform: translate3d(-9px, 0, 0) rotate(-6deg) }
    28%  { transform: translate3d(9px, 0, 0) rotate(6deg) }
    36%  { transform: translate3d(0, 0, 0) rotate(0deg) }
    62%  { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) }
    100% { opacity: 0; transform: translate3d(0, 230px, 0) rotate(24deg) scale(0.7) }
  }
  @keyframes vs-flatline {
    0%   { opacity: 0; stroke-dashoffset: 1 }
    18%  { opacity: 1 }
    72%  { opacity: 1; stroke-dashoffset: 0 }
    100% { opacity: 0; stroke-dashoffset: 0 }
  }
  @keyframes vs-rise {
    0%   { opacity: 0; transform: translate3d(0, 18px, 0) }
    20%  { opacity: 1; transform: translate3d(0, 0, 0) }
    82%  { opacity: 1 }
    100% { opacity: 0 }
  }
  /* Relevo entre preguntas: el contador de supervivientes aterriza */
  @keyframes vs-count {
    0%   { opacity: 0; transform: scale(1.8) }
    35%  { opacity: 1; transform: scale(1) }
    100% { opacity: 1; transform: scale(1) }
  }
`

// ---------------------------------------------------------------------------
// Entrada de partida
// ---------------------------------------------------------------------------

const MODE_NAME: Record<VersusMode, string> = {
  classic: 'Clásico',
  mir_rank: 'Número de orden',
  survival: 'Guardia',
  image: 'Ojo clínico',
  progressive: 'Diagnóstico progresivo',
}

const MODE_TAGLINE: Record<VersusMode, string> = {
  classic: 'Acierta y corre',
  mir_rank: 'Como el examen de verdad',
  survival: 'El último en pie gana',
  image: 'Solo la imagen',
  progressive: 'Cuantas menos pistas, mejor',
}

const INTRO_MS = 3000

type IntroProps = {
  players: VersusPlayer[]
  mode: VersusMode
  lives: number | null
  runKey: string
}

// Pase de lista, NO un enfrentamiento por bandos. Antes se repartían los
// jugadores a izquierda y derecha de un "VS", y con tres eso se leía como
// "2 contra 1", que es justo lo que no pasa: aquí compiten todos contra todos.
// Ahora salen juntos en una rejilla que crece hacia los lados, así que da igual
// que sean tres o treinta.
export function VersusIntro({ players, mode, lives, runKey }: IntroProps) {
  const instant = useReducedMotion()
  const gone = useTransientOverlay(runKey, INTRO_MS + 200)

  if (instant || gone || players.length === 0) return null

  // Con mucha gente, caras más pequeñas y entradas más juntas: si no, la
  // entrada duraría más que la primera pregunta.
  const many = players.length > 8
  const avatar = many ? 44 : 60
  const step = players.length > 16 ? 25 : many ? 45 : 70

  return (
    <div
      key={runKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden opacity-0"
      style={{ animation: `vs-backdrop ${INTRO_MS}ms ease-out both` }}
    >
      <style>{KEYFRAMES}</style>

      <div className="absolute inset-0 bg-[#2c3e50]/75 backdrop-blur-sm" />

      <div
        className="absolute size-72 rounded-full bg-[#E8A598]/40 opacity-0"
        style={{ animation: `vs-shockwave ${INTRO_MS}ms ease-out both` }}
      />

      <div className="relative flex w-full max-w-3xl flex-col items-center px-6">
        <p
          className="text-4xl font-black uppercase tracking-[0.12em] text-white drop-shadow-lg sm:text-6xl"
          style={{ animation: `vs-title ${INTRO_MS}ms cubic-bezier(0.2, 1.3, 0.3, 1) both` }}
        >
          {MODE_NAME[mode]}
        </p>
        <p
          className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-[#E8A598]"
          style={{ animation: `vs-rise ${INTRO_MS - 200}ms ease-out 200ms both` }}
        >
          {mode === 'survival' && lives
            ? `${lives} ${lives === 1 ? 'vida' : 'vidas'} · ${MODE_TAGLINE[mode]}`
            : MODE_TAGLINE[mode]}
        </p>

        <div className="mt-7 flex max-w-full flex-wrap items-start justify-center gap-x-4 gap-y-3">
          {players.map((player, index) => (
            <div
              key={player.id}
              className="flex w-16 flex-col items-center opacity-0 sm:w-20"
              style={{
                // El retraso se descuenta de la duración para que todo cierre a
                // la vez que el fondo.
                animation: `vs-pop ${INTRO_MS - 600 - index * step}ms cubic-bezier(0.2, 1.5, 0.4, 1) ${
                  600 + index * step
                }ms both`,
              }}
            >
              <Image
                src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                alt=""
                width={avatar}
                height={avatar}
                style={{ width: avatar, height: avatar }}
                className="rounded-full border-[3px] border-white object-cover shadow-lg"
              />
              <span className="mt-1 w-full truncate text-center text-[11px] font-bold text-white drop-shadow">
                {player.nickname}
              </span>
            </div>
          ))}
        </div>

        <p
          className="mt-5 text-sm font-bold text-white/80"
          style={{ animation: `vs-rise ${INTRO_MS - 900}ms ease-out 900ms both` }}
        >
          {players.length} a la guardia
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pérdida de vida (sin caer)
// ---------------------------------------------------------------------------

const HURT_MS = 2200

type HurtProps = {
  wounded: VersusPlayer[]
  runKey: string
  playerId: string | null
}

// Perder una vida tiene que doler sin ser una eliminación: la cara tiembla y
// se le rompe un corazón encima, pero no se lleva la pantalla entera.
export function VersusLifeLost({ wounded, runKey, playerId }: HurtProps) {
  const instant = useReducedMotion()
  const gone = useTransientOverlay(runKey, HURT_MS + 200)

  if (instant || gone || wounded.length === 0) return null

  const meDuele = playerId !== null && wounded.some((p) => p.id === playerId)

  return (
    <div
      key={runKey}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[55] flex justify-center px-4 opacity-0"
      style={{ animation: `vs-backdrop ${HURT_MS}ms ease-out both` }}
    >
      <style>{KEYFRAMES}</style>

      <div className="flex max-w-full flex-col items-center gap-2 rounded-2xl bg-[#2c3e50]/85 px-5 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {wounded.map((player, index) => (
            <div
              key={player.id}
              className="relative flex flex-col items-center"
              style={{
                animation: `vs-shake ${HURT_MS - index * 90}ms ease-in-out ${index * 90}ms both`,
              }}
            >
              <Image
                src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                alt=""
                width={44}
                height={44}
                className="size-11 rounded-full border-2 border-[#C4655A] object-cover"
              />
              <span
                className="material-symbols-outlined absolute -top-3 text-[22px] text-[#C4655A] opacity-0 drop-shadow"
                style={{
                  animation: `vs-heartbreak ${HURT_MS - index * 90}ms ease-out ${index * 90}ms both`,
                }}
              >
                heart_broken
              </span>
              <span className="mt-1 max-w-16 truncate text-[11px] font-bold text-white">
                {player.nickname}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-[#E8A598]">
          {meDuele
            ? 'Te queda una vida menos'
            : wounded.length > 1
              ? `${wounded.length} pierden una vida`
              : 'Pierde una vida'}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Caída
// ---------------------------------------------------------------------------

const FALL_MS = 4200

// La caída NO arranca a la vez que el revelado: primero se ve la correcta y se
// rompen los corazones, y solo entonces se lleva la pantalla. Por eso la ronda
// con muerte dura 11 s en vez de 6 (ver game_tick): 2,6 s de espera + 4,2 s de
// despedida caben con margen, sin que nada se pise ni se corte.
const FALL_DELAY_MS = 2600

type EliminationProps = {
  fallen: VersusPlayer[]
  runKey: string
  playerId: string | null
}

export function VersusElimination({ fallen, runKey, playerId }: EliminationProps) {
  const instant = useReducedMotion()
  const gone = useTransientOverlay(runKey, FALL_DELAY_MS + FALL_MS + 200)
  const [waiting, setWaiting] = useState(true)
  const [seenKey, setSeenKey] = useState(runKey)

  if (seenKey !== runKey) {
    setSeenKey(runKey)
    setWaiting(true)
  }

  useEffect(() => {
    const id = window.setTimeout(() => setWaiting(false), FALL_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [runKey])

  if (instant || gone || waiting || fallen.length === 0) return null

  const meCaigo = playerId !== null && fallen.some((p) => p.id === playerId)

  return (
    <div
      key={runKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center overflow-hidden opacity-0"
      style={{ animation: `vs-backdrop ${FALL_MS}ms ease-out both` }}
    >
      <style>{KEYFRAMES}</style>

      <div className="absolute inset-0 bg-[#2c3e50]/80 backdrop-blur-sm" />

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

// ---------------------------------------------------------------------------
// Relevo entre preguntas
// ---------------------------------------------------------------------------

type RelayProps = {
  standing: VersusPlayer[]
  fallen: VersusPlayer[]
  remaining: number
}

// Va DENTRO de la cuenta atrás de cada ronda, no encima: entre pregunta y
// pregunta solo hay tres segundos y un overlay más sería un parpadeo.
// Recuerda quién sigue y quién ya no, que es el hilo del modo.
export function VersusRelay({ standing, fallen, remaining }: RelayProps) {
  return (
    <div className="flex w-full max-w-lg flex-col items-center px-6">
      <p
        className="text-5xl font-black tabular-nums text-[#2c3e50]"
        style={{ animation: 'vs-count 600ms cubic-bezier(0.2, 1.4, 0.3, 1) both' }}
      >
        {standing.length}
      </p>
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#7D8A96]">
        {standing.length === 1 ? 'sigue en pie' : 'siguen en pie'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {standing.map((player, index) => (
          <Image
            key={player.id}
            src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
            alt={player.nickname}
            title={player.nickname}
            width={40}
            height={40}
            className="size-10 rounded-full border-2 border-[#8BA888] object-cover"
            style={{ animation: `vs-pop 500ms cubic-bezier(0.2, 1.5, 0.4, 1) ${index * 60}ms both` }}
          />
        ))}
        {fallen.map((player) => (
          <Image
            key={player.id}
            src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
            alt={player.nickname}
            title={`${player.nickname} — eliminado`}
            width={32}
            height={32}
            className="size-8 rounded-full border-2 border-[#EAE4E2] object-cover opacity-40 grayscale"
          />
        ))}
      </div>

      <p className="mt-5 text-sm font-semibold text-[#7D8A96]">
        Siguiente pregunta en {remaining}
      </p>
      <style>{KEYFRAMES}</style>
    </div>
  )
}
