'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useWeakPoints } from '@/hooks/useAnalytics'
import type { WeakTopic } from '@/services/analyticsService'
import { Segmented } from './Segmented'

type WinKey = 'week' | 'month' | 'global'

const TABS: { value: WinKey; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'global', label: 'Global' },
]

function WeakRow({ topic, rank }: { topic: WeakTopic; rank: number }) {
  const fail = topic.failRate ?? 0
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.05 }}
      className="flex items-center gap-4 rounded-xl border border-[#EAE0D5] bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#C4655A]/10 text-sm font-black text-[#C4655A]">
        {rank + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#141514]">{topic.name}</p>
            <p className="truncate text-xs text-[#7D8A96]">
              {topic.subjectName} · {topic.total} preg.
            </p>
          </div>
          <span className="shrink-0 text-lg font-black text-[#C4655A]">
            {Math.round(fail)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[#F0EAE6]">
          <motion.div
            className="h-2 rounded-full bg-[#C4655A]"
            style={{ boxShadow: '0 0 10px rgba(196,101,90,0.35)' }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(3, fail)}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export default function WeakPointsSection({
  active = true,
  startDelay = 0,
}: {
  active?: boolean
  startDelay?: number
}) {
  const { data, loading } = useWeakPoints()
  const [tab, setTab] = useState<WinKey>('global')

  const topics = data?.[tab]?.topics ?? []

  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 22 } as const,
    animate: active ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    transition: { duration: 0.5, delay: startDelay + i * 0.12, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section className="space-y-4">
      <motion.div className="flex flex-wrap items-center justify-between gap-3" {...reveal(0)}>
        <div>
          <h3 className="text-2xl font-bold text-[#141514]">Puntos débiles</h3>
          <p className="mt-1 text-sm text-[#7D8A96]">
            Los temas donde más fallas (los blancos cuentan como no dominados).
          </p>
        </div>
        <Segmented groupId="weak-window" options={TABS} value={tab} onChange={setTab} />
      </motion.div>

      <motion.div className="rounded-2xl border border-[#EAE0D5] bg-white/60 p-5 shadow-sm backdrop-blur-sm" {...reveal(1)}>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F0EAE6]" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-[#8BA888]">verified</span>
            <p className="text-sm text-[#7D8A96]">
              Aún no hay suficientes datos en esta ventana. ¡Sigue practicando!
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {topics.map((t, i) => (
                <WeakRow key={`${tab}-${t.topicId}`} topic={t} rank={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </section>
  )
}
