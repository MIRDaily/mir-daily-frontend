import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { formatAvg } from '@/lib/studyGuides/stats'
import { TREND_STYLES, cssVars } from '@/components/library/guide/guideStyles'
import GuideReveal from '@/components/library/guide/GuideReveal'

type GuideTrendShiftProps = {
  topics: GuideTopicWithStats[]
  earlierLabel: string
  recentLabel: string
  /** Temas con menos preguntas que esto en ambos periodos no se muestran (ruido) */
  minAvg?: number
}

// Gráfico "antes → ahora": media anual del periodo anterior frente a la de los últimos MIR.
export default function GuideTrendShift({ topics, earlierLabel, recentLabel, minAvg = 0.5 }: GuideTrendShiftProps) {
  const rows = topics
    .filter((topic) => topic.stats.recentAvg >= minAvg || topic.stats.earlierAvg >= minAvg)
    .sort((a, b) => b.stats.recentAvg - b.stats.earlierAvg - (a.stats.recentAvg - a.stats.earlierAvg))
  const max = Math.ceil(Math.max(...rows.flatMap((topic) => [topic.stats.recentAvg, topic.stats.earlierAvg]), 1))
  const pct = (value: number) => `${(value / max) * 100}%`

  return (
    <GuideReveal className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {rows.map((topic, index) => {
          const { earlierAvg, recentAvg, trend } = topic.stats
          const low = Math.min(earlierAvg, recentAvg)
          const high = Math.max(earlierAvg, recentAvg)
          const lineColor = trend === 'sube' ? 'bg-[#E8A598]' : trend === 'baja' ? 'bg-[#8FA9C2]' : 'bg-[#D5CFCB]'
          return (
            <li key={topic.id}>
              <a href={`#tema-${topic.id}`} className="grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_5.5rem]">
                <span className="truncate text-xs font-semibold text-[#2C3E50] sm:text-sm">{topic.shortName}</span>
                <span className="relative h-5">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#EAE4E2]" />
                  <span
                    className={`guia-grow-x absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${lineColor}`}
                    style={{
                      left: pct(low),
                      width: `calc(${pct(high)} - ${pct(low)})`,
                      ...cssVars({ '--i': index + 4 }),
                      transformOrigin: recentAvg >= earlierAvg ? 'left' : 'right',
                    }}
                  />
                  <span
                    className="guia-pop absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#BFC7CE]"
                    style={{ left: pct(earlierAvg), ...cssVars({ '--i': index * 4 }) }}
                    title={`${earlierLabel}: ${formatAvg(earlierAvg)}/año`}
                  />
                  <span
                    className="guia-slide absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2C3E50] shadow transition-transform hover:scale-125"
                    style={cssVars({ '--from': pct(earlierAvg), '--to': pct(recentAvg), '--i': index })}
                    title={`${recentLabel}: ${formatAvg(recentAvg)}/año`}
                  />
                </span>
                <span className={`flex items-center justify-end gap-0.5 text-xs font-bold ${TREND_STYLES[trend].chip} rounded-full px-2 py-0.5`}>
                  <span className="material-symbols-outlined text-[14px]">{TREND_STYLES[trend].icon}</span>
                  {formatAvg(recentAvg)}
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] gap-3 text-[10px] text-[#7D8A96] sm:grid-cols-[8rem_minmax(0,1fr)_5.5rem]">
        <span />
        <span className="flex justify-between">
          {Array.from({ length: max + 1 }, (_, value) => (
            <span key={value}>{value}</span>
          ))}
        </span>
        <span className="text-right">preg./año</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#7D8A96]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#BFC7CE]" /> {earlierLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full bg-[#2C3E50]" /> {recentLabel}
        </span>
      </div>
    </GuideReveal>
  )
}
