'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useProgressContext } from '@/providers/ProgressProvider'
import { rankForLevel } from '@/lib/levels'
import StreakFlame from '@/components/progress/StreakFlame'
import MarcoNivel from '@/components/progress/MarcoNivel'

const numberFormat = new Intl.NumberFormat('es-ES')

/**
 * Banda de XP en la pantalla de resultados del Daily.
 *
 * Este es el momento con más carga motivadora de todo el producto: el usuario
 * acaba de terminar y está mirando. Si el XP solo se ve entrando al Studio, el
 * sistema entero se vuelve invisible justo cuando más debería notarse.
 *
 * Habla de "hoy", no "de esta sesión", porque el ledger cuenta por día y el
 * usuario puede haber estudiado mazos antes: prometer que esos 121 XP salen
 * del Daily sería mentir en la única cifra que sostiene la escala.
 *
 * Deliberadamente NO enseña la puntuación del Daily (pts): son dos monedas
 * distintas (una compite contra los demás, la otra mide constancia) y juntarlas
 * en la misma tarjeta las confunde. El desglose de pts vive justo debajo.
 */
export default function DailyXpBanner() {
  const { data } = useProgressContext()
  const reduceMotion = useReducedMotion()

  const progress = data?.progress
  if (!progress) return null

  const rank = rankForLevel(progress.level)
  const pct = Math.max(
    0,
    Math.min(100, Math.round((progress.xpIntoLevel / Math.max(1, progress.xpForNext)) * 100)),
  )
  const restante = Math.max(0, progress.xpForNext - progress.xpIntoLevel)

  const reales = (data?.daily ?? []).filter((c) => c.metric !== 'all_daily')
  const hechos = reales.filter((c) => c.completed).length

  return (
    <motion.div
      className="rounded-3xl border border-[#F0EBE8] bg-white p-6 shadow-sm"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row">
        <MarcoNivel nivel={progress.level} tamano={64} color={rank.color} />

        <div className="w-full min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-extrabold text-[#374151]">
              +{numberFormat.format(progress.xpTodayTotal ?? progress.xpToday)} XP hoy
            </span>
            <span className="text-sm font-medium text-[#7D8A96]">{rank.name}</span>
            {progress.currentStreak > 0 ? (
              <span className="flex items-center gap-1 text-sm font-medium text-[#7D8A96]">
                <StreakFlame streak={progress.currentStreak} size={20} />
                {progress.currentStreak} {progress.currentStreak === 1 ? 'día' : 'días'} de racha
              </span>
            ) : null}
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F3EFED]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: rank.color }}
              initial={reduceMotion ? false : { width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.2, 0.9, 0.2, 1] }}
            />
          </div>

          <p className="mt-1.5 text-xs text-[#7D8A96]">
            {progress.level >= progress.maxLevel
              ? 'Has llegado al nivel máximo.'
              : `${numberFormat.format(restante)} XP para el nivel ${progress.level + 1}`}
            {reales.length > 0
              ? ` · ${hechos} de ${reales.length} desafíos de hoy completados`
              : ''}
          </p>
        </div>

        <Link
          href="/studio"
          className="shrink-0 rounded-xl border border-[#EAE4E2] px-4 py-2 text-sm font-semibold text-[#7D8A96] transition-all hover:-translate-y-0.5 hover:border-[#E8A598]/40 hover:text-[#E8A598]"
        >
          Ver desafíos
        </Link>
      </div>
    </motion.div>
  )
}
