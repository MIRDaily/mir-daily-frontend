'use client'

import { useMemo, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { RECENT_WINDOW, formatForecast } from '@/lib/studyGuides/stats'
import { TIER_STYLES, TREND_STYLES, cssVars, heatCellClass } from '@/components/library/guide/guideStyles'
import GuideReveal from '@/components/library/guide/GuideReveal'

type SortKey = 'prevision' | 'historico' | 'tendencia'

const SORT_OPTIONS: Array<{ key: SortKey; label: string; icon: string }> = [
  { key: 'prevision', label: 'Previsión', icon: 'online_prediction' },
  { key: 'historico', label: 'Histórico', icon: 'history' },
  { key: 'tendencia', label: 'Tendencia', icon: 'trending_up' },
]

function sortTopics(topics: GuideTopicWithStats[], key: SortKey) {
  const byHistory = (a: GuideTopicWithStats, b: GuideTopicWithStats) => b.stats.historyCount - a.stats.historyCount
  return [...topics].sort((a, b) => {
    if (key === 'historico') return byHistory(a, b)
    if (key === 'tendencia') {
      const shiftA = a.stats.recentAvg - a.stats.earlierAvg
      const shiftB = b.stats.recentAvg - b.stats.earlierAvg
      return shiftB - shiftA || byHistory(a, b)
    }
    return b.stats.forecast - a.stats.forecast || byHistory(a, b)
  })
}

type GuidePriorityMapProps = {
  topics: GuideTopicWithStats[]
  recentYears: number[]
  targetExam: string
}

export default function GuidePriorityMap({ topics, recentYears, targetExam }: GuidePriorityMapProps) {
  const [sortKey, setSortKey] = useState<SortKey>('prevision')
  const sorted = useMemo(() => sortTopics(topics, sortKey), [topics, sortKey])
  const max = Math.max(...topics.map((topic) => topic.stats.historyCount), 1)
  const total = topics.reduce((acc, topic) => acc + topic.stats.historyCount, 0)
  const shortYear = (year: number | undefined) => `'${String(year ?? '').slice(2)}`
  const recentRangeLabel = `${shortYear(recentYears[0])}–${shortYear(recentYears.at(-1))}`

  return (
    <GuideReveal className="flex flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#7D8A96]">Ordenar por</span>
        <div className="flex rounded-full bg-[#F2EFED] p-1" role="radiogroup" aria-label="Ordenar temas">
          {SORT_OPTIONS.map((option) => {
            const active = option.key === sortKey
            return (
              <button
                key={option.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSortKey(option.key)}
                className={`relative flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active ? 'text-white' : 'text-[#2C3E50] hover:text-[#B5655A]'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="guia-sort-pill"
                    className="absolute inset-0 rounded-full bg-[#2C3E50]"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="material-symbols-outlined relative text-[15px]">{option.icon}</span>
                <span className="relative">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="hidden grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_auto_6.5rem_4rem] items-end gap-4 border-b border-[#EAE4E2] pb-2 text-[11px] font-semibold tracking-wider text-[#7D8A96] uppercase md:grid">
        <span>#</span>
        <span>Tema</span>
        <span>2015–2025 · % asignatura</span>
        <span className="flex gap-1">
          {recentYears.map((year) => (
            <span key={year} className="w-6 text-center normal-case">
              {shortYear(year)}
            </span>
          ))}
        </span>
        <span>Tendencia</span>
        <span className="text-right leading-tight">{targetExam}</span>
      </div>

      <LayoutGroup>
        <ol className="flex flex-col">
          {sorted.map((topic, index) => {
            const tier = TIER_STYLES[topic.tier]
            const trend = TREND_STYLES[topic.stats.trend]
            const share = Math.round((topic.stats.historyCount / total) * 100)
            const recent = topic.perYear.slice(-RECENT_WINDOW)
            return (
              <motion.li
                key={topic.id}
                layout="position"
                transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                className="border-b border-[#EAE4E2]/70 last:border-b-0"
              >
                <a
                  href={`#tema-${topic.id}`}
                  className="guia-fade-up grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-xl px-1 py-3 hover:bg-[#F9F8F7] md:grid-cols-[1.5rem_minmax(0,10rem)_minmax(0,1fr)_auto_6.5rem_4rem] md:gap-x-4"
                  style={cssVars({ '--i': index })}
                >
                  <motion.span
                    key={`${sortKey}-${index}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-black text-[#2C3E50]/40"
                  >
                    {index + 1}
                  </motion.span>

                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-semibold text-[#2C3E50]">{topic.shortName}</span>
                    <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${tier.chip}`}>
                      {tier.label}
                    </span>
                  </span>

                  <span className="col-span-3 flex items-center gap-3 md:col-span-1 md:col-start-3 md:row-start-1">
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#F2EFED]">
                      <span
                        className={`guia-grow-x block h-full rounded-full ${tier.bar}`}
                        style={{ width: `${Math.max(2, (topic.stats.historyCount / max) * 100)}%`, ...cssVars({ '--i': index }) }}
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
                          className={`guia-pop relative flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${heatCellClass(count)} ${
                            isLast ? 'ring-2 ring-[#2C3E50]/70 ring-offset-1' : ''
                          }`}
                          style={cssVars({ '--i': index * 3 + cellIndex * 4 + 10 })}
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
              </motion.li>
            )
          })}
        </ol>
      </LayoutGroup>

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
    </GuideReveal>
  )
}
