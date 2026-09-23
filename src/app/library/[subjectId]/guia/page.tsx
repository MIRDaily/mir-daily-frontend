import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import GuideEffortMatrix from '@/components/library/guide/GuideEffortMatrix'
import GuideHeatmap from '@/components/library/guide/GuideHeatmap'
import GuidePriorityMap from '@/components/library/guide/GuidePriorityMap'
import GuideQuestionCard from '@/components/library/guide/GuideQuestionCard'
import GuideTopicCard from '@/components/library/guide/GuideTopicCard'
import GuideTrendChart from '@/components/library/guide/GuideTrendChart'
import GuideTrendShift from '@/components/library/guide/GuideTrendShift'
import { TIER_STYLES } from '@/components/library/guide/guideStyles'
import { getStudyGuide } from '@/lib/studyGuides'
import { RECENT_WINDOW, withStats } from '@/lib/studyGuides/stats'
import type { GuideQuestionKind, GuideTier } from '@/types/studyGuide'

type LibraryGuidePageProps = {
  params: Promise<{ subjectId: string }>
}

const SECTIONS = [
  { id: 'tendencia', label: 'Tendencia' },
  { id: 'tendencias', label: 'Qué sube y qué baja' },
  { id: 'prioridades', label: 'Prioridades' },
  { id: 'evolucion', label: 'Evolución por tema' },
  { id: 'rentabilidad', label: 'Rentabilidad' },
  { id: 'plan', label: 'Plan de estudio' },
  { id: 'temas', label: 'Tema a tema' },
  { id: 'ultimo-mir', label: 'Último MIR comentado' },
]

const QUESTION_GROUPS: Array<{ kind: GuideQuestionKind; title: string; description: string }> = [
  { kind: 'bloque', title: 'Bloque de la asignatura', description: 'Las preguntas que el Ministerio agrupó en este bloque.' },
  { kind: 'reserva', title: 'Preguntas de reserva', description: 'Solo puntúan si se anula alguna, pero dicen qué tenía en mente el tribunal.' },
  {
    kind: 'frontera',
    title: 'También en otras asignaturas',
    description: 'Preguntas de otros bloques que se contestan con lo que estudias aquí.',
  },
]

export async function generateMetadata({ params }: LibraryGuidePageProps): Promise<Metadata> {
  const { subjectId } = await params
  const guide = getStudyGuide(subjectId)
  return { title: guide ? `Guía de estudio · ${guide.title} | MIRDaily` : 'Guía de estudio | MIRDaily' }
}

