import type { GuideQuestion } from '@/types/studyGuide'
import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { RECENT_WINDOW, formatAvg, formatForecast } from '@/lib/studyGuides/stats'
import { QUESTION_KIND_STYLES, TIER_STYLES, TREND_STYLES, cssVars } from '@/components/library/guide/guideStyles'
import GuideReveal from '@/components/library/guide/GuideReveal'

type GuideTopicCardProps = {
  topic: GuideTopicWithStats
  years: number[]
  maxYearCount: number
  targetExam: string
  questions: GuideQuestion[]
  lastExamLabel: string
  defaultOpen?: boolean
}

export default function GuideTopicCard({
  topic,
  years,
  maxYearCount,
  targetExam,
  questions,
  lastExamLabel,
  defaultOpen,
}: GuideTopicCardProps) {
  const tier = TIER_STYLES[topic.tier]
  const { stats } = topic
  const trend = TREND_STYLES[stats.trend]

  return (
    <details
      id={`tema-${topic.id}`}
      open={defaultOpen}
      className="guia-details group scroll-mt-24 rounded-2xl border border-[#EAE4E2] bg-white shadow-sm open:shadow-md"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-3 p-5 [&::-webkit-details-marker]:hidden">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
          style={{ backgroundColor: tier.color }}
        >
          {topic.code}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg leading-tight font-bold text-[#2C3E50]">{topic.name}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-[#7D8A96]">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tier.chip}`}>{tier.label}</span>
            <span>
              <strong className="text-[#2C3E50]">{stats.historyCount}</strong> preguntas en {years.length - 1} años · últimos {RECENT_WINDOW}{' '}
              MIR: <strong className="text-[#2C3E50]">{formatAvg(stats.recentAvg)}/año</strong>
            </span>
          </span>
        </span>

        <span className="flex items-center gap-2">
          <LastExamBadge topic={topic} lastExamLabel={lastExamLabel} />
          <span className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:flex ${trend.chip}`}>
            <span className="material-symbols-outlined text-[15px]">{trend.icon}</span>
            {trend.label}
          </span>
          <span className="material-symbols-outlined text-[#7D8A96] transition-transform group-open:rotate-180">expand_more</span>
        </span>
      </summary>

      <div className="flex flex-col gap-6 border-t border-[#EAE4E2] p-5 pt-5">
        <p className="text-sm leading-relaxed text-[#2C3E50]">{topic.focus}</p>

        <TopicTimeline topic={topic} years={years} maxYearCount={maxYearCount} targetExam={targetExam} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-bold tracking-wider text-[#7D8A96] uppercase">Dónde se concentran las preguntas</h4>
            <ul className="flex flex-col gap-2">
              {topic.hotspots.map((hotspot) => (
                <li key={hotspot.name} className="flex items-start gap-3 rounded-xl bg-[#F9F8F7] px-3 py-2.5">
                  <span className="flex shrink-0 pt-0.5" aria-label={`Frecuencia ${hotspot.heat} de 3`}>
                    {[1, 2, 3].map((level) => (
                      <span
                        key={level}
                        className={`material-symbols-outlined text-[18px] ${level <= hotspot.heat ? 'text-[#E8A598]' : 'text-[#E3DCD9]'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        local_fire_department
                      </span>
                    ))}
                  </span>
                  <span className="text-sm leading-snug text-[#2C3E50]">{hotspot.name}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h4 className="text-xs font-bold tracking-wider text-[#7D8A96] uppercase">Lo que tienes que saber</h4>
            <ul className="flex flex-col gap-2.5">
              {topic.keys.map((key) => (
                <li key={key} className="flex gap-2.5 text-sm leading-relaxed text-[#2C3E50]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
                  <span>{key}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {topic.trap ? (
          <div className="flex gap-3 rounded-xl border border-[#D9B26F]/40 bg-[#D9B26F]/10 p-4">
            <span className="material-symbols-outlined text-[#946C2C]">lightbulb</span>
            <p className="text-sm leading-relaxed text-[#2C3E50]">
              <strong className="text-[#946C2C]">Ojo en el examen: </strong>
              {topic.trap}
            </p>
          </div>
        ) : null}

        {questions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wider text-[#7D8A96] uppercase">En el {lastExamLabel}:</span>
            {questions.map((question) => (
              <a
                key={question.number}
                href={`#pregunta-${question.number}`}
                className="flex items-center gap-1.5 rounded-full border border-[#EAE4E2] bg-white px-3 py-1 text-xs font-semibold text-[#2C3E50] transition-colors hover:border-[#E8A598] hover:text-[#B5655A]"
              >
                P{question.number}
                {question.kind !== 'bloque' ? (
                  <span className="font-normal text-[#7D8A96]">· {QUESTION_KIND_STYLES[question.kind].label.toLowerCase()}</span>
                ) : null}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function TopicTimeline({
  topic,
  years,
  maxYearCount,
  targetExam,
}: {
  topic: GuideTopicWithStats
  years: number[]
  maxYearCount: number
  targetExam: string
}) {
  const { stats } = topic
  const trend = TREND_STYLES[stats.trend]
  const recentStart = years.length - RECENT_WINDOW
  const scale = Math.max(maxYearCount, 1)

  return (
    <GuideReveal className="grid grid-cols-1 gap-5 rounded-2xl bg-[#F9F8F7] p-4 md:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold tracking-wider text-[#7D8A96] uppercase">Evolución en el MIR</h4>
        <div className="relative flex h-28 items-end gap-1 sm:gap-1.5">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 rounded-lg border-2 border-dashed border-[#2C3E50]/15 bg-white/70"
            style={{ left: `calc(${(recentStart / years.length) * 100}% - 3px)` }}
            aria-hidden
          />
          {topic.perYear.map((count, index) => {
            const isRecent = index >= recentStart
            const isLast = index === years.length - 1
            return (
              <div key={years[index]} className="relative flex h-full flex-1 flex-col items-center justify-end gap-0.5">
                <span style={cssVars({ '--i': index })} className={`guia-fade text-[10px] font-bold ${count === 0 ? 'text-[#7D8A96]/50' : 'text-[#2C3E50]/80'}`}>{count}</span>
                <div
                  className={`guia-grow-y w-full rounded-t ${isLast ? 'bg-[#2C3E50]' : isRecent ? 'bg-[#E8A598]' : 'bg-[#2C3E50]/15'}`}
                  style={{ height: count === 0 ? '2px' : `${(count / scale) * 78}%`, ...cssVars({ '--i': index }) }}
                  title={`MIR ${years[index]}: ${count}`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 sm:gap-1.5">
          {years.map((year, index) => (
            <span
              key={year}
              className={`flex-1 text-center text-[10px] ${index >= recentStart ? 'font-bold text-[#2C3E50]' : 'text-[#7D8A96]'}`}
            >
              {`'${String(year).slice(2)}`}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wider text-[#7D8A96] uppercase">Últimos {RECENT_WINDOW} MIR</span>
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trend.chip}`}>
            <span className="material-symbols-outlined text-[15px]">{trend.icon}</span>
            {trend.label}
          </span>
        </div>
        <p className="leading-snug text-[#2C3E50]">
          <strong>{stats.recentCount}</strong> {stats.recentCount === 1 ? 'pregunta' : 'preguntas'} ·{' '}
          <strong>{formatAvg(stats.recentAvg)}</strong>/año
          <span className="text-[#7D8A96]"> (antes {formatAvg(stats.earlierAvg)}/año)</span>
        </p>
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            {topic.perYear.slice(-RECENT_WINDOW).map((count, index) => (
              <span key={index} style={cssVars({ '--i': index * 3 + 12 })} className={`guia-pop h-3 w-3 rounded-full ${count > 0 ? 'bg-[#E8A598]' : 'border-2 border-[#D5CFCB]'}`} />
            ))}
          </span>
          <span className="text-xs">
            cayó en <strong className="text-[#2C3E50]">{stats.recentHits} de {RECENT_WINDOW}</strong>
          </span>
        </div>
        <div className="mt-auto flex items-baseline justify-between rounded-xl bg-white px-3 py-2">
          <span className="text-xs">Previsión {targetExam}</span>
          <span className="text-xl font-black text-[#2C3E50]">{formatForecast(stats.forecast)}</span>
        </div>
      </div>
    </GuideReveal>
  )
}

function LastExamBadge({ topic, lastExamLabel }: { topic: GuideTopicWithStats; lastExamLabel: string }) {
  if (topic.stats.lastExamCount === 0 && topic.lastExamReserve === 0) {
    const isSurprise = topic.stats.historyCount >= 10 && topic.stats.trend !== 'baja'
    return (
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isSurprise ? 'bg-[#E8A598]/15 text-[#B5655A]' : 'bg-[#F2EFED] text-[#7D8A96]'}`}
        title={isSurprise ? 'Suele caer y no cayó: candidato a volver' : undefined}
      >
        {lastExamLabel}: 0{isSurprise ? ' · ¡ojo!' : ''}
      </span>
    )
  }

  return (
    <span className="rounded-full bg-[#2C3E50] px-2.5 py-1 text-[11px] font-semibold text-white">
      {lastExamLabel}: {topic.stats.lastExamCount}
      {topic.lastExamReserve > 0 ? ` + ${topic.lastExamReserve}R` : ''}
    </span>
  )
}
