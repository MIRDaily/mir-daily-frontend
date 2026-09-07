'use client'

import type { RefObject } from 'react'
import { useProgressContext } from '@/providers/ProgressProvider'
import { rankForLevel } from '@/lib/levels'
import StreakFlame from '@/components/progress/StreakFlame'
import ChallengesPopup from '@/components/progress/ChallengesPopup'

/* ════════════════════════════════════════════════════════════════════════
   Botón de nivel de la cabecera.

   Hace UNA cosa: abrir el popup con los desafíos del día y de la semana.
   Antes llevaba al Studio, pero el progreso completo se mudó al perfil y un
   botón que navega a otra pantalla obliga a abandonar lo que estabas
   haciendo para ver si te falta un reto.

   El aro es el avance dentro del nivel actual (conic-gradient sobre un padre
   con relleno: un aro de 2 px no necesita un SVG). La racha va como llama en
   la esquina, no como el circulito naranja que había antes.
═══════════════════════════════════════════════════════════════════════════ */

export default function HeaderLevelBadge({
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

  const rank = rankForLevel(progress.level)
  const pct = Math.max(
    0,
    Math.min(100, Math.round((progress.xpIntoLevel / Math.max(1, progress.xpForNext)) * 100)),
  )

  const reales = (data?.daily ?? []).filter((c) => c.metric !== 'all_daily')
  const pendientes = reales.filter((c) => !c.completed).length

  const restante = Math.max(0, progress.xpForNext - progress.xpIntoLevel)
  const titulo =
    progress.level >= progress.maxLevel
      ? `${rank.name} · nivel máximo`
      : `${rank.name} · ${restante} XP para el nivel ${progress.level + 1}`

  return (
    <div className="relative hidden sm:block" ref={containerRef}>
      <button
        type="button"
        aria-label={`Desafíos. ${titulo}`}
        aria-expanded={open}
        title={titulo}
        onClick={onToggle}
        className={`relative size-10 rounded-full border-2 border-white shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-150 active:translate-y-0 active:scale-95 ${
          open ? 'ring-2 ring-[#E8A598]/30' : 'hover:-translate-y-0.5'
        }`}
        style={{
          background: `conic-gradient(${rank.color} ${pct * 3.6}deg, #EAE4E2 ${pct * 3.6}deg)`,
        }}
      >
        <span className="absolute inset-[2px] flex items-center justify-center rounded-full bg-white">
          <span className="text-[13px] font-black leading-none" style={{ color: rank.color }}>
            {progress.level}
          </span>
        </span>

        {/* La racha, en llama. Se sale del botón a propósito para que no tape
            el número del nivel. */}
        {progress.currentStreak > 0 ? (
          <span className="absolute -right-2 -top-1.5 flex items-center">
            <StreakFlame streak={progress.currentStreak} size={20} />
          </span>
        ) : null}

        {/* Cuántos desafíos quedan por hacer hoy: es el motivo de abrir esto. */}
        {pendientes > 0 ? (
          <span className="absolute -bottom-0.5 -left-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-[#C4655A] px-1 text-[10px] font-bold leading-3 text-white">
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
