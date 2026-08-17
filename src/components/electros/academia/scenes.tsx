'use client'

/* ════════════════════════════════════════════════════════════════════════
   Escenas SVG reutilizables de la Academia: corazón con sistema de conducción,
   latido con zonas tocables, diana del ventrículo izquierdo, escalera de Lewis
   y tiras de ritmo esquemáticas.

   Todas son SVG propios (geometría redibujada para esta herramienta), sin
   reproducir figuras de ninguna fuente con copyright.
═══════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { beatPath, phaseAt } from '@/lib/electros/academia/ecgmini'
import { stripGeometry, type StripKind } from '@/lib/electros/academia/strips'
import type { LadderKind } from '@/lib/electros/academia/curriculum'

const INK = '#241c1a'
const PAPER = '#FFF7F4'

export const SEV_COLOR: Record<'normal' | 'warn' | 'crit', string> = {
  normal: '#8BA888',
  warn: '#C9A24A',
  crit: '#C4655A',
}

/* ════════════════════════════════════════════════════════════════════════
   TEXTURA Y ESCENARIO

   El papel milimetrado del ECG es la textura de la casa aquí: se pinta con
   gradientes repetidos (nada de imágenes) para que escale a cualquier tamaño
   y se pueda teñir con el color del módulo.
═══════════════════════════════════════════════════════════════════════════ */
const ecgPaper = (fine: string, bold: string, step = 13) => ({
  backgroundColor: PAPER,
  backgroundImage: [
    `repeating-linear-gradient(to right, ${fine} 0 1px, transparent 1px ${step}px)`,
    `repeating-linear-gradient(to bottom, ${fine} 0 1px, transparent 1px ${step}px)`,
    `repeating-linear-gradient(to right, ${bold} 0 1.5px, transparent 1.5px ${step * 5}px)`,
    `repeating-linear-gradient(to bottom, ${bold} 0 1.5px, transparent 1.5px ${step * 5}px)`,
  ].join(','),
})

export const PAPER_STYLE = ecgPaper('rgba(212,151,140,0.20)', 'rgba(212,151,140,0.38)')
const INK_PAPER_STYLE = {
  backgroundColor: '#241c1a',
  backgroundImage: [
    'repeating-linear-gradient(to right, rgba(232,165,152,0.13) 0 1px, transparent 1px 13px)',
    'repeating-linear-gradient(to bottom, rgba(232,165,152,0.13) 0 1px, transparent 1px 13px)',
    'repeating-linear-gradient(to right, rgba(232,165,152,0.26) 0 1.5px, transparent 1.5px 65px)',
    'repeating-linear-gradient(to bottom, rgba(232,165,152,0.26) 0 1.5px, transparent 1.5px 65px)',
  ].join(','),
}

export type StageTone = 'paper' | 'ink' | 'plain'

/**
 * El panel grande donde vive la ilustración de cada paso. Es la pieza que da
 * el aire "de mesa de trabajo": papel milimetrado, borde de tinta y sombra
 * dura, el mismo lenguaje de las tarjetas del Studio.
 */
export function Stage({
  tone = 'paper',
  accent,
  children,
  className = '',
  label,
}: {
  tone?: StageTone
  accent?: string
  children: React.ReactNode
  className?: string
  label?: string
}) {
  const style =
    tone === 'paper' ? PAPER_STYLE : tone === 'ink' ? INK_PAPER_STYLE : { backgroundColor: '#fff' }

  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl border-2 border-[#2c3e50] shadow-[6px_6px_0_0_#2c3e50] ${className}`}
      style={style}
      initial={{ opacity: 0, y: 18, rotate: -0.6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Viñeta suave para que el contenido no se pelee con la cuadrícula */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            tone === 'ink'
              ? 'radial-gradient(ellipse at center, rgba(36,28,26,0) 35%, rgba(36,28,26,0.75) 100%)'
              : 'radial-gradient(ellipse at center, rgba(255,247,244,0) 40%, rgba(255,247,244,0.9) 100%)',
        }}
      />
      {label ? (
        <span
          className="absolute left-4 top-3 z-10 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: accent ?? (tone === 'ink' ? 'rgba(255,255,255,0.5)' : '#B87A6F') }}
        >
          {label}
        </span>
      ) : null}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-5 sm:p-7">{children}</div>
    </motion.div>
  )
}

