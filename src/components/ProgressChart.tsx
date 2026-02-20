'use client'

import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { TimeSeriesResponse } from '@/services/resultsService'

type ProgressChartProps = {
  data: TimeSeriesResponse | null
  loading: boolean
  error: string | null
  onRetry: () => void
  drawActive?: boolean
}

type ChartPoint = {
  date: string
  score: number
  avgTime: number
  correct: number | null
}

const WIDTH = 800
const HEIGHT = 240
const PADDING = {
  top: 14,
  right: 72,
  bottom: 28,
  left: 44,
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeZone: 'Europe/Madrid',
  }).format(parsed)
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function parsePoints(data: TimeSeriesResponse | null): ChartPoint[] {
  if (!Array.isArray(data?.points)) return []

  return data.points
    .map((point) => {
      const date = typeof point?.date === 'string' ? point.date : ''
      const score = toNumber(point?.score)
      const avgTime = toNumber(point?.avgTime)
      const correct = toNumber(point?.correct)

      if (!date || score === null || avgTime === null) return null
      return { date, score, avgTime, correct }
    })
    .filter((point): point is ChartPoint => point !== null)
    .slice(-30)
}

function getLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  const tension = 0.55
  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = index > 0 ? points[index - 1] : points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = index + 2 < points.length ? points[index + 2] : p2

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return path
}

