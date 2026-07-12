'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSubjectHeatmap } from '@/hooks/useAnalytics'
import type {
  AnalyticsMode,
  AnalyticsWindow,
  SubjectHeatmapCell,
} from '@/services/analyticsService'
import { Segmented } from './Segmented'
import { galacticFactor, heatColor, heatColorDark } from './charts'
import SubjectDetail from './SubjectDetail'

const WINDOW_OPTIONS: { value: AnalyticsWindow; label: string }[] = [
  { value: '7d', label: 'Semana' },
  { value: '30d', label: 'Mes' },
  { value: 'all', label: 'Global' },
]

const MODE_OPTIONS: { value: AnalyticsMode; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'daily', label: 'Daily' },
  { value: 'simulacro', label: 'Simulacros' },
  { value: 'studio', label: 'Mazos' },
]

// Leyenda del gradiente de calor (para que se lea como heatmap).
function HeatLegend() {
  const stops = [0, 20, 30, 38, 46, 55, 66, 78, 90, 100]
  const gradient = `linear-gradient(90deg, ${stops.map((s) => heatColor(s)).join(', ')})`
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]">
        Menos
      </span>
      <div className="relative h-3 w-28 overflow-hidden rounded-full ring-1 ring-black/5" style={{ background: gradient }}>
        <div className="galactic-stars absolute inset-y-0 right-0 w-1/4" style={{ opacity: 0.85 }} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]">
        Más
      </span>
    </div>
  )
}

function SubjectCard({
  subject,
  active,
  onClick,
  index,
  entered,
  startDelay,
}: {
  subject: SubjectHeatmapCell
  active: boolean
  onClick: () => void
  index: number
  entered: boolean
  startDelay: number
}) {
  const acc = subject.accuracy
  const bg = heatColor(acc)
  const bgDark = heatColorDark(acc)
  const gf = galacticFactor(acc)
  return (
    <motion.button
      type="button"
      onClick={onClick}
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={entered ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 16, scale: 0.96 }}
      transition={{ duration: 0.42, delay: startDelay + Math.min(index * 0.045, 0.7), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={`group relative flex min-h-[76px] flex-col justify-center overflow-hidden rounded-lg text-left text-white shadow-sm transition-shadow hover:shadow-lg ${
        active ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#FAF7F4]' : ''
      }`}
      style={gf > 0 ? undefined : { background: `linear-gradient(140deg, ${bg}, ${bgDark})` }}
    >
      {/* Zona galáctica plena (>=65%): borde arcoíris giratorio + textura estelar */}
      {gf > 0 ? (
        <>
          <span className="galactic-rainbow pointer-events-none" aria-hidden />
          <span
            className="pointer-events-none absolute inset-[2.5px] rounded-[6px]"
            style={{ background: `linear-gradient(140deg, ${bg}, ${bgDark})` }}
          />
          <span className="galactic-nebula pointer-events-none absolute inset-[2.5px] rounded-[6px]" />
          <span className="galactic-stars pointer-events-none absolute inset-[2.5px] rounded-[6px]" />
        </>
      ) : null}

      <span className="relative z-10 flex w-full flex-col items-start gap-1 p-3">
        <span
          className="line-clamp-2 text-[10px] font-bold uppercase leading-tight tracking-wider text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]"
          title={subject.name}
        >
          {subject.name}
        </span>
        <span className="text-xl font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
          {acc == null ? '--' : `${Math.round(acc)}%`}
        </span>
      </span>
    </motion.button>
  )
}

export default function SubjectHeatmapSection({
  active = true,
  startDelay = 0,
}: {
  active?: boolean
  startDelay?: number
}) {
  const [window, setWindow] = useState<AnalyticsWindow>('all')
  const [mode, setMode] = useState<AnalyticsMode>('all')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)

  const { data, loading, error } = useSubjectHeatmap(window, mode)

  const subjects = useMemo(() => {
    const rows = data?.subjects ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((s) => s.name.toLowerCase().includes(q))
  }, [data, search])

  const openSubject = useMemo(
    () => subjects.find((s) => s.subjectId === openId) ?? null,
    [subjects, openId],
  )

  const resetOnFilter = () => setOpenId(null)

  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 22 } as const,
    animate: active ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    transition: { duration: 0.5, delay: startDelay + i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <section className="space-y-4">
      <motion.div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" {...reveal(0)}>
        <div>
          <h3 className="text-2xl font-bold text-[#141514]">Mapa de Calor por Asignaturas</h3>
          <p className="mt-1 text-sm text-[#7D8A96]">
            Pulsa una asignatura para ver su evolución y desglose por temas.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#7D8A96]">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar asignatura..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#EAE0D5] bg-white py-2 pl-10 pr-4 text-sm text-[#141514] shadow-sm outline-none focus:ring-2 focus:ring-[#E8A598]/50"
          />
        </div>
      </motion.div>

      <motion.div className="flex flex-wrap items-center gap-3" {...reveal(1)}>
        <Segmented
          groupId="heatmap-window"
          options={WINDOW_OPTIONS}
          value={window}
          onChange={(v) => {
            setWindow(v)
            resetOnFilter()
          }}
        />
        <Segmented
          groupId="heatmap-mode"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(v) => {
            setMode(v)
            resetOnFilter()
          }}
        />
        <HeatLegend />
      </motion.div>

      <motion.div className="rounded-2xl border border-[#EAE0D5] bg-white/60 p-5 shadow-sm backdrop-blur-sm" {...reveal(2)}>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-lg bg-[#F0EAE6]" />
            ))}
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-[#C4655A]">{error}</p>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="material-symbols-outlined text-4xl text-[#CFC5BB]">bubble_chart</span>
            <p className="text-sm text-[#7D8A96]">
              Aún no hay datos en esta ventana. Responde preguntas para construir tu mapa.
            </p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {subjects.map((s, i) => (
              <SubjectCard
                key={s.subjectId}
                subject={s}
                index={i}
                active={openId === s.subjectId}
                entered={active}
                startDelay={startDelay + 0.22}
                onClick={() => setOpenId(openId === s.subjectId ? null : s.subjectId)}
              />
            ))}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {openSubject ? (
            <SubjectDetail
              key={openSubject.subjectId}
              subject={openSubject}
              window={window}
              mode={mode}
              onClose={() => setOpenId(null)}
            />
          ) : null}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
