'use client'

import { useMemo, useState } from 'react'

type Props = {
  mean?: number | null
  stdDev?: number | null
  zScore?: number | null
  score?: number | null
  embedded?: boolean
}

export default function ZScoreComparisonCard({
  mean,
  stdDev,
  zScore,
  score,
  embedded = false,
}: Props) {
  const [hovered, setHovered] = useState<{
    x: number
    y: number
    z: number
    mouseX: number
    mouseY: number
  } | null>(null)

  const safeZ = typeof zScore === 'number' && Number.isFinite(zScore) ? zScore : null
  const safeScore = typeof score === 'number' && Number.isFinite(score) ? score : null

  const chart = useMemo(() => {
    const width = 860
    const height = 220
    const margin = { top: 22, right: 22, bottom: 44, left: 22 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const domainAbs = Math.max(3, Math.ceil(Math.abs(safeZ ?? 0)) + 1)
    const xMin = -domainAbs
    const xMax = domainAbs

    const xToPx = (x: number) =>
      margin.left + ((x - xMin) / (xMax - xMin)) * innerWidth
    const yToPx = (y: number) => margin.top + innerHeight - y * innerHeight

    const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
    const yMax = pdf(0)

    const points: Array<[number, number]> = []
    const samples = 120
    for (let i = 0; i <= samples; i++) {
      const x = xMin + (i / samples) * (xMax - xMin)
      const y = pdf(x) / yMax
      points.push([xToPx(x), yToPx(y)])
    }

    const linePath = points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      .join(' ')
    const areaPath = `${linePath} L ${xToPx(xMax)} ${yToPx(0)} L ${xToPx(
      xMin,
    )} ${yToPx(0)} Z`

    const ticks: number[] = []
    for (let t = Math.ceil(xMin); t <= Math.floor(xMax); t++) ticks.push(t)

    return {
      width,
      height,
      margin,
      xMin,
      xMax,
      xToPx,
      yToPx,
      linePath,
      areaPath,
      ticks,
    }
  }, [safeZ])

  return (
    <div
      className={
        embedded
          ? 'w-full'
          : 'bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-[#F0EBE8] lg:col-span-2'
      }
    >
      {!embedded && (
        <div className="mb-4">
          <h3 className="text-[#374151] font-bold text-lg leading-tight">
            Z-SCORE
          </h3>
          <p className="text-[#7D8A96] text-xs font-medium mt-1">
            Eje centrado en z=0. Valores negativos a la izquierda y positivos a la
            derecha.
          </p>
        </div>
      )}
      {embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-[#374151] font-bold text-sm uppercase tracking-widest">
            Z-SCORE
          </h4>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#FFF8F6] border border-[#E8A598]/30 px-3 py-1 text-xs font-bold text-[#C4655A]">
              {safeScore === null ? '-- pts' : `${safeScore} pts`}
            </span>
            <span className="inline-flex items-center rounded-full bg-[#F1F5F9] border border-[#CBD5E1] px-3 py-1 text-xs font-bold text-[#475569]">
              {safeZ === null ? 'z --' : `z ${safeZ.toFixed(2)}`}
            </span>
          </div>
        </div>
      )}

      <div className="relative rounded-2xl border border-[#F0EBE8] bg-[#FAF7F4] p-4">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          className="w-full h-52"
          onMouseLeave={() => setHovered(null)}
          onMouseMove={(e) => {
            const bounds = (
              e.currentTarget as SVGSVGElement
            ).getBoundingClientRect()
            const mouseX = e.clientX - bounds.left
            const mouseY = e.clientY - bounds.top
            const x = ((e.clientX - bounds.left) / bounds.width) * chart.width
            const y = ((e.clientY - bounds.top) / bounds.height) * chart.height
            const clampedX = Math.max(
              chart.margin.left,
              Math.min(chart.width - chart.margin.right, x),
            )
            const clampedY = Math.max(
              chart.margin.top,
              Math.min(chart.height - chart.margin.bottom, y),
            )
            const z =
              chart.xMin +
              ((clampedX - chart.margin.left) /
                (chart.width - chart.margin.left - chart.margin.right)) *
                (chart.xMax - chart.xMin)
            setHovered({
              x: clampedX,
              y: clampedY,
              z,
              mouseX,
              mouseY,
            })
          }}
        >
          <path d={chart.areaPath} fill="#8BA888" opacity="0.16" />
          <path d={chart.linePath} fill="none" stroke="#8BA888" strokeWidth="2.5" />

          <line
            x1={chart.xToPx(0)}
            y1={chart.margin.top}
            x2={chart.xToPx(0)}
            y2={chart.height - chart.margin.bottom}
            stroke="#94A3B8"
            strokeDasharray="4 4"
          />
          <line
            x1={chart.xToPx(-1)}
            y1={chart.margin.top}
            x2={chart.xToPx(-1)}
            y2={chart.height - chart.margin.bottom}
            stroke="#94A3B8"
            strokeDasharray="2 4"
            opacity="0.8"
          />
          <line
            x1={chart.xToPx(1)}
            y1={chart.margin.top}
            x2={chart.xToPx(1)}
            y2={chart.height - chart.margin.bottom}
            stroke="#94A3B8"
            strokeDasharray="2 4"
            opacity="0.8"
          />

          {safeZ !== null && (
            <>
              <line
                x1={chart.xToPx(Math.max(chart.xMin, Math.min(chart.xMax, safeZ)))}
                y1={chart.margin.top}
                x2={chart.xToPx(Math.max(chart.xMin, Math.min(chart.xMax, safeZ)))}
                y2={chart.height - chart.margin.bottom}
                stroke="#C4655A"
                strokeWidth="2"
              />
              <text
                x={chart.xToPx(Math.max(chart.xMin, Math.min(chart.xMax, safeZ)))}
                y={chart.margin.top - 5}
                textAnchor="middle"
                className="fill-[#C4655A] text-[15px] font-extrabold"
              >
                Tú
              </text>
            </>
          )}

          <line
            x1={chart.margin.left}
            y1={chart.height - chart.margin.bottom}
            x2={chart.width - chart.margin.right}
            y2={chart.height - chart.margin.bottom}
            stroke="#CBD5E1"
          />

          {chart.ticks.map((t) => (
            <g key={t}>
              <line
                x1={chart.xToPx(t)}
                y1={chart.height - chart.margin.bottom}
                x2={chart.xToPx(t)}
                y2={chart.height - chart.margin.bottom + 6}
                stroke="#94A3B8"
              />
              <text
                x={chart.xToPx(t)}
                y={chart.height - chart.margin.bottom + 20}
                textAnchor="middle"
                className="fill-[#7D8A96] text-[10px] font-semibold"
              >
                {t === -1 ? '-1σ' : t === 1 ? '+1σ' : t}
              </text>
            </g>
          ))}

          {hovered && (
            <line
              x1={hovered.x}
              y1={chart.margin.top}
              x2={hovered.x}
              y2={chart.height - chart.margin.bottom}
              stroke="#64748B"
              strokeDasharray="3 3"
              opacity="0.8"
            />
          )}
        </svg>

        {hovered && (
          <div
            className="absolute z-[40] rounded-lg border border-[#E9E4E1] bg-white/95 px-3 py-2 text-xs text-[#4B5563] shadow-sm pointer-events-none"
            style={{
              left: `${hovered.mouseX + 18}px`,
              top: `${hovered.mouseY - 12}px`,
              transform: 'translate(0, -100%)',
            }}
          >
            <div>{`z: ${hovered.z.toFixed(2)}`}</div>
          </div>
        )}
      </div>

    </div>
  )
}
