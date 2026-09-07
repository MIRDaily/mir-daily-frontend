'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ProgressSummary } from '@/services/progressService'
import { nextRank, rankForLevel } from '@/lib/levels'
import StreakFlame from '@/components/progress/StreakFlame'

const numberFormat = new Intl.NumberFormat('es-ES')

type Props = {
  progress: ProgressSummary | null
  loading?: boolean
}

/**
 * Tarjeta de nivel: rango, barra de XP dentro del nivel, racha y multiplicador.
 *
 * Deliberadamente NO enseña ningún porcentaje de acierto. El nivel mide
 * constancia; la precisión vive en el Panel. Juntarlos en la misma tarjeta
 * haría creer al usuario que un nivel alto significa que va a aprobar.
 */
export default function LevelCard({ progress, loading = false }: Props) {
  const reduceMotion = useReducedMotion()

  if (!progress) {
    return (
      <article className="rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#7D8A96]">
          {loading ? 'Cargando tu progreso…' : 'Tu progreso aparecerá aquí en cuanto estudies.'}
        </p>
      </article>
    )
  }

  const rank = rankForLevel(progress.level)
  const siguiente = nextRank(progress.level)
  const esTope = progress.level >= progress.maxLevel

  // xpForNext es el coste del nivel entero; si viniera a 0 (nivel máximo) no
  // se puede dividir.
  const pct = esTope
    ? 100
    : Math.max(0, Math.min(100, Math.round((progress.xpIntoLevel / Math.max(1, progress.xpForNext)) * 100)))
  const restante = Math.max(0, progress.xpForNext - progress.xpIntoLevel)

  // Dos cifras distintas a propósito: la barra mide el TOPE (y al tope solo
  // cuentan las fuentes de estudio), mientras que el número grande es lo ganado
  // hoy de verdad. Los premios semanales caen todos el mismo día y viven fuera
  // del tope: enseñar "300 / 300" un domingo en que se han ganado 800 XP sería
  // dejar 500 sin contar.
  const capPct = Math.max(
    0,
    Math.min(100, Math.round((progress.xpToday / Math.max(1, progress.dailyCap)) * 100)),
  )
  const xpHoy = progress.xpTodayTotal ?? progress.xpToday
  const hayExtras = xpHoy > progress.xpToday

  return (
    <article className="overflow-hidden rounded-2xl border border-[#EAE4E2] bg-white shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
        {/* Insignia de nivel */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border-2 text-center"
            style={{ borderColor: rank.color, backgroundColor: `${rank.soft}14` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: rank.color }}>
              Nivel
            </span>
            <span className="text-2xl font-black leading-none" style={{ color: rank.color }}>
              {progress.level}
            </span>
          </div>

          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight text-[#2c3e50]">{rank.name}</p>
            <p className="text-sm text-[#7D8A96]">
              {numberFormat.format(progress.xpTotal)} XP en total
            </p>
          </div>
        </div>

        {/* Barra de XP */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-[#2c3e50]">
              {esTope
                ? 'Nivel máximo alcanzado'
                : `${numberFormat.format(restante)} XP para el nivel ${progress.level + 1}`}
            </span>
            <span className="shrink-0 text-xs text-[#7D8A96]">
              {numberFormat.format(progress.xpIntoLevel)} / {numberFormat.format(progress.xpForNext)}
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F3EFED]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: rank.color }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: [0.2, 0.9, 0.2, 1] }}
            />
          </div>

          {siguiente ? (
            <p className="mt-1.5 text-xs text-[#7D8A96]">
              Siguiente rango: <span className="font-medium">{siguiente.name}</span> en el nivel{' '}
              {siguiente.minLevel}
            </p>
          ) : null}
        </div>
      </div>

      {/* Pie: racha, multiplicador y tope diario */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#EAE4E2] bg-[#FBF9F8] px-6 py-3">
        <div className="flex items-center gap-2">
          <StreakFlame streak={progress.currentStreak} size={26} />
          <span className="text-sm text-[#2c3e50]">
            <strong>{progress.currentStreak}</strong>{' '}
            {progress.currentStreak === 1 ? 'día' : 'días'} de racha
          </span>
          {progress.streakMultiplier > 1 ? (
            <span className="rounded-md bg-[#8BA888]/12 px-1.5 py-0.5 text-xs font-bold text-[#8BA888]">
              ×{progress.streakMultiplier.toFixed(2).replace('.', ',')} XP
            </span>
          ) : null}
        </div>

        {progress.streakFreezes > 0 ? (
          <div className="flex items-center gap-2" title="Cada protector cubre un día perdido sin romperte la racha">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e3f0f5]">
              <span className="material-symbols-outlined text-[18px] text-[#5E9AA8]">shield</span>
            </span>
            <span className="text-sm text-[#2c3e50]">
              <strong>{progress.streakFreezes}</strong>{' '}
              {progress.streakFreezes === 1 ? 'protector' : 'protectores'}
            </span>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#7D8A96]">
            Hoy <strong className="text-[#2c3e50]">{numberFormat.format(xpHoy)}</strong> XP
          </span>
          <span
            className="flex items-center gap-1.5"
            title={
              `${numberFormat.format(progress.xpToday)} de ${numberFormat.format(progress.dailyCap)} XP del tope diario` +
              (hayExtras
                ? `. Los ${numberFormat.format(xpHoy - progress.xpToday)} XP de premios semanales no gastan tope.`
                : '')
            }
          >
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#EAE4E2]">
              <span
                className="block h-full rounded-full bg-[#8BA888]"
                style={{ width: `${capPct}%` }}
              />
            </span>
            <span className="text-[10px] tabular-nums text-[#7D8A96]">
              {capPct}% del tope
            </span>
          </span>
        </div>
      </div>
    </article>
  )
}
