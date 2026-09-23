import type { GuideQuestion, GuideTopic } from '@/types/studyGuide'
import { QUESTION_KIND_STYLES, TIER_STYLES } from '@/components/library/guide/guideStyles'

type GuideTopicCardProps = {
  topic: GuideTopic
  maxCount: number
  questions: GuideQuestion[]
  lastExamLabel: string
  defaultOpen?: boolean
}

export default function GuideTopicCard({ topic, maxCount, questions, lastExamLabel, defaultOpen }: GuideTopicCardProps) {
  const tier = TIER_STYLES[topic.tier]
  const perYear = topic.historyCount / 11

  return (
    <details
      id={`tema-${topic.id}`}
      open={defaultOpen}
      className="group scroll-mt-24 rounded-2xl border border-[#EAE4E2] bg-white shadow-sm open:shadow-md"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-3 p-5 [&::-webkit-details-marker]:hidden">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
          style={{ backgroundColor: tier.color }}
        >
          T{topic.number}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg leading-tight font-bold text-[#2C3E50]">{topic.name}</span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-[#7D8A96]">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tier.chip}`}>{tier.label}</span>
            <span>
              <strong className="text-[#2C3E50]">{topic.historyCount}</strong> preguntas en 11 años ·{' '}
              {perYear.toLocaleString('es-ES', { maximumFractionDigits: 1 })}/año
            </span>
          </span>
        </span>

        <span className="flex items-center gap-3">
          <LastExamBadge topic={topic} lastExamLabel={lastExamLabel} />
          <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-[#F2EFED] sm:block">
            <span className={`block h-full rounded-full ${tier.bar}`} style={{ width: `${Math.max(3, (topic.historyCount / maxCount) * 100)}%` }} />
          </span>
          <span className="material-symbols-outlined text-[#7D8A96] transition-transform group-open:rotate-180">expand_more</span>
        </span>
      </summary>

      <div className="flex flex-col gap-6 border-t border-[#EAE4E2] p-5 pt-5">
        <p className="text-sm leading-relaxed text-[#2C3E50]">{topic.focus}</p>

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

function LastExamBadge({ topic, lastExamLabel }: { topic: GuideTopic; lastExamLabel: string }) {
  if (topic.lastExamCount === 0 && topic.lastExamReserve === 0) {
    const isSurprise = topic.historyCount >= 10
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
      {lastExamLabel}: {topic.lastExamCount}
      {topic.lastExamReserve > 0 ? ` + ${topic.lastExamReserve}R` : ''}
    </span>
  )
}
