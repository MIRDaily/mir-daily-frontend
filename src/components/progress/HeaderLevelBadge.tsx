'use client'

import Link from 'next/link'
import { useProgressContext } from '@/providers/ProgressProvider'
import { rankForLevel } from '@/lib/levels'

/**
 * Insignia compacta de nivel y racha para la cabecera.
 *
 * Es el recordatorio permanente de lo acumulado, que es lo que de verdad
 * sostiene la vuelta al día siguiente: el nivel no motiva por subir, motiva
 * por no querer perderlo.
 *
 * Adopta la forma de botón redondo del resto de la cabecera en lugar de una
 * píldora ancha: a partir de 1150px la navegación se centra en absoluto y una
 * píldora con el nombre del rango se le echaba encima a "MedGuess".
 *
 * El anillo de progreso es un conic-gradient sobre un div padre con padding,
 * no un SVG: es un aro de 2px que no necesita nada más.
 *
 * Se esconde entera mientras no haya datos, en vez de enseñar un esqueleto: en
 * una cabecera fija, un hueco que aparece y desaparece salta más que nada.
 */
export default function HeaderLevelBadge() {
  const { data } = useProgressContext()
  const progress = data?.progress

  if (!progress) return null

  const rank = rankForLevel(progress.level)
  const pct = Math.max(
    0,
    Math.min(100, Math.round((progress.xpIntoLevel / Math.max(1, progress.xpForNext)) * 100)),
  )

  const restante = Math.max(0, progress.xpForNext - progress.xpIntoLevel)
  const titulo =
    progress.level >= progress.maxLevel
      ? `${rank.name} · nivel máximo`
      : `${rank.name} · ${restante} XP para el nivel ${progress.level + 1}` +
        (progress.currentStreak > 0
          ? ` · ${progress.currentStreak} ${progress.currentStreak === 1 ? 'día' : 'días'} de racha`
          : '')

  return (
    <Link
      href="/studio"
      aria-label={titulo}
      title={titulo}
      className="relative hidden size-10 shrink-0 rounded-full border-2 border-white shadow-[0_10px_22px_rgba(125,138,150,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(125,138,150,0.24),inset_0_1px_0_rgba(255,255,255,0.92)] active:translate-y-0 active:scale-95 sm:block"
      style={{
        // Aro de progreso: relleno hasta `pct`, pista gris el resto.
        background: `conic-gradient(${rank.color} ${pct * 3.6}deg, #EAE4E2 ${pct * 3.6}deg)`,
      }}
    >
      <span className="absolute inset-[2px] flex items-center justify-center rounded-full bg-white">
        <span className="text-[13px] font-black leading-none" style={{ color: rank.color }}>
          {progress.level}
        </span>
      </span>

      {progress.currentStreak > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-[#ea8600] px-1 text-[10px] font-bold leading-3 text-white">
          {progress.currentStreak}
        </span>
      ) : null}
    </Link>
  )
}
