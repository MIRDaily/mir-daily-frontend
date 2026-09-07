'use client'

import type { RefObject } from 'react'
import { useProgressContext } from '@/providers/ProgressProvider'
import StreakFlame from '@/components/progress/StreakFlame'
import ChallengesPopup from '@/components/progress/ChallengesPopup'

/* ════════════════════════════════════════════════════════════════════════
   El botón de la racha, en la cabecera.

   Antes este botón llevaba el nivel; el nivel se mudó al avatar (ver
   AvatarLevelRing) y aquí se quedó lo que de verdad hay que mirar cada día.
   La llama ocupa el botón entero, con el número encima: a ese tamaño la
   racha se lee de un vistazo sin abrir nada.

   Sigue haciendo lo mismo al pulsarlo: abrir el popup con los desafíos del día
   y de la semana, con un contador de los que quedan.
═══════════════════════════════════════════════════════════════════════════ */

export default function HeaderStreakButton({
  open,
  onToggle,
  onClose,
  containerRef,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { data, loading } = useProgressContext()
  const progress = data?.progress

  // Sin datos no se pinta nada: en una cabecera fija, un hueco que aparece y
  // desaparece salta más que no tener nada.
  if (!progress) return null

  const reales = (data?.daily ?? []).filter((c) => c.metric !== 'all_daily')
  const pendientes = reales.filter((c) => !c.completed).length

  const racha = progress.currentStreak
  const titulo =
    racha > 0
      ? `${racha} ${racha === 1 ? 'día' : 'días'} de racha` +
        (progress.streakMultiplier > 1
          ? ` · ×${progress.streakMultiplier.toFixed(2).replace('.', ',')} XP`
          : '')
      : 'Sin racha. Haz el Daily para encenderla'

  return (
    <div className="relative hidden sm:block" ref={containerRef}>
      <button
        type="button"
        aria-label={`Desafíos. ${titulo}`}
        aria-expanded={open}
        title={titulo}
        onClick={onToggle}
        className={`relative flex size-10 items-center justify-center rounded-full border-2 border-white bg-white/90 shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-150 active:translate-y-0 active:scale-95 ${
          open
            ? 'ring-2 ring-[#E8A598]/30'
            : 'hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(125,138,150,0.24),inset_0_1px_0_rgba(255,255,255,0.92)]'
        }`}
      >
        {/* La llama ocupa el botón. El número va montado encima, sobre el
            cuerpo de la llama, que es la parte ancha y de color plano. */}
        <StreakFlame streak={racha} size={34} />
        <span
          className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[7px] text-[13px] font-black leading-none tabular-nums"
          style={{ color: racha > 0 ? '#2c3e50' : '#9AA3AC' }}
        >
          {racha}
        </span>

        {/* Cuántos desafíos quedan por hacer hoy: es el motivo de abrir esto. */}
        {pendientes > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-[#C4655A] px-1 text-[10px] font-bold leading-3 text-white">
            {pendientes}
          </span>
        ) : null}
      </button>

      <ChallengesPopup
        open={open}
        onClose={onClose}
        daily={data?.daily ?? []}
        weekly={data?.weekly ?? []}
        loading={loading}
      />
    </div>
  )
}
