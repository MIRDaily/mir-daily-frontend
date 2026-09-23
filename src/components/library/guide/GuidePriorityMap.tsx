import type { GuideTopic } from '@/types/studyGuide'
import { TIER_STYLES } from '@/components/library/guide/guideStyles'

type GuidePriorityMapProps = {
  topics: GuideTopic[]
  lastExamLabel: string
}

export default function GuidePriorityMap({ topics, lastExamLabel }: GuidePriorityMapProps) {
  const sorted = [...topics].sort((a, b) => b.historyCount - a.historyCount)
  const max = sorted[0]?.historyCount ?? 1
  const total = topics.reduce((acc, topic) => acc + topic.historyCount, 0)

  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[2rem_minmax(0,14rem)_minmax(0,1fr)_6.5rem] items-center gap-4 border-b border-[#EAE4E2] pb-2 text-[11px] font-semibold tracking-wider text-[#7D8A96] uppercase md:grid">
        <span>#</span>
        <span>Tema</span>
        <span>Preguntas 2015–2025 · % de la asignatura</span>
        <span className="text-right">{lastExamLabel}</span>
      </div>

      <ol className="flex flex-col">
        {sorted.map((topic, index) => {
          const tier = TIER_STYLES[topic.tier]
          const share = Math.round((topic.historyCount / total) * 100)
          return (
            <li key={topic.id} className="border-b border-[#EAE4E2]/70 last:border-b-0">
              <a
                href={`#tema-${topic.id}`}
                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-1 py-3 transition-colors hover:bg-[#F9F8F7] md:grid-cols-[2rem_minmax(0,14rem)_minmax(0,1fr)_6.5rem]"
              >
                <span className="text-sm font-black text-[#2C3E50]/40">{index + 1}</span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-semibold text-[#2C3E50]">{topic.shortName}</span>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tier.chip}`}>
                    {tier.label}
                  </span>
                </span>

                <span className="col-span-3 flex items-center gap-3 md:col-span-1 md:row-start-1 md:col-start-3">
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#F2EFED]">
                    <span
                      className={`block h-full rounded-full ${tier.bar}`}
                      style={{ width: `${Math.max(2, (topic.historyCount / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm">
                    <strong className="text-[#2C3E50]">{topic.historyCount}</strong>
                    <span className="text-xs text-[#7D8A96]"> · {share}%</span>
                  </span>
                </span>

                <span className="col-start-3 row-start-1 flex items-center justify-end gap-1 md:col-start-4">
                  <LastExamDots count={topic.lastExamCount} reserve={topic.lastExamReserve} />
                </span>
              </a>
            </li>
          )
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7D8A96]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#E8A598]" /> pregunta en el {lastExamLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-[#D9B26F]" /> pregunta de reserva
        </span>
      </div>
    </div>
  )
}

function LastExamDots({ count, reserve }: { count: number; reserve: number }) {
  if (count === 0 && reserve === 0) {
    return <span className="text-xs font-semibold text-[#7D8A96]/70">—</span>
  }

  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span key={`q-${index}`} className="h-3 w-3 rounded-full bg-[#E8A598]" />
      ))}
      {Array.from({ length: reserve }, (_, index) => (
        <span key={`r-${index}`} className="h-3 w-3 rounded-full border-2 border-[#D9B26F]" />
      ))}
    </>
  )
}
