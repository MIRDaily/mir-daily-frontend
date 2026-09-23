'use client'

import { useState } from 'react'
import GuideReveal from '@/components/library/guide/GuideReveal'
import { cssVars } from '@/components/library/guide/guideStyles'

type GuideTrendChartProps = {
  perYear: Array<{ year: number; count: number }>
  average: number
  highlightYear: number
}

export default function GuideTrendChart({ perYear, average, highlightYear }: GuideTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...perYear.map((item) => item.count)) + 2
  const averageBottom = (average / max) * 100

  return (
    <GuideReveal className="flex flex-col gap-3">
      <div className="relative h-48 sm:h-56" onMouseLeave={() => setHovered(null)}>
        <div
          className="guia-fade pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-[#2C3E50]/25"
          style={{ bottom: `${averageBottom}%`, ...cssVars({ '--i': perYear.length }) }}
        />

        <div className="flex h-full items-end gap-1.5 sm:gap-2.5">
          {perYear.map(({ year, count }, index) => {
            const isHighlight = year === highlightYear
            const isHovered = hovered === index
            const diff = count - average
            return (
              <div
                key={year}
                className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end gap-1"
                onMouseEnter={() => setHovered(index)}
              >
                {isHovered ? (
                  <span className="guia-tooltip pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-lg bg-[#2C3E50] px-2.5 py-1.5 text-center text-[11px] leading-tight whitespace-nowrap text-white shadow-lg"
                    style={{ bottom: `calc(${(count / max) * 100}% + 22px)` }}
                  >
                    <strong className="block text-xs">MIR {year}</strong>
                    {count} preguntas · {diff >= 0 ? '+' : ''}
                    {diff.toLocaleString('es-ES', { maximumFractionDigits: 1 })} vs media
                  </span>
                ) : null}
                <span
                  className={`guia-fade text-[11px] font-bold transition-colors sm:text-xs ${isHighlight ? 'text-[#B5655A]' : isHovered ? 'text-[#2C3E50]' : 'text-[#2C3E50]/70'}`}
                  style={cssVars({ '--i': index })}
                >
                  {count}
                </span>
                <div
                  className={`guia-grow-y w-full rounded-t-md transition-colors duration-200 ${
                    isHighlight ? 'bg-[#E8A598]' : isHovered ? 'bg-[#2C3E50]/35' : 'bg-[#2C3E50]/15'
                  }`}
                  style={{ height: `${(count / max) * 100}%`, ...cssVars({ '--i': index }) }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-1.5 sm:gap-2.5">
        {perYear.map(({ year }, index) => (
          <span
            key={year}
            className={`flex-1 text-center text-[10px] transition-colors sm:text-xs ${
              year === highlightYear ? 'font-bold text-[#B5655A]' : hovered === index ? 'font-bold text-[#2C3E50]' : 'text-[#7D8A96]'
            }`}
          >
            {`'${String(year).slice(2)}`}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#7D8A96]">
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-[#2C3E50]/40" />
          media anterior: {average.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#E8A598]" />
          último MIR
        </span>
      </div>
    </GuideReveal>
  )
}
