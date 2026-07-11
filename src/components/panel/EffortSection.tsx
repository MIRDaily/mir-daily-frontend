'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useEffort } from '@/hooks/useAnalytics'
import type { AnalyticsWindow } from '@/services/analyticsService'
import { Segmented } from './Segmented'
import { CountUp, StackedBar } from './charts'

const WINDOW_OPTIONS: { value: AnalyticsWindow; label: string }[] = [
  { value: '7d', label: 'Semana' },
  { value: '30d', label: 'Mes' },
  { value: 'all', label: 'Global' },
]

const MODE_LABELS: Record<string, string> = {
  daily: 'Daily',
  simulacro: 'Simulacros',
  studio: 'Mazos',
}

export default function EffortSection() {
  const [window, setWindow] = useState<AnalyticsWindow>('30d')
  const { data: effort, loading } = useEffort(window)

  const totals = effort?.totals ?? {
    questions: 0,
    correct: 0,
    wrong: 0,
    blank: 0,
    timeSpentSeconds: 0,
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold text-[#141514]">Tu esfuerzo</h3>
          <p className="mt-1 text-sm text-[#7D8A96]">
            Cuántas preguntas has hecho y cómo se reparten.
          </p>
        </div>
        <Segmented groupId="effort-window" options={WINDOW_OPTIONS} value={window} onChange={setWindow} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* Totales */}
        <div className="rounded-2xl border border-[#EAE0D5] bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
            Preguntas realizadas
          </p>
          <p className="mt-1 text-4xl font-black text-[#141514]">
            {loading ? '...' : <CountUp value={totals.questions} />}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#8BA888]/10 p-2">
              <p className="text-lg font-black text-[#5f7d5c]">
                <CountUp value={totals.correct} />
              </p>
              <p className="text-[10px] font-bold uppercase text-[#7D8A96]">Aciertos</p>
            </div>
            <div className="rounded-lg bg-[#C4655A]/10 p-2">
              <p className="text-lg font-black text-[#C4655A]">
                <CountUp value={totals.wrong} />
              </p>
              <p className="text-[10px] font-bold uppercase text-[#7D8A96]">Fallos</p>
            </div>
            <div className="rounded-lg bg-[#7D8A96]/10 p-2">
              <p className="text-lg font-black text-[#7D8A96]">
                <CountUp value={totals.blank} />
              </p>
              <p className="text-[10px] font-bold uppercase text-[#7D8A96]">En blanco</p>
            </div>
          </div>
          <div className="mt-4">
            <StackedBar
              correct={totals.correct}
              wrong={totals.wrong}
              blank={totals.blank}
              height={10}
            />
          </div>
        </div>

        {/* Distribución por modo */}
        <div className="rounded-2xl border border-[#EAE0D5] bg-white p-6 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
            Distribución por modo
          </p>
          {(effort?.byMode.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-[#7D8A96]">
              Aún no hay actividad en esta ventana.
            </p>
          ) : (
            <div className="space-y-4">
              {effort?.byMode.map((row, i) => (
                <motion.div
                  key={row.mode}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#141514]">
                      {MODE_LABELS[row.mode] ?? row.mode}
                    </span>
                    <span className="text-[#7D8A96]">{row.questions} preg.</span>
                  </div>
                  <StackedBar correct={row.correct} wrong={row.wrong} blank={row.blank} height={10} />
                </motion.div>
              ))}
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-[#7D8A96]">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-[#8BA888]" /> Aciertos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-[#C4655A]" /> Fallos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-[#7D8A96]" /> En blanco
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
