type GuideTrendChartProps = {
  perYear: Array<{ year: number; count: number }>
  average: number
  highlightYear: number
}

export default function GuideTrendChart({ perYear, average, highlightYear }: GuideTrendChartProps) {
  const max = Math.max(...perYear.map((item) => item.count)) + 2
  const averageBottom = (average / max) * 100

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-48 sm:h-56">
        <div
          className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-[#2C3E50]/25"
          style={{ bottom: `${averageBottom}%` }}
        />

        <div className="flex h-full items-end gap-1.5 sm:gap-2.5">
          {perYear.map(({ year, count }) => {
            const isHighlight = year === highlightYear
            return (
              <div key={year} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className={`text-[11px] font-bold sm:text-xs ${isHighlight ? 'text-[#B5655A]' : 'text-[#2C3E50]/70'}`}>
                  {count}
                </span>
                <div
                  className={`w-full rounded-t-md ${isHighlight ? 'bg-[#E8A598]' : 'bg-[#2C3E50]/15'}`}
                  style={{ height: `${(count / max) * 100}%` }}
                  title={`MIR ${year}: ${count} preguntas`}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex gap-1.5 sm:gap-2.5">
        {perYear.map(({ year }) => (
          <span
            key={year}
            className={`flex-1 text-center text-[10px] sm:text-xs ${year === highlightYear ? 'font-bold text-[#B5655A]' : 'text-[#7D8A96]'}`}
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
    </div>
  )
}
