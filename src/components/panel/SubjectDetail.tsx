'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSubjectTrend, useTopicHeatmap } from '@/hooks/useAnalytics'
import type {
  AnalyticsMode,
  AnalyticsWindow,
  SubjectHeatmapCell,
} from '@/services/analyticsService'
import {
  AccuracyRing,
  C,
  StackedBar,
  toneColor,
  TopicColumns,
  TrendChart,
} from './charts'

// Barra fina con "glow" para las listas de temas fuertes/débiles.
function GlowBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-[#F0EAE6]">
      <motion.div
        className="h-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}55` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(3, pct)}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

function TopicList({
  title,
  icon,
  accent,
  topics,
  metric,
}: {
  title: string
  icon: string
  accent: string
  topics: { topicId: number; name: string; total: number; accuracy: number | null }[]
  metric: 'accuracy' | 'fail'
}) {
  return (
    <div className="rounded-2xl border border-[#EAE0D5] bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span
          className="flex size-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </span>
        <span className="text-sm font-bold text-[#141514]">{title}</span>
      </div>
      {topics.length === 0 ? (
        <p className="py-3 text-xs text-[#7D8A96]">Sin datos suficientes.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {topics.map((t) => {
            const acc = t.accuracy ?? 0
            const shown = metric === 'fail' ? 100 - acc : acc
            return (
              <div key={t.topicId} className="group">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#141514]">{t.name}</p>
                    <p className="text-[10px] text-[#7D8A96]">{t.total} preguntas</p>
                  </div>
                  <span className="text-sm font-black" style={{ color: accent }}>
                    {Math.round(shown)}%
                  </span>
                </div>
                <GlowBar pct={shown} color={accent} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SubjectDetail({
  subject,
  window,
  mode,
  onClose,
}: {
  subject: SubjectHeatmapCell
  window: AnalyticsWindow
  mode: AnalyticsMode
  onClose: () => void
}) {
  const { data: topicHeatmap, loading: topicsLoading } = useTopicHeatmap(
    subject.subjectId,
    window,
    mode,
  )
  const { data: trend, loading: trendLoading } = useSubjectTrend(subject.subjectId, window)

  const topics = topicHeatmap?.topics ?? []

  const { weak, strong } = useMemo(() => {
    const withData = topics.filter((t) => t.total > 0)
    const sorted = [...withData].sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))
    return { weak: sorted.slice(0, 3), strong: [...sorted].reverse().slice(0, 3) }
  }, [topics])

  const byVolume = useMemo(
    () => [...topics].sort((a, b) => b.total - a.total),
    [topics],
  )

  const trendPoints = (trend?.points ?? []).map((p) => ({
    label: p.day,
    value: p.accuracy,
  }))

  const tone = toneColor(subject.accuracy)
  const tip = weak[0]
    ? `Tu tema más flojo aquí es "${weak[0].name}" (${Math.round(weak[0].accuracy ?? 0)}% de aciertos). Un repaso rápido puede subir tu media de la asignatura.`
    : 'Sigue practicando para desbloquear recomendaciones personalizadas por tema.'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-5 overflow-hidden rounded-2xl border border-[#EAE0D5] bg-white shadow-sm"
      style={{ borderTop: `4px solid ${tone}` }}
    >
      {/* Decoración de fondo */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="material-symbols-outlined absolute -right-6 -top-8 select-none text-[160px] text-[#E8A598]/5">
          insights
        </span>
      </div>

      <div className="relative z-10 p-6 md:p-8">
        {/* Cabecera */}
        <div className="flex flex-col gap-6 border-b border-[#F0EAE6] pb-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <AccuracyRing accuracy={subject.accuracy} />
            <div>
              <span className="inline-flex items-center rounded-md bg-[#E8A598]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#d18d80] ring-1 ring-inset ring-[#E8A598]/20">
                Asignatura
              </span>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-[#141514] md:text-3xl">
                {subject.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-md bg-[#8BA888]/10 px-2 py-1 text-[#5f7d5c]">
                  {subject.correct} aciertos
                </span>
                <span className="rounded-md bg-[#C4655A]/10 px-2 py-1 text-[#C4655A]">
                  {subject.wrong} fallos
                </span>
                <span className="rounded-md bg-[#7D8A96]/10 px-2 py-1 text-[#7D8A96]">
                  {subject.blank} en blanco
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 self-start rounded-xl border border-[#EAE0D5] px-3 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:border-[#E8A598]/50 hover:text-[#141514]"
          >
            <span className="material-symbols-outlined text-lg">close</span>
            Cerrar
          </button>
        </div>

        {/* Evolución + desglose por tema */}
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#141514]">Evolución de la precisión</h4>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#7D8A96]">
                <span className="size-2 rounded-full" style={{ backgroundColor: tone }} />
                {subject.total} preg. totales
              </div>
            </div>
            {trendLoading ? (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-[#EAE0D5] bg-[#FAF7F4]/60 text-sm text-[#7D8A96]">
                Cargando evolución...
              </div>
            ) : (
              <TrendChart points={trendPoints} color={tone} />
            )}
          </div>

          <div>
            <h4 className="mb-3 text-sm font-bold text-[#141514]">Desglose por tema</h4>
            {topicsLoading ? (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-[#EAE0D5] bg-[#FAF7F4]/60 text-sm text-[#7D8A96]">
                Cargando temas...
              </div>
            ) : byVolume.length === 0 ? (
              <div className="flex h-[200px] items-center justify-center rounded-xl border border-[#EAE0D5] bg-[#FAF7F4]/60 text-sm text-[#7D8A96]">
                Sin datos de temas en esta ventana.
              </div>
            ) : (
              <TopicColumns topics={byVolume} max={6} />
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#7D8A96]">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded" style={{ backgroundColor: C.correct }} /> Aciertos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded" style={{ backgroundColor: C.wrong }} /> Fallos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded" style={{ backgroundColor: C.blank }} /> En blanco
          </span>
        </div>

        {/* Temas fuertes / débiles */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TopicList
            title="Temas fuertes"
            icon="emoji_events"
            accent={C.correct}
            topics={strong}
            metric="accuracy"
          />
          <TopicList
            title="Temas débiles"
            icon="warning"
            accent={C.wrong}
            topics={weak}
            metric="fail"
          />
        </div>

        {/* Tip */}
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-[#2c3e50] to-[#141514] p-5 text-white">
          <span className="material-symbols-outlined mt-0.5 shrink-0 text-[#E8A598]">
            auto_awesome
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#E8A598]">
              Sugerencia
            </p>
            <p className="mt-1 text-sm text-white/85">{tip}</p>
          </div>
        </div>

        {/* Barra global de la asignatura */}
        <div className="mt-6">
          <StackedBar
            correct={subject.correct}
            wrong={subject.wrong}
            blank={subject.blank}
            height={12}
          />
        </div>
      </div>
    </motion.div>
  )
}
