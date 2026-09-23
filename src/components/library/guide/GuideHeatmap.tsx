import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { RECENT_WINDOW } from '@/lib/studyGuides/stats'
import { heatCellClass } from '@/components/library/guide/guideStyles'

type GuideHeatmapProps = {
  topics: GuideTopicWithStats[]
  years: number[]
}

export default function GuideHeatmap({ topics, years }: GuideHeatmapProps) {
  const recentStart = years.length - RECENT_WINDOW
  const columns = `minmax(7.5rem,11rem) repeat(${years.length}, minmax(1.75rem,1fr)) 2.75rem`

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="min-w-[560px]">
          <div className="grid items-end gap-1 pb-2" style={{ gridTemplateColumns: columns }}>
            <span />
            {years.map((year, index) => (
              <span
                key={year}
                className={`text-center text-[11px] ${index >= recentStart ? 'font-bold text-[#2C3E50]' : 'text-[#7D8A96]'}`}
              >
                {`'${String(year).slice(2)}`}
              </span>
            ))}
            <span className="text-right text-[10px] font-semibold tracking-wide text-[#7D8A96] uppercase">Total</span>
          </div>

          <div className="relative">
            {/* Banda de los últimos MIR */}
            <div className="pointer-events-none absolute inset-y-0 grid w-full gap-1" style={{ gridTemplateColumns: columns }} aria-hidden>
              <span
                className="-mx-0.5 rounded-lg border-2 border-dashed border-[#2C3E50]/20 bg-[#2C3E50]/[0.03]"
                style={{ gridColumn: `${recentStart + 2} / ${years.length + 2}` }}
              />
            </div>

            <div className="relative flex flex-col gap-1 py-1">
              {topics.map((topic) => (
                <a
                  key={topic.id}
                  href={`#tema-${topic.id}`}
                  className="group grid items-center gap-1 rounded-lg"
                  style={{ gridTemplateColumns: columns }}
                >
                  <span className="truncate pr-2 text-xs font-semibold text-[#2C3E50] group-hover:text-[#B5655A]">{topic.shortName}</span>
                  {topic.perYear.map((count, index) => (
                    <span
                      key={years[index]}
                      title={`${topic.shortName} · MIR ${years[index]}: ${count}`}
                      className={`flex h-7 items-center justify-center rounded-md text-[11px] font-bold ${heatCellClass(count)}`}
                    >
                      {count}
                    </span>
                  ))}
                  <span className="text-right text-xs font-bold text-[#2C3E50]">
                    {topic.perYear.reduce((acc, count) => acc + count, 0)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#7D8A96]">
        <span className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map((count) => (
            <span key={count} className={`h-3.5 w-3.5 rounded ${heatCellClass(count)}`} />
          ))}
          <span className="ml-1">0 → 4+ preguntas</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded border-2 border-dashed border-[#2C3E50]/25" /> últimos {RECENT_WINDOW} MIR
        </span>
      </div>
    </div>
  )
}
