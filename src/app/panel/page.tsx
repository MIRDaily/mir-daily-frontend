'use client'

import { useCallback, useMemo, useState } from 'react'
import ActivityHeatmapGrid from '@/components/ActivityHeatmapGrid'
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap'

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

export default function PanelPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const {
    data: activityHeatmapData,
    loading: activityHeatmapLoading,
    error: activityHeatmapError,
    refetch: refetchActivityHeatmap,
  } = useActivityHeatmap()
  const handleRetryActivityHeatmap = useCallback(() => {
    void refetchActivityHeatmap()
  }, [refetchActivityHeatmap])

  const visibleSubjects = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase()
    if (!normalized) return SUBJECTS
    return SUBJECTS.filter((subject) =>
      subject.name.toLowerCase().includes(normalized),
    )
  }, [searchTerm])

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
            <div className="inline-flex items-center gap-2 rounded-lg border border-[#EAE0D5] bg-white px-4 py-2 shadow-sm">
              <span className="material-symbols-outlined text-[#E8A598]">
                auto_awesome
              </span>
              <span className="text-sm font-bold text-[#7D8A96]">
                Prediccion IA Activa
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#EAE0D5] bg-white p-6 shadow-sm md:p-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
                      Aciertos promedio
                    </p>
                    <p className="mt-2 text-4xl font-black text-[#141514]">72%</p>
                    <p className="mt-1 text-sm font-bold text-[#8BA888]">
                      +5.2% tendencia
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
                      Preguntas contestadas
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#141514]">
                      25.432
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#7D8A96]">
                      Tiempo medio
                    </p>
                    <p className="mt-2 text-3xl font-black text-[#141514]">58s</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="inline-flex rounded-lg border border-[#EAE0D5] bg-white p-1">
                      <button
                        type="button"
                        className="rounded-md bg-[#E8A598] px-4 py-1.5 text-sm font-bold text-white"
                      >
                        Daily Diario
                      </button>
                      <button
                        type="button"
                        className="px-4 py-1.5 text-sm font-medium text-[#7D8A96]"
                      >
                        Preguntas
                      </button>
                    </div>
                    <div className="hidden gap-3 text-xs sm:flex">
                      <span className="font-medium text-[#8BA888]">● Aciertos</span>
                      <span className="font-medium text-[#C4655A]">● Fallos</span>
                      <span className="font-medium text-[#7D8A96]">● Blancas</span>
                    </div>
                  </div>
                  <svg
                    className="h-[220px] w-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 800 250"
                  >
                    <line stroke="#ECE7E2" strokeWidth="1" x1="0" x2="800" y1="200" y2="200" />
                    <line stroke="#ECE7E2" strokeWidth="1" x1="0" x2="800" y1="150" y2="150" />
                    <line stroke="#ECE7E2" strokeWidth="1" x1="0" x2="800" y1="100" y2="100" />
                    <line stroke="#ECE7E2" strokeWidth="1" x1="0" x2="800" y1="50" y2="50" />
                    <path
                      d="M0,160 C100,150 200,100 400,90 S600,60 800,50"
                      fill="none"
                      stroke="#8BA888"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                    <path
                      d="M0,190 C150,200 300,180 500,160 S700,165 800,170"
                      fill="none"
                      stroke="#C4655A"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                    <path
                      d="M0,220 C200,230 400,210 600,225 S750,220 800,220"
                      fill="none"
                      stroke="#7D8A96"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
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
