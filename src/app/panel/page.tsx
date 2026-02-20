'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ActivityHeatmapGrid from '@/components/ActivityHeatmapGrid'
import ProgressChart from '@/components/ProgressChart'
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap'
import { useTimeSeries } from '@/hooks/useTimeSeries'

type SubjectCard = {
  name: string
  score: number
  tone: 'good' | 'mid' | 'bad'
}

const SUBJECTS: SubjectCard[] = [
  { name: 'Pediatria', score: 88, tone: 'good' },
  { name: 'Neumologia', score: 82, tone: 'good' },
  { name: 'Cardiologia', score: 78, tone: 'good' },
  { name: 'Infecciosas', score: 72, tone: 'mid' },
  { name: 'Endocrino', score: 71, tone: 'mid' },
  { name: 'Digestivo', score: 58, tone: 'bad' },
  { name: 'Nefrologia', score: 55, tone: 'bad' },
  { name: 'Neurologia', score: 45, tone: 'bad' },
]

function cardTone(tone: SubjectCard['tone']): string {
  if (tone === 'good') return 'bg-[#8BA888]'
  if (tone === 'mid') return 'bg-[#7D8A96]'
  return 'bg-[#C4655A]'
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
  const [searchTerm, setSearchTerm] = useState('')
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

  const visibleSubjects = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) return SUBJECTS
    return SUBJECTS.filter((subject) =>
      subject.name.toLowerCase().includes(normalized),
    )
  }, [searchTerm])

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
                    title="Preguntas contestadas"
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
              Mapa de Calor Global de Asignaturas
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

          <div className="rounded-2xl border border-[#EAE0D5] bg-white p-5 shadow-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {visibleSubjects.map((subject) => (
                <article
                  key={subject.name}
                  className={`rounded-lg p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${cardTone(subject.tone)}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                    {subject.name}
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {subject.score}%
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 pb-8">
          <h3 className="text-2xl font-bold text-[#141514]">Comparativa Global</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {SUBJECTS.slice(0, 5).map((subject) => {
              const incorrect = Math.max(8, 100 - subject.score - 10)
              const blank = 100 - subject.score - incorrect
              return (
                <article
                  key={`bar-${subject.name}`}
                  className="rounded-xl border border-[#EAE0D5] bg-white p-5 shadow-sm"
                >
                  <p className="text-center text-sm font-bold text-[#141514]">
                    {subject.name}
                  </p>
                  <div className="mt-4 flex h-32 items-end justify-center gap-2 rounded-lg bg-[#FAF7F4] p-2">
                    <div
                      className="w-3 rounded-t-sm bg-[#8BA888]"
                      style={{ height: `${subject.score}%` }}
                    />
                    <div
                      className="w-3 rounded-t-sm bg-[#C4655A]"
                      style={{ height: `${incorrect}%` }}
                    />
                    <div
                      className="w-3 rounded-t-sm bg-[#7D8A96]"
                      style={{ height: `${Math.max(4, blank)}%` }}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
