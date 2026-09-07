'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { Challenge } from '@/services/progressService'

const numberFormat = new Intl.NumberFormat('es-ES')

function ChallengeRow({ c, delay, reduceMotion }: {
  c: Challenge
  delay: number
  reduceMotion: boolean | null
}) {
  const pct = Math.max(0, Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100)))

  return (
    <motion.li
      className={`rounded-xl border p-4 transition-colors ${
        c.completed
          ? 'border-[#8BA888]/40 bg-[#8BA888]/8'
          : 'border-[#EAE4E2] bg-white'
      }`}
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold text-[#2c3e50]">
            {c.completed ? (
              <span className="flex h-4 w-4 items-center justify-center">
                <span className="material-symbols-outlined text-[18px] text-[#8BA888]">
                  check_circle
                </span>
              </span>
            ) : null}
            {c.title}
          </p>
          <p className="mt-0.5 text-sm text-[#7D8A96]">{c.description}</p>
        </div>

        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${
            c.completed ? 'bg-[#8BA888] text-white' : 'bg-[#F3EFED] text-[#7D8A96]'
          }`}
        >
          +{numberFormat.format(c.xpReward)} XP
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3EFED]">
          <motion.div
            className={`h-full rounded-full ${c.completed ? 'bg-[#8BA888]' : 'bg-[#d18d80]'}`}
            initial={reduceMotion ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: delay + 0.1, ease: [0.2, 0.9, 0.2, 1] }}
          />
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-[#7D8A96]">
          {numberFormat.format(c.progress)}/{numberFormat.format(c.target)}
        </span>
      </div>
    </motion.li>
  )
}

type Props = {
  daily: Challenge[]
  weekly: Challenge[]
  loading?: boolean
}

/**
 * Desafíos del día y de la semana.
 *
 * El bloque semanal se muestra siempre, incluso vacío de progreso: es el que
 * sostiene la vuelta el lunes, y esconderlo hasta que haya avance lo haría
 * invisible justo cuando más falta hace.
 */
export default function ChallengesSection({ daily, weekly, loading = false }: Props) {
  const reduceMotion = useReducedMotion()

  if (loading && daily.length === 0 && weekly.length === 0) {
    return (
      <div className="rounded-2xl border border-[#EAE4E2] bg-white p-6 shadow-sm">
        <p className="text-sm text-[#7D8A96]">Cargando tus desafíos…</p>
      </div>
    )
  }

  if (daily.length === 0 && weekly.length === 0) return null

  // "Día redondo" es el bono por completar los otros tres, no un cuarto
  // desafío: contarlo daría "1/4" cuando el usuario ve tres tareas.
  const reales = daily.filter((c) => c.metric !== 'all_daily')
  const hechosHoy = reales.filter((c) => c.completed).length

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center">
              <span className="material-symbols-outlined text-[#d18d80]">today</span>
            </span>
            <h3 className="text-lg font-bold text-[#2c3e50]">Desafíos de hoy</h3>
          </div>
          <span className="text-sm font-medium text-[#7D8A96]">
            {hechosHoy}/{reales.length}
          </span>
        </div>
        <ul className="flex flex-col gap-3">
          {daily.map((c, i) => (
            <ChallengeRow key={c.code} c={c} delay={i * 0.06} reduceMotion={reduceMotion} />
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center">
            <span className="material-symbols-outlined text-[#5E9AA8]">date_range</span>
          </span>
          <h3 className="text-lg font-bold text-[#2c3e50]">Esta semana</h3>
        </div>
        <ul className="flex flex-col gap-3">
          {weekly.map((c, i) => (
            <ChallengeRow key={c.code} c={c} delay={0.1 + i * 0.06} reduceMotion={reduceMotion} />
          ))}
        </ul>
      </section>
    </div>
  )
}
