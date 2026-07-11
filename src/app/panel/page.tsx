'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ActivityHeatmapGrid from '@/components/ActivityHeatmapGrid'
import ProgressChart from '@/components/ProgressChart'
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap'
import { useTimeSeries } from '@/hooks/useTimeSeries'
import EffortSection from '@/components/panel/EffortSection'
import SubjectHeatmapSection from '@/components/panel/SubjectHeatmapSection'
import WeakPointsSection from '@/components/panel/WeakPointsSection'
import { debugRender } from '@/lib/debugRSC'

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

  const [introPhase, setIntroPhase] = useState<IntroPhase>('idle')
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
      <main className="mx-auto w-full max-w-[1280px] space-y-10 px-4 py-8 md:px-6">
        {/* ===== PROGRESO GLOBAL (no tocar) ===== */}
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

        {/* ===== TU ESFUERZO (encima del heatmap) ===== */}
        <EffortSection />

        {/* ===== MAPA DE CALOR + DETALLE POR ASIGNATURA ===== */}
        <SubjectHeatmapSection />

        {/* ===== PUNTOS DÉBILES ===== */}
        <div className="pb-8">
          <WeakPointsSection />
        </div>
      </main>
    </div>
  )
}