export default async function LibraryGuidePage({ params }: LibraryGuidePageProps) {
  const { subjectId } = await params
  const guide = getStudyGuide(subjectId)

  if (!guide) {
    notFound()
  }

  const history = guide.perYear.filter((item) => item.year !== guide.perYear.at(-1)?.year)
  const lastYear = guide.perYear.at(-1)?.year ?? 0
  const average = history.reduce((acc, item) => acc + item.count, 0) / history.length
  const years = guide.perYear.map((item) => item.year)
  const topics = withStats(guide.topics)
  const topicsByPriority = [...topics].sort((a, b) => b.stats.historyCount - a.stats.historyCount)
  const topicsByForecast = [...topics].sort(
    (a, b) => b.stats.forecast - a.stats.forecast || b.stats.historyCount - a.stats.historyCount,
  )
  const maxTopicYearCount = Math.max(...topics.flatMap((topic) => topic.perYear))
  const earlierLabel = `${years[0]}–${years[years.length - RECENT_WINDOW - 1]}`
  const recentLabel = `${years[years.length - RECENT_WINDOW]}–${lastYear}`
  const topicsById = Object.fromEntries(topics.map((topic) => [topic.id, topic]))
  const minCount = Math.min(...history.map((item) => item.count))
  const maxYearCount = Math.max(...history.map((item) => item.count))
  const planDays = guide.plan.reduce((acc, step) => acc + step.days, 0)
  const topThree = topicsByPriority.slice(0, 3)
  const topThreeShare = Math.round(
    (topThree.reduce((acc, topic) => acc + topic.stats.historyCount, 0) /
      topics.reduce((acc, topic) => acc + topic.stats.historyCount, 0)) *
      100,
  )

  return (
    <main className="min-h-screen bg-[#FAF7F4] px-4 py-8 text-[#7D8A96] sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        {/* Cabecera */}
        <section className="relative overflow-hidden rounded-3xl border border-[#EAE4E2] bg-white p-6 shadow-sm sm:p-8">
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#E8A598]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#8BA888]/10 blur-3xl" />

          <div className="relative flex flex-col gap-6">
            <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#E8A598]">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <Link href={`/library/${guide.subjectId}`} className="hover:text-[#d18d80]">
                Volver a {guide.title.split(' ')[0]}
              </Link>
            </nav>

            <div className="flex flex-col gap-3">
              <span className="w-fit rounded-full bg-[#2C3E50] px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
                Guía de estudio · {guide.targetExam}
              </span>
              <h1 className="text-3xl font-black tracking-tight text-[#2C3E50] sm:text-4xl">{guide.title}</h1>
              <p className="max-w-2xl text-base sm:text-lg">
                {guide.subtitle}. Basada en {guide.historyRange} e incluye todas las preguntas del {guide.lastExam}.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile value={average.toLocaleString('es-ES', { maximumFractionDigits: 0 })} label={`preguntas por año de media (${guide.historyRange})`} />
              <StatTile
                value={`${guide.lastExamTotal}+${guide.lastExamReserveTotal}`}
                label={`en el ${guide.lastExam} (bloque + reserva)`}
                accent
              />
              <StatTile value={`${topThreeShare}%`} label={`de las preguntas salen de ${topThree.map((topic) => topic.shortName).join(', ')}`} />
              <StatTile value={`1 de ${Math.round(210 / average)}`} label="preguntas del MIR es de esta asignatura" />
            </div>

            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-full border border-[#EAE4E2] bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[#2C3E50] transition-colors hover:border-[#E8A598] hover:text-[#B5655A]"
                >
                  {section.label}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Lecciones del último MIR */}
        <section className="flex flex-col gap-4">
          <SectionHeading icon="insights" title={`Qué nos dice el ${guide.lastExam}`} subtitle="Lo que cambia (y lo que no) de cara a tu examen." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {guide.insights.map((insight) => (
              <article key={insight.title} className="flex flex-col gap-2 rounded-2xl border border-[#EAE4E2] bg-white p-5">
                <span className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8A598]/15 text-[#B5655A]">
                  {insight.icon}
                </span>
                <h3 className="font-bold text-[#2C3E50]">{insight.title}</h3>
                <p className="text-sm leading-relaxed">{insight.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Tendencia + prioridades */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section id="tendencia" className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 sm:p-6">
            <SectionHeading icon="bar_chart" title="Preguntas por año" subtitle={`${guide.title}, ${guide.perYear[0]?.year}–${lastYear}.`} />
            <GuideTrendChart perYear={guide.perYear} average={average} highlightYear={lastYear} />
            <p className="text-sm leading-relaxed">
              Peso estable, entre {minCount} y {maxYearCount} preguntas al año.{' '}
              {guide.lastExamTotal < average ? (
                <>
                  El <strong className="text-[#2C3E50]">{guide.lastExam}</strong> se quedó por debajo de la media: lo normal es que el siguiente
                  vuelva a acercarse a ella.
                </>
              ) : null}
            </p>
          </section>

          <section id="tendencias" className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 sm:p-6">
            <SectionHeading
              icon="swap_vert"
              title="Qué sube y qué baja"
              subtitle={`Preguntas por año: ${earlierLabel} frente a los últimos ${RECENT_WINDOW} MIR (${recentLabel}).`}
            />
            <GuideTrendShift topics={topics} earlierLabel={earlierLabel} recentLabel={recentLabel} />
          </section>
        </div>

        {/* Prioridades */}
        <section id="prioridades" className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 sm:p-6">
          <SectionHeading
            icon="format_list_numbered"
            title="Mapa de prioridades"
            subtitle={`Ordenado por la previsión para el ${guide.targetExam}, que pesa más lo reciente. Pulsa un tema para ver su resumen.`}
          />
          <GuidePriorityMap topics={topicsByForecast} recentYears={years.slice(-RECENT_WINDOW)} targetExam={guide.targetExam} />
        </section>

        {/* Evolución por tema */}
        <section id="evolucion" className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 sm:p-6">
          <SectionHeading icon="grid_on" title="Evolución tema a tema" subtitle={`Preguntas de cada tema en cada MIR, ${years[0]}–${lastYear}.`} />
          <GuideHeatmap topics={topicsByForecast} years={years} />
        </section>

        {/* Rentabilidad + plan */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section id="rentabilidad" className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 sm:p-6">
            <SectionHeading icon="scatter_plot" title="Esfuerzo frente a recompensa" subtitle="Dónde rinde más cada hora de estudio." />
            <GuideEffortMatrix topics={topics} />
            <TierLegend />
          </section>

          <section id="plan" className="flex scroll-mt-24 flex-col gap-5 rounded-2xl border border-[#EAE4E2] bg-white p-5 sm:p-6">
            <SectionHeading icon="route" title={`Si tienes ${planDays} días para esta asignatura`} subtitle="Reparto por vueltas según el peso real de cada tema." />
            <ol className="flex flex-col gap-4">
              {guide.plan.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3 rounded-xl bg-[#F9F8F7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="font-bold text-[#2C3E50]">{step.title}</h3>
                      <p className="text-xs leading-relaxed">{step.subtitle}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#2C3E50]">
                      {step.days} {step.days === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${index === 0 ? 'bg-[#E8A598]' : index === 1 ? 'bg-[#8BA888]' : 'bg-[#BFC7CE]'}`}
                      style={{ width: `${(step.days / planDays) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {step.topicIds.map((topicId) => {
                      const topic = topicsById[topicId]
                      if (!topic) return null
                      return (
                        <a
                          key={topicId}
                          href={`#tema-${topicId}`}
                          className="rounded-full border border-[#EAE4E2] bg-white px-2.5 py-1 text-xs font-medium text-[#2C3E50] hover:border-[#E8A598]"
                        >
                          {topic.shortName}
                        </a>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Temas */}
        <section id="temas" className="flex scroll-mt-24 flex-col gap-4">
          <SectionHeading
            icon="menu_book"
            title="Tema a tema"
            subtitle="De más a menos preguntado (2015–2025). Cada tema dice dónde se concentran las preguntas y lo que hay que llevar sabido."
          />
          <div className="flex flex-col gap-3">
            {topicsByPriority.map((topic, index) => (
              <GuideTopicCard
                key={topic.id}
                topic={topic}
                years={years}
                maxYearCount={maxTopicYearCount}
                targetExam={guide.targetExam}
                lastExamLabel={guide.lastExam}
                questions={guide.questions.filter((question) => question.topicId === topic.id)}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        </section>

        {/* MIR 2026 */}
        <section id="ultimo-mir" className="flex scroll-mt-24 flex-col gap-8">
          <SectionHeading
            icon="quiz"
            title={`${guide.lastExam} comentado`}
            subtitle="Intenta contestarlas antes de mirar la respuesta. Las respuestas están razonadas por MIRDaily; no son la plantilla oficial."
          />
          {QUESTION_GROUPS.map((group) => {
            const questions = guide.questions.filter((question) => question.kind === group.kind)
            if (questions.length === 0) return null
            return (
              <div key={group.kind} className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-bold text-[#2C3E50]">
                    {group.title} <span className="text-[#7D8A96]">({questions.length})</span>
                  </h3>
                  <p className="text-sm">{group.description}</p>
                </div>
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  {questions.map((question) => (
                    <GuideQuestionCard key={question.number} question={question} lastExamLabel={guide.lastExam} />
                  ))}
                </div>
              </div>
            )
          })}
        </section>

        <p className="border-t border-[#EAE4E2] pt-6 text-xs leading-relaxed">{guide.sourcesNote}</p>
      </div>
    </main>
  )
}

function StatTile({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 rounded-2xl p-4 ${accent ? 'bg-[#E8A598]/15' : 'bg-[#F9F8F7]'}`}>
      <span className={`text-2xl font-black sm:text-3xl ${accent ? 'text-[#B5655A]' : 'text-[#2C3E50]'}`}>{value}</span>
      <span className="text-xs leading-snug">{label}</span>
    </div>
  )
}

function SectionHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined mt-0.5 text-[#E8A598]">{icon}</span>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-bold text-[#2C3E50]">{title}</h2>
        <p className="text-sm">{subtitle}</p>
      </div>
    </div>
  )
}

function TierLegend() {
  const tiers: GuideTier[] = ['imprescindible', 'alta', 'media', 'baja']
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {tiers.map((tier) => (
        <span key={tier} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TIER_STYLES[tier].color }} />
          {TIER_STYLES[tier].label}
        </span>
      ))}
    </div>
  )
}
