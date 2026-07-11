'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ActivityHeatmapGrid from '@/components/ActivityHeatmapGrid'
import ProgressChart from '@/components/ProgressChart'
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap'
import { useTimeSeries } from '@/hooks/useTimeSeries'
import {
  useEffort,
  useSubjectHeatmap,
  useTopicHeatmap,
  useWeakPoints,
} from '@/hooks/useAnalytics'
import type {
  AnalyticsMode,
  AnalyticsWindow,
} from '@/services/analyticsService'
import { debugRender } from '@/lib/debugRSC'

// Umbrales de tono sobre la precisión real (misma paleta que el diseño previo).
function accuracyTone(accuracy: number | null): 'good' | 'mid' | 'bad' | 'none' {
  if (accuracy == null) return 'none'
  if (accuracy >= 75) return 'good'
  if (accuracy >= 60) return 'mid'
  return 'bad'
}

function toneClass(tone: 'good' | 'mid' | 'bad' | 'none'): string {
  if (tone === 'good') return 'bg-[#8BA888]'
  if (tone === 'mid') return 'bg-[#7D8A96]'
  if (tone === 'bad') return 'bg-[#C4655A]'
  return 'bg-[#CFC5BB]'
}

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

function accuracyLabel(accuracy: number | null): string {
  return accuracy == null ? '--' : `${Math.round(accuracy)}%`
}

function formatQuestions(value: number | null): string {
  if (typeof value !== 'number') return '--'
  return new Intl.NumberFormat('es-ES').format(Math.round(value))
}

function formatScore(value: number | null): string {
  if (typeof value !== 'number') return '--'
  return `${Math.round(value)}`
}

function formatSeconds(value: number | null): string {
  if (typeof value !== 'number') return '--'
  return `${Math.round(value)}s`
}

type IntroPhase = 'idle' | 'cells' | 'glow' | 'reveal' | 'done'

