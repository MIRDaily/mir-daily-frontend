'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { GuideTopicWithStats } from '@/lib/studyGuides/stats'
import { RECENT_WINDOW } from '@/lib/studyGuides/stats'
import { cssVars, heatCellClass } from '@/components/library/guide/guideStyles'
import GuideReveal from '@/components/library/guide/GuideReveal'
import GuideSortToggle, { sortGuideTopics, type GuideSortKey } from '@/components/library/guide/GuideSortToggle'

type GuideHeatmapProps = {
  topics: GuideTopicWithStats[]
  years: number[]
}

type Focus = { row: number | null; col: number | null }

export default function GuideHeatmap({ topics: unsortedTopics, years }: GuideHeatmapProps) {
  const [sortKey, setSortKey] = useState<GuideSortKey>('prevision')
  const topics = useMemo(() => sortGuideTopics(unsortedTopics, sortKey), [unsortedTopics, sortKey])
  const [focus, setFocus] = useState<Focus>({ row: null, col: null })
  const recentStart = years.length - RECENT_WINDOW
  const columns = `minmax(7.5rem,11rem) repeat(${years.length}, minmax(1.75rem,1fr)) 2.75rem`
  const hasFocus = focus.row !== null || focus.col !== null

  const isDimmed = (row: number, col: number) => {
    if (!hasFocus) return false
    if (focus.row !== null && focus.col !== null) return row !== focus.row && col !== focus.col
    if (focus.row !== null) return row !== focus.row
    return col !== focus.col
  }

  const focusedTopic = focus.row !== null ? topics[focus.row] : null
  const focusedYear = focus.col !== null ? years[focus.col] : null
  const yearTotal = focus.col !== null ? topics.reduce((acc, topic) => acc + (topic.perYear[focus.col as number] ?? 0), 0) : 0

  return (
    <div className="flex flex-col gap-4">
      <GuideSortToggle value={sortKey} onChange={setSortKey} />

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <GuideReveal className="min-w-[560px]">
          <div
            className="grid items-end gap-1 pb-2"
            style={{ gridTemplateColumns: columns }}
            onMouseLeave={() => setFocus({ row: null, col: null })}
          >
            <span />
            {years.map((year, index) => (
              <button
                key={year}
                type="button"
                onMouseEnter={() => setFocus({ row: null, col: index })}
                onFocus={() => setFocus({ row: null, col: index })}
                className={`rounded text-center text-[11px] transition-colors ${
                  focus.col === index
                    ? 'bg-[#2C3E50] font-bold text-white'
                    : index >= recentStart
                      ? 'font-bold text-[#2C3E50]'
                      : 'text-[#7D8A96]'
                }`}
              >
                {`'${String(year).slice(2)}`}
              </button>
            ))}
            <span className="text-right text-[10px] font-semibold tracking-wide text-[#7D8A96] uppercase">Total</span>
          </div>

          <div className="relative" onMouseLeave={() => setFocus({ row: null, col: null })}>
            {/* Banda de los últimos MIR */}
            <div className="pointer-events-none absolute inset-y-0 grid w-full gap-1" style={{ gridTemplateColumns: columns }} aria-hidden>
              <span
                className="guia-fade -mx-0.5 rounded-lg border-2 border-dashed border-[#2C3E50]/20 bg-[#2C3E50]/[0.03]"
                style={{ gridColumn: `${recentStart + 2} / ${years.length + 2}`, ...cssVars({ '--i': 6 }) }}
              />
            </div>

            <div className="relative flex flex-col gap-1 py-1">
              {topics.map((topic, row) => (
                <motion.a
                  key={topic.id}
                  layout="position"
                  transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  href={`#tema-${topic.id}`}
                  className="grid items-center gap-1 rounded-lg"
                  style={{ gridTemplateColumns: columns }}
                  onMouseEnter={() => setFocus((prev) => (prev.row === row ? prev : { row, col: null }))}
                >
                  <span
                    className={`truncate pr-2 text-xs font-semibold transition-colors ${
                      focus.row === row ? 'text-[#B5655A]' : hasFocus && focus.row !== null ? 'text-[#2C3E50]/40' : 'text-[#2C3E50]'
                    }`}
                  >
                    {topic.shortName}
                  </span>
                  {topic.perYear.map((count, col) => (
                    <span
                      key={years[col]}
                      onMouseEnter={() => setFocus({ row, col })}
                      className="guia-pop block"
                      style={cssVars({ '--i': row * 2 + col })}
                    >
                      <span
                        className={`flex h-7 items-center justify-center rounded-md text-[11px] font-bold transition-[opacity,transform,box-shadow] duration-200 ${heatCellClass(count)} ${
                          isDimmed(row, col) ? 'opacity-30' : ''
                        } ${focus.row === row && focus.col === col ? 'scale-110 shadow-md ring-2 ring-[#2C3E50]' : ''}`}
                      >
                        {count}
                      </span>
                    </span>
                  ))}
                  <span className={`text-right text-xs font-bold transition-colors ${focus.row === row ? 'text-[#B5655A]' : 'text-[#2C3E50]'}`}>
                    {topic.perYear.reduce((acc, count) => acc + count, 0)}
                  </span>
                </motion.a>
              ))}
            </div>
          </div>
        </GuideReveal>
      </div>

      <p className="min-h-5 text-sm text-[#2C3E50]" aria-live="polite">
        {focusedTopic && focusedYear !== null ? (
          <>
            <strong>{focusedTopic.shortName}</strong> en el MIR {focusedYear}:{' '}
            <strong className="text-[#B5655A]">{focusedTopic.perYear[focus.col as number]}</strong>{' '}
            {focusedTopic.perYear[focus.col as number] === 1 ? 'pregunta' : 'preguntas'}
          </>
        ) : focusedTopic ? (
          <>
            <strong>{focusedTopic.shortName}</strong>: {focusedTopic.perYear.reduce((acc, count) => acc + count, 0)} preguntas en {years.length} MIR ·
            cayó en {focusedTopic.perYear.filter((count) => count > 0).length} de {years.length}
          </>
        ) : focusedYear !== null ? (
          <>
            <strong>MIR {focusedYear}</strong>: {yearTotal} preguntas de la asignatura
          </>
        ) : (
          <span className="text-[#7D8A96]">Pasa el ratón por una celda, un tema o un año para ver el detalle.</span>
        )}
      </p>

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