/**
 * Papel milimetrado dibujado DENTRO del SVG.
 *
 * La textura del `Stage` es decorativa: vive en píxeles CSS, así que nunca
 * puede cuadrar con una geometría medida en unidades del viewBox. Cuando la
 * cuadrícula es parte de la lección (medir el QRS, contar cuadros para la
 * frecuencia), tiene que ir aquí para que "un cuadro" sea exactamente un
 * cuadro. En esos casos el escenario va con `tone="plain"`.
 */
export function PaperGrid({ w, h, mm, bold = 5 }: { w: number; h: number; mm: number; bold?: number }) {
  const lines: React.ReactNode[] = []

  for (let i = 0; i * mm <= w + 0.001; i++) {
    const x = i * mm
    const isBold = i % bold === 0
    lines.push(
      <line
        key={`v${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={h}
        stroke={isBold ? 'rgba(212,151,140,0.52)' : 'rgba(212,151,140,0.24)'}
        strokeWidth={isBold ? 1.3 : 0.7}
      />,
    )
  }
  for (let i = 0; i * mm <= h + 0.001; i++) {
    const y = i * mm
    const isBold = i % bold === 0
    lines.push(
      <line
        key={`h${i}`}
        x1={0}
        y1={y}
        x2={w}
        y2={y}
        stroke={isBold ? 'rgba(212,151,140,0.52)' : 'rgba(212,151,140,0.24)'}
        strokeWidth={isBold ? 1.3 : 0.7}
      />,
    )
  }

  return (
    <g aria-hidden>
      <rect width={w} height={h} fill={PAPER} />
      {lines}
    </g>
  )
}

/** Latido de fondo, muy tenue, que da vida a la pantalla del mapa. */
export function AmbientTrace({ color = '#E8A598' }: { color?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-1/2 h-40 w-full -translate-y-1/2 opacity-[0.07]"
    >
      <motion.path
        d="M0 100 H150 l14 -8 12 16 10 -70 12 96 10 -34 H420 l14 -8 12 16 10 -70 12 96 10 -34 H690 l14 -8 12 16 10 -70 12 96 10 -34 H960 l14 -8 12 16 10 -70 12 96 10 -34 H1200"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        initial={{ strokeDashoffset: 1 }}
        animate={{ strokeDashoffset: [1, 0, 0] }}
        transition={{ duration: 7, times: [0, 0.75, 1], repeat: Infinity, ease: 'linear' }}
      />
    </svg>
  )
}

/** Bucle de animación que se detiene solo al desmontar o al pausarse. */
export function useAnimationLoop(callback: (elapsed: number) => void, active: boolean) {
  const ref = useRef(callback)

  // El callback se refresca tras cada render (no durante), para que el bucle
  // siempre llame a la última versión sin tener que reiniciarse.
  useEffect(() => {
    ref.current = callback
  })

  useEffect(() => {
    if (!active) return
    let raf = 0
    const t0 = performance.now()
    const loop = (ts: number) => {
      ref.current((ts - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active])
}

/* ════════════════════════════════════════════════════════════════════════
   CORAZÓN CON SISTEMA DE CONDUCCIÓN
═══════════════════════════════════════════════════════════════════════════ */
// Trayecto del impulso en coordenadas del viewBox (0 0 200 250).
const ROUTE = [
  { f: 0.0, x: 138, y: 62 }, // nodo SA (aurícula derecha, arriba)
  { f: 0.07, x: 118, y: 92 }, // difusión auricular
  { f: 0.12, x: 102, y: 120 }, // nodo AV
  { f: 0.2, x: 102, y: 132 }, // retraso AV (apenas avanza)
  { f: 0.23, x: 102, y: 150 }, // haz de His
  { f: 0.27, x: 102, y: 168 }, // ramas
  { f: 0.31, x: 102, y: 210 }, // Purkinje / punta
]

function routePoint(f: number): { x: number; y: number } {
  if (f <= ROUTE[0].f) return ROUTE[0]
  const last = ROUTE[ROUTE.length - 1]
  if (f >= last.f) return last
  for (let i = 1; i < ROUTE.length; i++) {
    if (f <= ROUTE[i].f) {
      const a = ROUTE[i - 1]
      const b = ROUTE[i]
      const k = (f - a.f) / (b.f - a.f)
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    }
  }
  return last
}

const ATRIA_D = 'M40 60 Q40 30 72 34 Q100 20 100 46 Q100 20 128 34 Q160 30 160 60 Q160 96 100 104 Q40 96 40 60 Z'
const VENT_D =
  'M46 104 Q40 150 72 210 Q100 244 100 210 Q100 244 128 210 Q160 150 154 104 Q100 128 46 104 Z'

export function HeartConduction({ f, className = '' }: { f: number; className?: string }) {
  const phase = phaseAt(f)
  const s = phase.struct
  const x = ((f % 1) + 1) % 1
  const sparkVisible = x < 0.32
  const spark = routePoint(x)

  const atriaLit = s === 'atria' || s === 'sa'
  const ventLit = s === 'vent'
  const ventRepol = s === 'repol'
  const condActive = s === 'his' || s === 'vent'

  return (
    <svg
      viewBox="0 0 200 250"
      className={`h-full w-full ${className}`}
      role="img"
      aria-label="Corazón y sistema de conducción"
    >
      {/* Cámaras */}
      <path
        d={ATRIA_D}
        fill={atriaLit ? '#F3C9C1' : '#F6EFEC'}
        stroke={atriaLit ? '#D4978C' : '#E0D5D0'}
        strokeWidth="2.5"
        style={{ transition: 'fill .18s ease, stroke .18s ease' }}
      />
      <path
        d={VENT_D}
        fill={ventLit ? '#C7D8E8' : ventRepol ? '#D5E3D3' : '#F6EFEC'}
        stroke={ventLit ? '#7CA3C9' : ventRepol ? '#8BA888' : '#E0D5D0'}
        strokeWidth="2.5"
        style={{ transition: 'fill .18s ease, stroke .18s ease' }}
      />

      {/* Tabique */}
      <line x1="100" y1="104" x2="100" y2="214" stroke="#E0D5D0" strokeWidth="2" />

      {/* Vía de conducción */}
      <g
        fill="none"
        stroke={condActive ? '#7CA3C9' : '#CDBFB9'}
        strokeWidth={condActive ? 3.4 : 2.4}
        strokeLinecap="round"
        style={{ transition: 'stroke .18s ease, stroke-width .18s ease' }}
      >
        <path d="M138 62 Q118 92 102 120 L102 150" />
        <path d="M102 168 Q80 184 70 214" />
        <path d="M102 168 Q124 184 134 214" />
        <path d="M70 214 Q66 224 60 230 M70 214 Q78 226 84 232 M134 214 Q138 224 144 230 M134 214 Q126 226 120 232" />
      </g>

      {/* Nodos */}
      <circle cx="138" cy="62" r="7" fill={s === 'sa' ? '#D4978C' : '#fff'} stroke="#B87A6F" strokeWidth="2.5" />
      <circle cx="102" cy="120" r="6" fill={s === 'av' ? '#C9A24A' : '#fff'} stroke="#B8975A" strokeWidth="2.5" />
      <rect
        x="98"
        y="146"
        width="8"
        height="16"
        rx="3"
        fill={s === 'his' ? '#7CA3C9' : '#fff'}
        stroke="#6E90B2"
        strokeWidth="2.5"
      />

      {/* Impulso */}
      <circle
        cx={spark.x}
        cy={spark.y}
        r="6"
        fill="#E8A598"
        stroke={INK}
        strokeWidth="2"
        opacity={sparkVisible ? 1 : 0}
      />

      {/* Etiquetas */}
      <g fontSize="10" fontWeight="700" fill="#8A7B75" fontFamily="inherit">
        <text x="150" y="52">SA</text>
        <text x="112" y="120">AV</text>
        <text x="112" y="160">His</text>
      </g>
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   LATIDO CON ZONAS TOCABLES
═══════════════════════════════════════════════════════════════════════════ */
const WAVE_REGIONS = [
  { id: 'P', a: 0.03, b: 0.15, label: 'P' },
  { id: 'PR', a: 0.15, b: 0.235, label: 'PR' },
  { id: 'QRS', a: 0.235, b: 0.315, label: 'QRS' },
  { id: 'ST', a: 0.315, b: 0.45, label: 'ST' },
  { id: 'T', a: 0.45, b: 0.63, label: 'T' },
]

export function WavesScene({
  onHit,
  solvedId,
  wrongId,
  labelled = false,
}: {
  onHit?: (id: string) => void
  solvedId?: string | null
  wrongId?: string | null
  labelled?: boolean
}) {
  const W = 320
  const H = 150
  const { d, xOf } = beatPath(0, 0, W, H, { fStart: 0, fEnd: 0.66 })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Latido de referencia">
      <rect width={W} height={H} fill={PAPER} rx="10" />
      <path d={d} fill="none" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />

      {labelled
        ? [
            { f: 0.09, t: 'P' },
            { f: 0.268, t: 'QRS' },
            { f: 0.52, t: 'T' },
          ].map((m) => (
            <text
              key={m.t}
              x={xOf(m.f)}
              y={18}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#B87A6F"
              fontFamily="inherit"
            >
              {m.t}
            </text>
          ))
        : null}

      {onHit
        ? WAVE_REGIONS.map((r) => {
            const x0 = xOf(r.a)
            const x1 = xOf(r.b)
            const solved = solvedId === r.id
            const wrong = wrongId === r.id
            return (
              <g key={r.id}>
                <rect
                  x={x0}
                  y={4}
                  width={x1 - x0}
                  height={H - 8}
                  rx="6"
                  className="cursor-pointer"
                  fill={solved ? 'rgba(139,168,136,0.28)' : wrong ? 'rgba(196,101,90,0.24)' : 'transparent'}
                  stroke={solved ? '#8BA888' : wrong ? '#C4655A' : 'rgba(184,122,111,0.28)'}
                  strokeWidth={solved || wrong ? 2 : 1}
                  strokeDasharray={solved || wrong ? undefined : '4 4'}
                  onClick={() => onHit(r.id)}
                  style={{ transition: 'fill .2s ease, stroke .2s ease' }}
                />
                <text
                  x={(x0 + x1) / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#B87A6F"
                  fontFamily="inherit"
                  pointerEvents="none"
                >
                  {r.label}
                </text>
              </g>
            )
          })
        : null}
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   CORAZÓN CON ZONAS TOCABLES (hotspot)
═══════════════════════════════════════════════════════════════════════════ */
export function HeartScene({
  onHit,
  solvedId,
  wrongId,
}: {
  onHit: (id: string) => void
  solvedId?: string | null
  wrongId?: string | null
}) {
  const zoneProps = (id: string) => {
    const solved = solvedId === id
    const wrong = wrongId === id
    return {
      className: 'cursor-pointer',
      fill: solved ? 'rgba(139,168,136,0.35)' : wrong ? 'rgba(196,101,90,0.3)' : '#F6EFEC',
      stroke: solved ? '#8BA888' : wrong ? '#C4655A' : '#E0D5D0',
      strokeWidth: solved || wrong ? 3 : 2.5,
      onClick: () => onHit(id),
      style: { transition: 'fill .2s ease, stroke .2s ease' },
    }
  }

  return (
    <svg viewBox="0 0 200 250" className="h-full w-full" role="img" aria-label="Corazón: toca una estructura">
      <path d={ATRIA_D} {...zoneProps('atria')} />
      <path d={VENT_D} {...zoneProps('vent')} />
      <path
        d="M138 62 Q118 92 102 120 L102 150 M102 168 Q80 184 70 214 M102 168 Q124 184 134 214"
        fill="none"
        stroke="#CDBFB9"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="138" cy="62" r="9" {...zoneProps('sa')} />
      <circle cx="102" cy="120" r="8" {...zoneProps('av')} />
      <rect x="96" y="146" width="12" height="18" rx="3" {...zoneProps('his')} />
      <g fontSize="10" fontWeight="700" fill="#8A7B75" fontFamily="inherit" pointerEvents="none">
        <text x="152" y="52">SA</text>
        <text x="114" y="120">AV</text>
        <text x="116" y="160">His</text>
      </g>
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   DIANA DEL VENTRÍCULO IZQUIERDO (territorios del infarto)
═══════════════════════════════════════════════════════════════════════════ */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function sectorPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${cx} ${cy} L${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${r} ${r} 0 ${large} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`
}

const SECTORS = [
  { id: 'anterior', a0: -135, a1: -45, lab: 'Anterior', sub: 'V3-V4' },
  { id: 'lateral', a0: -45, a1: 45, lab: 'Lateral', sub: 'I·aVL·V5-V6' },
  { id: 'inferior', a0: 45, a1: 135, lab: 'Inferior', sub: 'II·III·aVF' },
  { id: 'septal', a0: 135, a1: 225, lab: 'Septo', sub: 'V1-V2' },
]

export function Bullseye({
  onPick,
  solvedId,
  wrongId,
}: {
  onPick: (id: string) => void
  solvedId?: string | null
  wrongId?: string | null
}) {
  const cx = 110
  const cy = 112
  const r = 82

  return (
    <svg viewBox="0 0 220 224" className="h-full w-full" role="img" aria-label="Paredes del ventrículo izquierdo">
      <path d="M28 112 A82 82 0 0 1 192 112" fill="none" stroke="#D4978C" strokeWidth="2" strokeDasharray="5 4" />
      <text x="110" y="18" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#A8988F" fontFamily="inherit">
        VD: V3R-V4R · Posterior: espejo en V1-V2
      </text>

      {SECTORS.map((s) => {
        const solved = solvedId === s.id
        const wrong = wrongId === s.id
        return (
          <path
            key={s.id}
            d={sectorPath(cx, cy, r, s.a0, s.a1)}
            className="cursor-pointer"
            fill={solved ? 'rgba(139,168,136,0.4)' : wrong ? 'rgba(196,101,90,0.32)' : '#F6EFEC'}
            stroke={solved ? '#8BA888' : wrong ? '#C4655A' : '#E0D5D0'}
            strokeWidth="2"
            onClick={() => onPick(s.id)}
            style={{ transition: 'fill .2s ease, stroke .2s ease' }}
          />
        )
      })}

      <circle cx={cx} cy={cy} r="26" fill="#fff" stroke="#E0D5D0" strokeWidth="2" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#8A7B75" fontFamily="inherit">
        VI
      </text>

      {SECTORS.map((s) => {
        const mid = (s.a0 + s.a1) / 2
        const lp = polar(cx, cy, r * 0.6, mid)
        return (
          <g key={`lbl-${s.id}`} pointerEvents="none" fontFamily="inherit">
            <text x={lp.x} y={lp.y - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="#2C3E50">
              {s.lab}
            </text>
            <text x={lp.x} y={lp.y + 11} textAnchor="middle" fontSize="8" fontWeight="600" fill="#8A7B75">
              {s.sub}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   ESCALERA DE LEWIS (conducción A → nodo AV → V)
═══════════════════════════════════════════════════════════════════════════ */
type LadderEvent =
  | { k: 'p'; x: number; rx: number }
  | { k: 'cond'; x1: number; y1: number; x2: number; y2: number; rx: number }
  | { k: 'block'; x: number; y2: number; rx: number }
  | { k: 'qrs'; x: number; rx: number }
  | { k: 'vstub'; x: number; rx: number }

const LAD = { x0: 16, dx: 48, Ay: 34, Ny0: 60, Ny1: 92, Vy: 118, nA: 6 }

function ladderEvents(kind: LadderKind): LadderEvent[] {
  const { x0, dx, Ay, Ny1, Vy, nA } = LAD
  const ev: LadderEvent[] = []

  if (kind === 'av3') {
    // Disociación: ninguna P conduce y el ventrículo va por libre.
    for (let i = 0; i < nA; i++) {
      const xP = x0 + i * dx
      ev.push({ k: 'p', x: xP, rx: xP })
      ev.push({ k: 'block', x: xP, y2: Ny1, rx: xP })
    }
    let xv = 30
    while (xv < x0 + nA * dx) {
      ev.push({ k: 'qrs', x: xv, rx: xv })
      ev.push({ k: 'vstub', x: xv, rx: xv })
      xv += 92
    }
    return ev
  }

  for (let i = 0; i < nA; i++) {
    const xP = x0 + i * dx
    ev.push({ k: 'p', x: xP, rx: xP })
    let blocked = false
    let pr = 22
    if (kind === 'mobitz1') {
      pr = 20 + (i % 4) * 12 // el PR crece hasta que una P se bloquea
      blocked = i % 4 === 3
    } else if (kind === 'mobitz2') {
      pr = 24 // PR fijo, caída súbita
      blocked = i % 3 === 2
    }
    if (blocked) {
      ev.push({ k: 'block', x: xP, y2: Ny1, rx: xP })
    } else {
      const xQ = xP + pr
      ev.push({ k: 'cond', x1: xP, y1: Ay, x2: xQ, y2: Vy, rx: xQ })
      ev.push({ k: 'qrs', x: xQ, rx: xQ })
    }
  }
  return ev
}

export function ConductionLadder({ kind, head }: { kind: LadderKind; head: number }) {
  const { Ay, Ny0, Ny1, Vy } = LAD
  const W = 320
  const H = 150
  const events = ladderEvents(kind)

  const tiers = [
    { y: Ay, label: 'A' },
    { y: Ny0, label: 'AV' },
    { y: Ny1, label: '' },
    { y: Vy, label: 'V' },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Escalera de conducción AV">
      <rect width={W} height={H} fill={PAPER} rx="10" />
      {tiers.map((t) => (
        <g key={t.y}>
          <line x1="8" y1={t.y} x2={W - 8} y2={t.y} stroke="#E0D5D0" strokeWidth="1.5" />
          {t.label ? (
            <text x="10" y={t.y - 4} fontSize="9" fontWeight="700" fill="#A8988F" fontFamily="inherit">
              {t.label}
            </text>
          ) : null}
        </g>
      ))}

      {events.map((e, i) => {
        if (e.rx > head) return null
        if (e.k === 'p') {
          return (
            <g key={i}>
              <line x1={e.x} y1={Ay - 10} x2={e.x} y2={Ay + 4} stroke="#D4978C" strokeWidth="2.4" />
              <circle cx={e.x} cy={Ay - 10} r="3" fill="#D4978C" />
            </g>
          )
        }
        if (e.k === 'cond') {
          return <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#8BA888" strokeWidth="2.2" />
        }
        if (e.k === 'block') {
          return (
            <g key={i}>
              <line x1={e.x} y1={Ay} x2={e.x} y2={e.y2} stroke="#C4655A" strokeWidth="2.2" strokeDasharray="4 3" />
              <text
                x={e.x}
                y={e.y2 + 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill="#C4655A"
                fontFamily="inherit"
              >
                ✕
              </text>
            </g>
          )
        }
        if (e.k === 'qrs') {
          return (
            <g key={i}>
              <line x1={e.x} y1={Vy - 4} x2={e.x} y2={Vy + 14} stroke="#7CA3C9" strokeWidth="2.6" />
              <circle cx={e.x} cy={Vy + 14} r="3" fill="#7CA3C9" />
            </g>
          )
        }
        return <line key={i} x1={e.x} y1={Ny1} x2={e.x} y2={Vy} stroke="#7CA3C9" strokeWidth="2" strokeDasharray="3 3" />
      })}

      <line x1={head} y1={20} x2={head} y2={H - 16} stroke="#E8A598" strokeWidth="2" opacity="0.6" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   TIRA DE RITMO ESQUEMÁTICA
═══════════════════════════════════════════════════════════════════════════ */
export function RhythmStrip({ kind, label }: { kind: StripKind; label?: string }) {
  const { d, w, h, mm } = stripGeometry(kind)
  const gid = `strip-grid-${kind}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label={`Tira de ritmo: ${label || kind}`}>
      <defs>
        <pattern id={gid} width={mm} height={mm} patternUnits="userSpaceOnUse">
          <path d={`M${mm} 0 L0 0 0 ${mm}`} fill="none" stroke="rgba(212,151,140,0.22)" strokeWidth="0.5" />
        </pattern>
        <pattern id={`${gid}-b`} width={mm * 5} height={mm * 5} patternUnits="userSpaceOnUse">
          <rect width={mm * 5} height={mm * 5} fill={`url(#${gid})`} />
          <path
            d={`M${mm * 5} 0 L0 0 0 ${mm * 5}`}
            fill="none"
            stroke="rgba(212,151,140,0.5)"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={PAPER} rx="8" />
      <rect width={w} height={h} fill={`url(#${gid}-b)`} rx="8" />
      <path d={d} fill="none" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
      {label ? (
        <text x="8" y="16" fontSize="11" fontWeight="600" fill="#B87A6F" fontFamily="inherit">
          {label}
        </text>
      ) : null}
    </svg>
  )
}
