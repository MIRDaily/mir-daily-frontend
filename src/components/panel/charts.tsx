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

// --- Escala de calor CONTINUA por % de aciertos (gradiente, sin cortes duros)
//   rojo (<30) -> azul grisáceo (~38) -> verde a verde intenso (46-70)
//   -> morado galáctico (>=~70). El factor galáctico añade textura estelar.
type RGB = [number, number, number]
const HEAT_STOPS: [number, RGB][] = [
  [0, [150, 44, 38]], // rojo intenso
  [22, [196, 101, 90]], // #C4655A rojo coral
  [38, [125, 138, 150]], // #7D8A96 azul grisáceo
  [55, [139, 168, 136]], // #8BA888 verde salvia
  [66, [72, 122, 72]], // verde intenso
  [78, [126, 72, 184]], // morado galáctico
  [100, [150, 52, 235]], // morado vivo
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function heatRgb(acc: number): RGB {
  const a = Math.max(0, Math.min(100, acc))
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [x0, c0] = HEAT_STOPS[i]
    const [x1, c1] = HEAT_STOPS[i + 1]
    if (a <= x1) {
      const t = (a - x0) / (x1 - x0 || 1)
      return [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)]
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1]
}

export function heatColor(accuracy: number | null): string {
  if (accuracy == null) return 'rgb(207,197,187)'
  const [r, g, b] = heatRgb(accuracy)
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

export function heatColorDark(accuracy: number | null, amount = 0.78): string {
  if (accuracy == null) return 'rgb(178,168,158)'
  const [r, g, b] = heatRgb(accuracy)
  return `rgb(${Math.round(r * amount)},${Math.round(g * amount)},${Math.round(b * amount)})`
}

// 0..1: intensidad de la textura galáctica (gradiente suave 64 -> 80).
export function galacticFactor(accuracy: number | null): number {
  if (accuracy == null) return 0
  return Math.max(0, Math.min(1, (accuracy - 64) / (80 - 64)))
}

// Alias continuo usado por anillos, líneas y acentos del detalle.
export function toneColor(accuracy: number | null): string {
  return heatColor(accuracy)
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
    // Red de seguridad: si rAF está pausado (pestaña en segundo plano), garantiza
    // que el valor final se muestre igualmente pasada la duración.
    const fallback = window.setTimeout(() => setDisplay(value), durationMs + 120)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.clearTimeout(fallback)
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
