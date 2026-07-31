'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import type { VersusPlayer } from '@/lib/versus/types'

type VersusPresenceToastsProps = {
  players: VersusPlayer[]
  /** El propio jugador no se avisa a sí mismo de que se ha desconectado. */
  playerId: string | null
}

type PresenceState = 'here' | 'away' | 'left'

type Toast = {
  key: string
  nickname: string
  avatarId: number
  state: PresenceState
  /** Ya se está desvaneciendo; se quita del DOM al acabar. */
  leaving?: boolean
}

const VISIBLE_MS = 4000
const EXIT_MS = 180

function stateOf(player: VersusPlayer): PresenceState {
  if (player.left) return 'left'
  return player.connected ? 'here' : 'away'
}

const COPY: Record<PresenceState, { text: string; icon: string; tone: string }> = {
  here: {
    text: 'ha vuelto',
    icon: 'wifi',
    tone: 'border-[#8BA888]/30 text-[#6a8a67]',
  },
  away: {
    text: 'se ha desconectado',
    icon: 'wifi_off',
    tone: 'border-[#E8A598]/40 text-[#d18d80]',
  },
  left: {
    text: 'ha salido de la sala',
    icon: 'logout',
    tone: 'border-[#7D8A96]/30 text-[#7D8A96]',
  },
}

// Avisos de conexión. Van fijos abajo y ocupan solo una línea, para no tapar ni
// el enunciado ni las opciones: aparecen justo cuando estás leyendo la pregunta
// y no deben robarte sitio.
export default function VersusPresenceToasts({
  players,
  playerId,
}: VersusPresenceToastsProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  // Los avisos salen de comparar la plantilla nueva con la anterior. Es un
  // "ajustar estado al cambiar las props", que React resuelve en el render: en
  // un efecto encadenaría un render de más por cada plantilla que llega.
  const [seen, setSeen] = useState<{
    players: VersusPlayer[]
    states: Map<string, PresenceState>
    seq: number
  } | null>(null)

  if (seen?.players !== players) {
    const states = new Map(players.map((p) => [p.id, stateOf(p)]))
    const fresh: Toast[] = []
    // Contador propio en vez de Date.now(): el render tiene que ser puro, y de
    // paso las claves quedan estables si React repite el render.
    const seq = (seen?.seq ?? 0) + 1

    // La primera plantilla solo se memoriza: al entrar en una sala donde ya hay
    // alguien caído no debe saltar un aviso de algo que no acaba de pasar.
    if (seen) {
      for (const player of players) {
        if (player.id === playerId) continue

        const before = seen.states.get(player.id)
        const after = states.get(player.id)
        if (before === undefined || after === undefined || before === after) continue

        fresh.push({
          key: `${player.id}-${after}-${seq}`,
          nickname: player.nickname,
          avatarId: player.avatarId,
          state: after,
        })
      }
    }

    setSeen({ players, states, seq })
    if (fresh.length > 0) setToasts((prev) => [...prev, ...fresh])
  }

  // Un temporizador por aviso, y solo la primera vez que se ve. Si se
  // reprogramaran todos con cada aviso nuevo, los que ya llevaban rato en
  // pantalla volverían a empezar la cuenta y se quedarían pegados.
  const timers = useRef(new Map<string, number>())

  // La salida se hace en dos tiempos y a mano: primero se marca el aviso como
  // saliente (se desvanece) y después se quita del array.
  //
  // Aquí NO sirve AnimatePresence, aunque funcione en el resto de Versus: este
  // componente ajusta estado durante el render para derivar los avisos, y ese
  // render extra descoloca su seguimiento de hijos. Se comprobó que dejaba los
  // nodos en el DOM con opacity 0 ocupando sitio, y como la columna es flex,
  // empujaban hacia arriba a los avisos siguientes.
  useEffect(() => {
    for (const toast of toasts) {
      if (timers.current.has(toast.key)) continue

      const fade = window.setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.key === toast.key ? { ...t, leaving: true } : t)),
        )
        const drop = window.setTimeout(() => {
          timers.current.delete(toast.key)
          setToasts((prev) => prev.filter((t) => t.key !== toast.key))
        }, EXIT_MS)
        timers.current.set(toast.key, drop)
      }, VISIBLE_MS)

      timers.current.set(toast.key, fade)
    }
  }, [toasts])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((id) => window.clearTimeout(id))
      pending.clear()
    }
  }, [])

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => {
        const copy = COPY[toast.state]
        return (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={
              toast.leaving
                ? { opacity: 0, y: 8, scale: 0.96 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            transition={
              toast.leaving
                ? { duration: EXIT_MS / 1000 }
                : { type: 'spring', stiffness: 420, damping: 32 }
            }
            className={`flex max-w-full items-center gap-2 rounded-full border bg-white/95 py-1.5 pl-1.5 pr-4 shadow-[0_8px_24px_rgba(125,138,150,0.18)] backdrop-blur-sm ${copy.tone}`}
          >
            <Image
              src={getAvatarUrl(getSafeAvatarId(toast.avatarId))}
              alt=""
              width={24}
              height={24}
              className="size-6 shrink-0 rounded-full object-cover"
            />
            <span className="material-symbols-outlined text-[16px]">{copy.icon}</span>
            <span className="truncate text-sm">
              <span className="font-semibold text-[#2c3e50]">{toast.nickname}</span>{' '}
              {copy.text}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
