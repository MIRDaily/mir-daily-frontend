import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { RECENT_WINDOW, formatForecast } from '@/lib/studyGuides/stats'
import { TIER_STYLES, TREND_STYLES, heatCellClass } from '@/components/library/guide/guideStyles'

type GuidePriorityMapProps = {
  /** Temas ya ordenados por previsión */
  topics: GuideTopicWithStats[]
  recentYears: number[]
  targetExam: string
}

export default function GuidePriorityMap({ topics, recentYears, targetExam }: GuidePriorityMapProps) {
  const max = Math.max(...topics.map((topic) => topic.stats.historyCount), 1)
  const total = topics.reduce((acc, topic) => acc + topic.stats.historyCount, 0)
  const shortYear = (year: number | undefined) => `'${String(year ?? '').slice(2)}`
  const recentRangeLabel = `${shortYear(recentYears[0])}–${shortYear(recentYears.at(-1))}`

  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_auto_6.5rem_4rem] items-end gap-4 border-b border-[#EAE4E2] pb-2 text-[11px] font-semibold tracking-wider text-[#7D8A96] uppercase md:grid">
        <span>#</span>
        <span>Tema</span>
        <span>2015–2025 · % asignatura</span>
        <span className="flex gap-1">
          {recentYears.map((year) => (
            <span key={year} className="w-6 text-center normal-case">{`'${String(year).slice(2)}`}</span>
          ))}
        </span>
        <span>Tendencia</span>
        <span className="text-right leading-tight">{targetExam}</span>
      </div>

      <ol className="flex flex-col">
        {topics.map((topic, index) => {
          const tier = TIER_STYLES[topic.tier]
          const trend = TREND_STYLES[topic.stats.trend]
          const share = Math.round((topic.stats.historyCount / total) * 100)
          const recent = topic.perYear.slice(-RECENT_WINDOW)
          return (
            <li key={topic.id} className="border-b border-[#EAE4E2]/70 last:border-b-0">
              <a
                href={`#tema-${topic.id}`}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl px-1 py-3 transition-colors hover:bg-[#F9F8F7] md:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_auto_6.5rem_4rem] md:gap-x-4"
              >
                <span className="text-sm font-black text-[#2C3E50]/40">{index + 1}</span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-semibold text-[#2C3E50]">{topic.shortName}</span>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tier.chip}`}>
                    {tier.label}
                  </span>
                </span>

                <span className="col-span-3 flex items-center gap-3 md:col-span-1 md:col-start-3 md:row-start-1">
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F2EFED]">
                    <span
                      className={`block h-full rounded-full ${tier.bar}`}
                      style={{ width: `${Math.max(2, (topic.stats.historyCount / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-14 shrink-0 text-right text-sm">
                    <strong className="text-[#2C3E50]">{topic.stats.historyCount}</strong>
                    <span className="text-xs text-[#7D8A96]"> · {share}%</span>
                  </span>
                </span>

                <span
                  className="col-span-2 flex gap-1 md:col-span-1 md:col-start-4 md:row-start-1"
                  aria-label={`Últimos ${RECENT_WINDOW} MIR: ${recent.join(', ')}`}
                >
                  <span className="mr-1 self-center text-[10px] text-[#7D8A96] md:hidden">{recentRangeLabel}</span>
                  {recent.map((count, cellIndex) => {
                    const isLast = cellIndex === recent.length - 1
                    return (
                      <span
                        key={cellIndex}
                        className={`relative flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${heatCellClass(count)} ${
                          isLast ? 'ring-2 ring-[#2C3E50]/70 ring-offset-1' : ''
                        }`}
                      >
                        {count}
                        {isLast && topic.lastExamReserve > 0 ? (
                          <span
                            className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#D9B26F] bg-white"
                            title="Pregunta de reserva"
                          />
                        ) : null}
                      </span>
                    )
                  })}
                </span>

                <span className="flex md:col-start-5 md:row-start-1">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trend.chip}`}>
                    <span className="material-symbols-outlined text-[15px]">{trend.icon}</span>
                    {trend.label}
                  </span>
                </span>

                <span className="col-start-3 row-start-1 flex flex-col items-end md:col-start-6">
                  <span className="text-lg leading-none font-black text-[#2C3E50]">{formatForecast(topic.stats.forecast)}</span>
                  <span className="text-[10px] text-[#7D8A96] md:hidden">{targetExam}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7D8A96]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded ring-2 ring-[#2C3E50]/70 ring-offset-1" /> último MIR
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-[#D9B26F]" /> + pregunta de reserva
        </span>
        <span>
          {targetExam}: previsión orientativa de preguntas (pesa un 70 % lo de los últimos {RECENT_WINDOW} MIR).
        </span>
      </div>
    </div>
  )
}
