'use client'

import Image from 'next/image'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import type { VersusPlayer } from '@/lib/versus/types'

type Props = {
  players: VersusPlayer[]
  playerId: string | null
  /** Quién acaba de perder una vida en esta ronda: se le marca el corazón. */
  wounded: string[]
  /** Quién acaba de caer: se apaga en el sitio. */
  eliminated: string[]
  maxLives: number
}

// HUD de Guardia. Está SIEMPRE, en todas las fases: es la única forma de que
// se entienda lo que pasa. Sin esto, perdías vidas y morías sin que nada te lo
// contara, y de pronto no te dejaban responder.
//
// Los corazones no se quitan al perderlos: se quedan en el sitio, vacíos. Ver
// el hueco de lo que tenías es lo que hace que se note.
export default function VersusGuardiaHud({
  players,
  playerId,
  wounded,
  eliminated,
  maxLives,
}: Props) {
  if (players.length === 0) return null

  const orden = [...players].sort((a, b) => {
    const av = a.eliminatedAtIdx == null ? 1 : 0
    const bv = b.eliminatedAtIdx == null ? 1 : 0
    return bv - av || (b.lives ?? 0) - (a.lives ?? 0)
  })

  const enPie = orden.filter((p) => p.eliminatedAtIdx == null).length
  const apretado = players.length > 6

  return (
    <section
      aria-label="Vidas de la sala"
      className="mb-4 rounded-2xl border-2 border-[#EAE4E2] bg-white px-3 py-2.5"
    >
      <style>{`
        @keyframes hud-break {
          0%   { transform: scale(1) }
          25%  { transform: scale(1.5) rotate(-12deg) }
          50%  { transform: scale(1.5) rotate(12deg) }
          100% { transform: scale(1) rotate(0deg) }
        }
        @keyframes hud-down {
          0%   { opacity: 1; filter: grayscale(0) }
          100% { opacity: 0.45; filter: grayscale(1) }
        }
      `}</style>

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#7D8A96]/70">
          Guardia
        </span>
        <span className="text-[11px] font-bold text-[#7D8A96]">
          {enPie} {enPie === 1 ? 'en pie' : 'en pie'}
        </span>
      </div>

      <ul className={`grid gap-x-3 gap-y-1.5 ${apretado ? 'sm:grid-cols-2' : ''}`}>
        {orden.map((player) => {
          const caido = player.eliminatedAtIdx != null
          const herido = wounded.includes(player.id)
          const cayendo = eliminated.includes(player.id)
          const soyYo = player.id === playerId
          const vidas = Math.max(player.lives ?? 0, 0)

          return (
            <li
              key={player.id}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
                soyYo ? 'bg-[#E8A598]/10' : ''
              }`}
              style={
                cayendo ? { animation: 'hud-down 900ms ease-out 400ms both' } : undefined
              }
            >
              <Image
                src={getAvatarUrl(getSafeAvatarId(player.avatarId))}
                alt=""
                width={26}
                height={26}
                className={`size-6 shrink-0 rounded-full object-cover ${
                  caido ? 'opacity-50 grayscale' : ''
                }`}
              />
              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  soyYo ? 'font-bold text-[#2c3e50]' : 'text-[#7D8A96]'
                } ${caido ? 'line-through opacity-60' : ''}`}
              >
                {player.nickname}
              </span>

              <span className="flex shrink-0 items-center gap-0.5">
                {caido ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C4655A]">
                    Fuera
                  </span>
                ) : (
                  // Los corazones perdidos se quedan como huecos: es lo que
                  // hace visible cuánto te queda y cuánto llevas gastado.
                  Array.from({ length: Math.max(maxLives, vidas) }, (_, i) => {
                    const lleno = i < vidas
                    const esElQuePierde = herido && i === vidas
                    return (
                      <span
                        key={i}
                        className={`material-symbols-outlined text-[15px] leading-none ${
                          lleno ? 'text-[#C4655A]' : 'text-[#EAE4E2]'
                        }`}
                        style={
                          esElQuePierde
                            ? { animation: 'hud-break 700ms ease-out both' }
                            : undefined
                        }
                      >
                        {lleno ? 'favorite' : 'heart_broken'}
                      </span>
                    )
                  })
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