function PanelMetricCard({
  title,
  value,
  subtitle,
  reveal,
  delayMs,
}: {
  title: string
  value: string
  subtitle?: string
  reveal: boolean
  delayMs: number
}) {
  return (
    <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
      <div className="panel-metric-flip-wrap h-[88px]">
        <div
          className={`panel-metric-flip-inner ${reveal ? 'is-revealed' : ''}`}
          style={{ transitionDelay: `${delayMs}ms` }}
        >
          <div className="panel-metric-face panel-metric-front">
            <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
              {title}
            </p>
            <p className="mt-2 text-3xl font-black text-[#CFC5BB]">...</p>
            <p className="mt-1 text-sm font-bold text-[#B8AEA4]">Preparando</p>
          </div>
          <div className="panel-metric-face panel-metric-back">
            <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
              {title}
            </p>
            <p className="mt-2 text-3xl font-black text-[#141514]">{value}</p>
            <p className="mt-1 text-sm font-bold text-[#7D8A96]">
              {subtitle ?? ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PanelPage() {
  debugRender('PanelPage')

  const [searchTerm, setSearchTerm] = useState('')
  // Ventana y modo activos del mapa de calor de asignaturas.
  const [heatmapWindow, setHeatmapWindow] = useState<AnalyticsWindow>('30d')
  const [heatmapMode, setHeatmapMode] = useState<AnalyticsMode>('all')
  // Asignatura desplegada para ver el detalle por temas (drill-down).
  const [openSubjectId, setOpenSubjectId] = useState<number | null>(null)
  // Ventana del bloque de esfuerzo.
  const [effortWindow, setEffortWindow] = useState<AnalyticsWindow>('30d')
  const [introPhase, setIntroPhase] = useState<IntroPhase>('idle')

  const {
    data: subjectHeatmap,
    loading: subjectHeatmapLoading,
    error: subjectHeatmapError,
  } = useSubjectHeatmap(heatmapWindow, heatmapMode)
  const {
    data: topicHeatmap,
    loading: topicHeatmapLoading,
  } = useTopicHeatmap(openSubjectId, heatmapWindow, heatmapMode)
  const { data: weakPoints, loading: weakPointsLoading } = useWeakPoints()
  const { data: effort, loading: effortLoading } = useEffort(effortWindow)
  const introStartedRef = useRef(false)
  const introTimersRef = useRef<number[]>([])
  const {
    data: activityHeatmapData,
    loading: activityHeatmapLoading,
    error: activityHeatmapError,
    refetch: refetchActivityHeatmap,
  } = useActivityHeatmap()
  const {
    data: timeSeriesData,
    loading: timeSeriesLoading,
    error: timeSeriesError,
    refetch: refetchTimeSeries,
  } = useTimeSeries()
  const handleRetryActivityHeatmap = useCallback(() => {
    void refetchActivityHeatmap()
  }, [refetchActivityHeatmap])
  const handleRetryTimeSeries = useCallback(() => {
    void refetchTimeSeries()
  }, [refetchTimeSeries])

  const visibleSubjects = useMemo(() => {
    const rows = subjectHeatmap?.subjects ?? []
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((subject) =>
      subject.name.toLowerCase().includes(normalized),
    )
  }, [subjectHeatmap, searchTerm])

  const totalPoints = timeSeriesData?.totalPoints ?? 0
  const hasPoints = totalPoints > 0
  const scoreValue =
    hasPoints && typeof timeSeriesData?.avgScore30 === 'number'
      ? formatScore(timeSeriesData.avgScore30)
      : '--'
  const avgTimeValue =
    hasPoints && typeof timeSeriesData?.avgTime30 === 'number'
      ? formatSeconds(timeSeriesData.avgTime30)
      : '--'
  // Nº de dailys completados (una fila de daily_attempts = un daily entero).
  const totalPointsValue = hasPoints ? formatQuestions(totalPoints) : '--'
  const shouldRevealCards = introPhase === 'reveal' || introPhase === 'done'
  const shouldDrawChart = introPhase === 'reveal' || introPhase === 'done'

  useEffect(() => {
    if (introStartedRef.current) return
    if (activityHeatmapLoading || timeSeriesLoading) return
    if (!activityHeatmapData || !timeSeriesData) return

    introStartedRef.current = true
    const cellsTimer = window.setTimeout(() => {
      setIntroPhase('cells')
    }, 0)
    const glowTimer = window.setTimeout(() => {
      setIntroPhase('glow')
    }, 980)
    const revealTimer = window.setTimeout(() => {
      setIntroPhase('reveal')
    }, 2280)
    const doneTimer = window.setTimeout(() => {
      setIntroPhase('done')
    }, 3180)
    introTimersRef.current = [cellsTimer, glowTimer, revealTimer, doneTimer]

    return () => {
      introTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      introTimersRef.current = []
    }
  }, [activityHeatmapData, activityHeatmapLoading, timeSeriesData, timeSeriesLoading])

  return (
    <div className="min-h-screen bg-[#FAF7F4] text-[#141514]">
      <main className="mx-auto w-full max-w-[1280px] space-y-8 px-4 py-8 md:px-6">
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#141514] md:text-4xl">
                Tu Progreso Global
              </h1>
              <p className="mt-1 text-base text-[#7D8A96] md:text-lg">
                Analisis predictivo consolidado de tu rendimiento.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#EAE0D5] bg-white p-6 shadow-sm md:p-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <PanelMetricCard
                    title="Puntuacion promedio"
                    value={timeSeriesLoading ? '...' : scoreValue}
                    subtitle="Ultimos 30 dailys"
                    reveal={shouldRevealCards}
                    delayMs={0}
                  />
                  <PanelMetricCard
                    title="Dailys realizados"
                    value={timeSeriesLoading ? '...' : totalPointsValue}
                    reveal={shouldRevealCards}
                    delayMs={90}
                  />
                  <PanelMetricCard
                    title="Tiempo medio"
                    value={timeSeriesLoading ? '...' : avgTimeValue}
                    reveal={shouldRevealCards}
                    delayMs={180}
                  />
                </div>

                <ProgressChart
                  data={timeSeriesData}
                  loading={timeSeriesLoading}
                  error={timeSeriesError}
                  onRetry={handleRetryTimeSeries}
                  drawActive={shouldDrawChart}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#E8A598]">
                    calendar_month
                  </span>
                  <h2 className="text-lg font-bold text-[#141514]">
                    Mapa de Actividad
                  </h2>
                </div>
                <ActivityHeatmapGrid
                  data={activityHeatmapData}
                  loading={activityHeatmapLoading}
                  error={activityHeatmapError}
                  onRetry={handleRetryActivityHeatmap}
                  introPhase={introPhase}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-2xl font-bold text-[#141514]">
              Mapa de Calor de Asignaturas
            </h3>
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#7D8A96] text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar asignatura..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-[#EAE0D5] bg-white py-2 pl-10 pr-4 text-sm text-[#141514] shadow-sm outline-none focus:ring-2 focus:ring-[#E8A598]/50"
              />
            </div>
          </div>

          {/* Selectores de ventana y modo */}
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              options={WINDOW_OPTIONS}
              value={heatmapWindow}
              onChange={(v) => {
                setHeatmapWindow(v)
                setOpenSubjectId(null)
              }}
            />
            <SegmentedControl
              options={MODE_OPTIONS}
              value={heatmapMode}
              onChange={(v) => {
                setHeatmapMode(v)
                setOpenSubjectId(null)
              }}
            />
          </div>

          <div className="rounded-2xl border border-[#EAE0D5] bg-white p-5 shadow-sm">
            {subjectHeatmapLoading ? (
              <p className="py-8 text-center text-sm text-[#7D8A96]">
                Cargando mapa de asignaturas...
              </p>
            ) : subjectHeatmapError ? (
              <p className="py-8 text-center text-sm text-[#C4655A]">
                {subjectHeatmapError}
              </p>
            ) : visibleSubjects.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#7D8A96]">
                Aún no hay datos en esta ventana. Responde preguntas para
                empezar a construir tu mapa de calor.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {visibleSubjects.map((subject) => {
                  const tone = accuracyTone(subject.accuracy)
                  const isOpen = openSubjectId === subject.subjectId
                  return (
                    <button
                      key={subject.subjectId}
                      type="button"
                      onClick={() =>
                        setOpenSubjectId(isOpen ? null : subject.subjectId)
                      }
                      className={`rounded-lg p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${toneClass(tone)} ${
                        isOpen ? 'ring-2 ring-[#141514]/30' : ''
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                        {subject.name}
                      </p>
                      <p className="mt-1 text-2xl font-black text-white">
                        {accuracyLabel(subject.accuracy)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold text-white/80">
                        {subject.total} preg. · {subject.blank} en blanco
                      </p>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Drill-down por temas de la asignatura seleccionada */}
            {openSubjectId != null ? (
              <div className="mt-5 rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#7D8A96]">
                  Temas ·{' '}
                  {visibleSubjects.find((s) => s.subjectId === openSubjectId)?.name}
                </h4>
                {topicHeatmapLoading ? (
                  <p className="py-4 text-center text-sm text-[#7D8A96]">
                    Cargando temas...
                  </p>
                ) : (topicHeatmap?.topics.length ?? 0) === 0 ? (
                  <p className="py-4 text-center text-sm text-[#7D8A96]">
                    Sin datos de temas en esta ventana.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {topicHeatmap?.topics.map((topic) => (
                      <div
                        key={topic.topicId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-[#EAE0D5] bg-white px-3 py-2"
                      >
                        <span className="truncate text-sm text-[#141514]">
                          {topic.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-semibold text-[#7D8A96]">
                            {topic.total} preg.
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${toneClass(accuracyTone(topic.accuracy))}`}
                          >
                            {accuracyLabel(topic.accuracy)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        {/* Puntos débiles: dónde falla más el usuario (semana / mes / global) */}
        <section className="space-y-4">
          <h3 className="text-2xl font-bold text-[#141514]">Puntos débiles</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(
              [
                { key: 'week' as const, label: 'Esta semana' },
                { key: 'month' as const, label: 'Este mes' },
                { key: 'global' as const, label: 'Global' },
              ]
            ).map(({ key, label }) => {
              const topics = weakPoints?.[key]?.topics ?? []
              return (
                <article
                  key={key}
                  className="rounded-2xl border border-[#EAE0D5] bg-white p-5 shadow-sm"
                >
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
                    {label}
                  </p>
                  {weakPointsLoading ? (
                    <p className="py-4 text-sm text-[#7D8A96]">Cargando...</p>
                  ) : topics.length === 0 ? (
                    <p className="py-4 text-sm text-[#7D8A96]">
                      Aún no hay suficientes datos.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {topics.map((topic) => (
                        <li
                          key={topic.topicId}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#141514]">
                              {topic.name}
                            </p>
                            <p className="truncate text-xs text-[#7D8A96]">
                              {topic.subjectName} · {topic.total} preg.
                            </p>
                          </div>
                          <span className="shrink-0 rounded-md bg-[#C4655A] px-2 py-0.5 text-xs font-bold text-white">
                            {topic.failRate == null
                              ? '--'
                              : `${Math.round(topic.failRate)}% fallo`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        </section>

        {/* Esfuerzo: volumen de preguntas y su distribución por modo/asignatura */}
        <section className="space-y-4 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-2xl font-bold text-[#141514]">Tu esfuerzo</h3>
            <SegmentedControl
              options={WINDOW_OPTIONS}
              value={effortWindow}
              onChange={setEffortWindow}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
            {/* Totales acierto/fallo/blanco */}
            <div className="rounded-2xl border border-[#EAE0D5] bg-white p-6 shadow-sm">
              {effortLoading ? (
                <p className="py-8 text-center text-sm text-[#7D8A96]">
                  Cargando...
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
                    Preguntas realizadas
                  </p>
                  <p className="mt-1 text-4xl font-black text-[#141514]">
                    {effort?.totals.questions ?? 0}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[#8BA888]/10 p-2">
                      <p className="text-lg font-black text-[#5f7d5c]">
                        {effort?.totals.correct ?? 0}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-[#7D8A96]">
                        Aciertos
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#C4655A]/10 p-2">
                      <p className="text-lg font-black text-[#C4655A]">
                        {effort?.totals.wrong ?? 0}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-[#7D8A96]">
                        Fallos
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#7D8A96]/10 p-2">
                      <p className="text-lg font-black text-[#7D8A96]">
                        {effort?.totals.blank ?? 0}
                      </p>
                      <p className="text-[10px] font-bold uppercase text-[#7D8A96]">
                        En blanco
                      </p>
                    </div>
                  </div>
                </>
              )}
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
                <div className="space-y-3">
                  {effort?.byMode.map((row) => {
                    const total = Math.max(1, row.questions)
                    const modeLabel =
                      MODE_OPTIONS.find((m) => m.value === row.mode)?.label ??
                      row.mode
                    return (
                      <div key={row.mode}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-semibold text-[#141514]">
                            {modeLabel}
                          </span>
                          <span className="text-[#7D8A96]">
                            {row.questions} preg.
                          </span>
                        </div>
                        <div className="flex h-3 overflow-hidden rounded-full bg-[#F0EAE6]">
                          <div
                            className="bg-[#8BA888]"
                            style={{ width: `${(row.correct / total) * 100}%` }}
                          />
                          <div
                            className="bg-[#C4655A]"
                            style={{ width: `${(row.wrong / total) * 100}%` }}
                          />
                          <div
                            className="bg-[#7D8A96]"
                            style={{ width: `${(row.blank / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
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
      </main>
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-[#EAE0D5] bg-white p-1 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            value === option.value
              ? 'bg-[#E8A598] text-white'
              : 'text-[#7D8A96] hover:text-[#141514]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
