'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// Paleta MIRDaily
export const C = {
  correct: '#8BA888',
  wrong: '#C4655A',
  blank: '#7D8A96',
  accent: '#E8A598',
  ink: '#141514',
  soft: '#FAF7F4',
  border: '#EAE0D5',
} as const

export function toneColor(accuracy: number | null): string {
  if (accuracy == null) return '#CFC5BB'
  if (accuracy >= 75) return C.correct
  if (accuracy >= 60) return C.blank
  return C.wrong
}

// ---------------------------------------------------------------------------
// Contador animado (cuenta desde 0 hasta value cuando aparece)
// ---------------------------------------------------------------------------
export function CountUp({
  value,
  suffix = '',
  durationMs = 900,
  className,
}: {
  value: number
  suffix?: string
  durationMs?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const start = performance.now()
    const from = 0
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs])

  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Barra apilada horizontal: aciertos / fallos / blancos, con crecimiento animado
// ---------------------------------------------------------------------------
export function StackedBar({
  correct,
  wrong,
  blank,
  height = 10,
  rounded = true,
  delay = 0,
}: {
  correct: number
  wrong: number
  blank: number
  height?: number
  rounded?: boolean
  delay?: number
}) {
  const total = Math.max(1, correct + wrong + blank)
  const seg = (n: number) => `${(n / total) * 100}%`
  return (
    <div
      className={`flex w-full overflow-hidden bg-[#F0EAE6] ${rounded ? 'rounded-full' : 'rounded'}`}
      style={{ height }}
    >
      {[
        { w: seg(correct), c: C.correct },
        { w: seg(wrong), c: C.wrong },
        { w: seg(blank), c: C.blank },
      ].map((s, i) => (
        <motion.div
          key={i}
          initial={{ width: 0 }}
          animate={{ width: s.w }}
          transition={{ duration: 0.7, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          style={{ backgroundColor: s.c }}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Anillo de precisión (gauge circular animado)
// ---------------------------------------------------------------------------
export function AccuracyRing({
  accuracy,
  size = 116,
  stroke = 10,
}: {
  accuracy: number | null
  size?: number
  stroke?: number
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = accuracy == null ? 0 : Math.max(0, Math.min(100, accuracy))
  const color = toneColor(accuracy)
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0EAE6" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color: C.ink }}>
          {accuracy == null ? '--' : <CountUp value={Math.round(accuracy)} suffix="%" />}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]">Aciertos</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Línea de evolución (precisión en el tiempo) con trazo animado + área
// ---------------------------------------------------------------------------
export function TrendChart({
  points,
  height = 200,
  color = C.correct,
}: {
  points: { label: string; value: number | null }[]
  height?: number
  color?: string
}) {
  const W = 600
  const H = height
  const padX = 12
  const padY = 22
  const valid = points.filter((p) => p.value != null) as { label: string; value: number }[]

  if (valid.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-[#EAE0D5] bg-[#FAF7F4]/60 text-sm text-[#7D8A96]"
        style={{ height }}
      >
        Sin datos suficientes para la evolución.
      </div>
    )
  }

  const n = valid.length
  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * (W - padX * 2)
  const y = (v: number) => padY + (1 - v / 100) * (H - padY * 2)

  const linePath = valid
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ')
  const areaPath =
    `M${x(0).toFixed(1)},${(H - padY).toFixed(1)} ` +
    valid.map((p, i) => `L${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ') +
    ` L${x(n - 1).toFixed(1)},${(H - padY).toFixed(1)} Z`

  const gradId = `trendgrad-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={W - padX}
          y1={y(g)}
          y2={y(g)}
          stroke="#EAE0D5"
          strokeDasharray="4 5"
          strokeWidth={1}
        />
      ))}
      <motion.path
        d={areaPath}
        fill={`url(#${gradId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
      />
      {valid.map((p, i) => (
        <motion.circle
          key={i}
          cx={x(i)}
          cy={y(p.value)}
          r={i === n - 1 ? 5 : 3}
          fill={i === n - 1 ? color : '#fff'}
          stroke={color}
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.6 + i * (0.5 / n) }}
        />
      ))}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Barras verticales apiladas por tema (aciertos/fallos/blancos), animadas
// ---------------------------------------------------------------------------
export function TopicColumns({
  topics,
  max = 6,
}: {
  topics: { name: string; correct: number; wrong: number; blank: number; total: number }[]
  max?: number
}) {
  const shown = topics.slice(0, max)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {shown.map((t, idx) => {
        const total = Math.max(1, t.correct + t.wrong + t.blank)
        const segs = [
          { h: (t.correct / total) * 100, c: C.correct },
          { h: (t.wrong / total) * 100, c: C.wrong },
          { h: (t.blank / total) * 100, c: C.blank },
        ]
        return (
          <div
            key={t.name}
            className="flex flex-col rounded-xl border border-[#EAE0D5] bg-white p-3"
          >
            <div className="mb-2 flex h-24 items-end justify-center gap-1.5">
              {segs.map((s, i) => (
                <div key={i} className="flex h-full w-4 items-end overflow-hidden rounded-t-md bg-[#F5F1ED]">
                  <motion.div
                    className="w-full rounded-t-md"
                    style={{ backgroundColor: s.c }}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(3, s.h)}%` }}
                    transition={{ duration: 0.7, delay: 0.15 + idx * 0.05 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              ))}
            </div>
            <p className="truncate text-xs font-bold text-[#141514]" title={t.name}>
              {t.name}
            </p>
            <p className="text-[10px] text-[#7D8A96]">{t.total} preg.</p>
          </div>
        )
      })}
    </div>
  )
}