export default function ProgressChart({
  data,
  loading,
  error,
  onRetry,
  drawActive = true,
}: ProgressChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const series = useMemo(() => parsePoints(data), [data])

  const chart = useMemo(() => {
    const chartWidth = WIDTH - PADDING.left - PADDING.right
    const chartHeight = HEIGHT - PADDING.top - PADDING.bottom
    const slotCount = Math.max(5, Math.min(30, series.length))

    const minScore = Math.min(...series.map((point) => point.score))
    const maxScore = Math.max(...series.map((point) => point.score))
    const scoreRange = Math.max(1, maxScore - minScore)
    const scoreDomainMin = minScore
    const scoreDomainMax = maxScore + scoreRange * 0.1

    const observedMaxTime = Math.max(0, ...series.map((point) => point.avgTime))
    const timeDomainMax = Math.max(10, Math.ceil(observedMaxTime * 1.2))
    const correctValues = series
      .map((point) => point.correct)
      .filter((value): value is number => typeof value === 'number')
    const hasCorrectSeries = correctValues.length > 0
    const correctDomainMin = 1
    const correctDomainMax = 5

    const points = series.map((point, index) => {
      const x = PADDING.left + (index / (slotCount - 1)) * chartWidth
      const yScore =
        PADDING.top +
        ((scoreDomainMax - point.score) / (scoreDomainMax - scoreDomainMin)) *
          chartHeight
      const yAvgTime =
        PADDING.top + ((timeDomainMax - point.avgTime) / timeDomainMax) * chartHeight
      const yCorrect =
        point.correct == null
          ? null
          : PADDING.top +
            ((correctDomainMax - Math.max(correctDomainMin, Math.min(correctDomainMax, point.correct))) /
              (correctDomainMax - correctDomainMin)) *
              chartHeight

      return { ...point, x, yScore, yAvgTime, yCorrect }
    })

    const scorePath = getLinePath(points.map((point) => ({ x: point.x, y: point.yScore })))
    const avgTimePath = getLinePath(points.map((point) => ({ x: point.x, y: point.yAvgTime })))
    const correctPath = hasCorrectSeries
      ? getLinePath(
          points
            .filter((point): point is typeof point & { yCorrect: number } => point.yCorrect != null)
            .map((point) => ({ x: point.x, y: point.yCorrect })),
        )
      : ''

    return {
      points,
      scorePath,
      avgTimePath,
      correctPath,
      hasCorrectSeries,
      slotCount,
      chartHeight,
      scoreDomainMin,
      scoreDomainMax,
      timeDomainMax,
    }
  }, [series])

  const hoveredPoint =
    hoveredIndex == null ? null : chart.points[hoveredIndex] ?? null
  const tooltipAnchor =
    !hoveredPoint
      ? 'center'
      : hoveredPoint.x > WIDTH - PADDING.right - 110
        ? 'right'
        : hoveredPoint.x < PADDING.left + 110
          ? 'left'
          : 'center'

  if (loading) {
    return (
      <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
        <div className="animate-pulse">
          <div className="h-4 w-44 rounded bg-[#EDE8E5]" />
          <div className="mt-3 h-[220px] rounded bg-[#EFEAE7]" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] p-4">
        <p className="text-sm font-semibold text-[#C4655A]">
          No se pudo cargar la grafica de progreso.
        </p>
        <p className="mt-1 text-xs text-[#7D8A96]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-[#E8A598] px-4 py-2 text-xs font-bold text-white"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (data?.status === 'insufficient_data') {
    return (
      <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
        <h3 className="text-base font-bold text-[#141514]">Progreso global</h3>
        <p className="mt-3 text-sm text-[#7D8A96]">
          Aun no hay datos suficientes para mostrar la tendencia.
        </p>
      </div>
    )
  }

  if (series.length === 0) {
    return (
      <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
        <h3 className="text-base font-bold text-[#141514]">Progreso global</h3>
        <p className="mt-3 text-sm text-[#7D8A96]">
          No hay actividad diaria disponible.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#EAE0D5] bg-[#FAF7F4] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[#141514]">Progreso global</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-[#8BA888]">
            <span className="h-2 w-2 rounded-full bg-[#8BA888]" />
            Score
          </span>
          <span className="inline-flex items-center gap-1 text-[#7D8A96]">
            <span className="h-2 w-2 rounded-full bg-[#E8A598]" />
            Tiempo medio
          </span>
          {chart.hasCorrectSeries && (
            <span className="inline-flex items-center gap-1 text-[#D7B977]">
              <span className="h-2 w-2 rounded-full bg-[#D7B977]" />
              Aciertos
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle, #000 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px',
            clipPath: `inset(${(PADDING.top / HEIGHT) * 100}% ${(PADDING.right / WIDTH) * 100}% ${(PADDING.bottom / HEIGHT) * 100}% ${(PADDING.left / WIDTH) * 100}%)`,
          }}
          initial={{ backgroundPosition: '22px 0px' }}
          animate={{ backgroundPosition: ['22px 0px', '0px 0px'] }}
          transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
        />
        <svg
          className="relative z-10 h-[220px] w-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {[0, 1, 2, 3, 4].map((tick) => {
            const y = PADDING.top + (tick / 4) * chart.chartHeight
            const leftValue =
              chart.scoreDomainMax -
              (tick / 4) * (chart.scoreDomainMax - chart.scoreDomainMin)
            const rightValue = chart.timeDomainMax - (tick / 4) * chart.timeDomainMax
            return (
              <g key={`tick-${tick}`}>
                <text
                  x={PADDING.left - 10}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#8BA888"
                  fontWeight="600"
                >
                  {Math.round(leftValue)}
                </text>
                <text
                  x={WIDTH - PADDING.right + 6}
                  y={y + 3}
                  textAnchor="start"
                  fontSize="10"
                  fill="#E8A598"
                  fontWeight="600"
                >
                  {Math.round(rightValue)}s
                </text>
                {chart.hasCorrectSeries && (
                  <text
                    x={WIDTH - PADDING.right + 38}
                    y={y + 3}
                    textAnchor="start"
                    fontSize="10"
                    fill="#D7B977"
                    fontWeight="600"
                  >
                    {Math.max(1, Math.round(5 - tick))}
                  </text>
                )}
              </g>
            )
          })}

          {typeof data?.avgScore30 === 'number' && (
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={
                PADDING.top +
                ((chart.scoreDomainMax - data.avgScore30) /
                  (chart.scoreDomainMax - chart.scoreDomainMin)) *
                  chart.chartHeight
              }
              y2={
                PADDING.top +
                ((chart.scoreDomainMax - data.avgScore30) /
                  (chart.scoreDomainMax - chart.scoreDomainMin)) *
                  chart.chartHeight
              }
              stroke="#8BA888"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              opacity="0.6"
            />
          )}

          {hoveredPoint && (
            <line
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="#CFC7C0"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.9"
            />
          )}

          <motion.path
            d={chart.scorePath}
            fill="none"
            stroke="#8BA888"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4.5"
            initial={false}
            animate={{
              pathLength: drawActive ? 1 : 0,
              opacity: drawActive ? 1 : 0.2,
            }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
          <motion.path
            d={chart.avgTimePath}
            fill="none"
            stroke="#E8A598"
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
            initial={false}
            animate={{
              pathLength: drawActive ? 1 : 0,
              opacity: drawActive ? 1 : 0.2,
            }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.08 }}
          />
          {chart.hasCorrectSeries && (
            <motion.path
              d={chart.correctPath}
              fill="none"
              stroke="#D7B977"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
              initial={false}
              animate={{
                pathLength: drawActive ? 1 : 0,
                opacity: drawActive ? 1 : 0.2,
              }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.14 }}
            />
          )}

          {chart.points.map((point, index) => {
            const nextPoint = chart.points[index + 1]
            const previousPoint = chart.points[index - 1]
            const leftBoundary = previousPoint
              ? (previousPoint.x + point.x) / 2
              : PADDING.left
            const rightBoundary = nextPoint
              ? (nextPoint.x + point.x) / 2
              : WIDTH - PADDING.right

            return (
              <g key={`point-hit-${point.date}`}>
                <rect
                  x={leftBoundary}
                  y={PADDING.top}
                  width={rightBoundary - leftBoundary}
                  height={HEIGHT - PADDING.top - PADDING.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(index)}
                />
                <circle
                  cx={point.x}
                  cy={point.yScore}
                  r={hoveredIndex === index ? 3 : 0}
                  fill="#8BA888"
                />
                <circle
                  cx={point.x}
                  cy={point.yAvgTime}
                  r={hoveredIndex === index ? 3 : 0}
                  fill="#E8A598"
                />
                {point.yCorrect != null && (
                  <circle
                    cx={point.x}
                    cy={point.yCorrect}
                    r={hoveredIndex === index ? 3 : 0}
                    fill="#D7B977"
                  />
                )}
              </g>
            )
          })}
        </svg>

        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-[#374151] px-2 py-1 text-[10px] font-medium text-white shadow-md"
            style={{
              left: `${(hoveredPoint.x / WIDTH) * 100}%`,
              top: `${(Math.min(hoveredPoint.yScore, hoveredPoint.yAvgTime) / HEIGHT) * 100}%`,
              transform:
                tooltipAnchor === 'right'
                  ? 'translate(calc(-100% - 10px), calc(-100% - 10px))'
                  : tooltipAnchor === 'left'
                    ? 'translate(10px, calc(-100% - 10px))'
                    : 'translate(-50%, calc(-100% - 10px))',
            }}
          >
            <div>{formatDate(hoveredPoint.date)}</div>
            <div>Score: {Math.round(hoveredPoint.score)}</div>
            <div>Tiempo medio: {hoveredPoint.avgTime.toFixed(1)}s</div>
            {typeof hoveredPoint.correct === 'number' && (
              <div>Aciertos: {Math.round(hoveredPoint.correct)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
