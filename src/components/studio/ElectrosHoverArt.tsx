'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

const bounce = { type: 'spring', stiffness: 340, damping: 20, mass: 0.9 } as const
const ctaBounce = { type: 'spring', stiffness: 300, damping: 26, mass: 0.9 } as const

/* ─── Trazado de un ECG ────────────────────────────────────────────────
   Un latido de referencia mide 200 unidades de ancho; `beatW` lo escala y
   `amp` la altura de las deflexiones. El segmento empieza y termina en la
   línea de base, así que los latidos encadenan sin saltos y el trazo se
   puede duplicar en bucle sin costura.
*/
function beatSegment(x: number, beatW: number, baseY: number, amp: number): string {
  const u = beatW / 200
  const p = (dx: number) => (x + dx * u).toFixed(1)
  const v = (dy: number) => (baseY + dy * amp).toFixed(1)
  return [
    `H${p(22)}`,
    `Q${p(38)},${v(-26)} ${p(54)},${baseY}`, // onda P
    `H${p(74)}`, // segmento PR
    `L${p(82)},${v(14)}`, // Q
    `L${p(92)},${v(-118)}`, // R
    `L${p(102)},${v(44)}`, // S
    `L${p(112)},${baseY}`,
    `H${p(134)}`, // segmento ST
    `Q${p(156)},${v(-40)} ${p(178)},${baseY}`, // onda T
    `H${p(200)}`,
  ].join(' ')
}

function ecgPath(x0: number, beatW: number, count: number, baseY: number, amp: number): string {
  let d = `M${x0},${baseY}`
  for (let i = 0; i < count; i += 1) d += ` ${beatSegment(x0 + i * beatW, beatW, baseY, amp)}`
  return d
}

/* ════════════════════════════════════════════════════════════════════
   ARTE DE HOVER — monitor de cabecera que barre el trazo en tiempo real
═══════════════════════════════════════════════════════════════════════ */

const SCREEN_X = 60
const SCREEN_Y = 150
const SCREEN_W = 600
const SCREEN_H = 330
const BASE_Y = SCREEN_Y + SCREEN_H / 2

// 3 latidos por barrido; a 0.8 s el latido, el monitor marca 75 lpm.
const BEAT_W = SCREEN_W / 3
const BEAT_MS = 0.8
const SWEEP_S = BEAT_MS * 3

const TRACE = ecgPath(SCREEN_X, BEAT_W, 3, BASE_Y, 1)

// Cuadrícula del papel de ECG (fina 1 mm, gruesa 5 mm) como `pattern`: antes
// eran ~40 elementos <line> por tarjeta, y el navegador los recomponía en cada
// fotograma del barrido. Así son dos rectángulos.
const GRID_MM = 24

// `fill-box` hace que el 50% 50% que framer fuerza en los SVG caiga en el
// centro de la propia figura, que es donde debe pivotar el latido del corazón.
const selfOrigin = { transformBox: 'fill-box', transformOrigin: '50% 50%' } as const

export function EcgMonitorArt({ hovered }: { hovered: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute right-8 top-[38%] z-0 hidden w-56 -translate-y-1/2 sm:block lg:w-64"
      initial="rest"
      animate={hovered ? 'hover' : 'rest'}
      variants={{
        rest: { opacity: 0, x: '130%', rotate: 10 },
        hover: { opacity: 1, x: '0%', rotate: -3 },
      }}
      transition={bounce}
    >
      <svg viewBox="0 0 720 620" className="h-auto w-full">
        <defs>
          <filter id="electroMonitorShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#2c3e50" floodOpacity=".15" />
          </filter>
          <clipPath id="electroScreenClip">
            <rect x={SCREEN_X} y={SCREEN_Y} width={SCREEN_W} height={SCREEN_H} rx="20" />
          </clipPath>
          <pattern id="electroGridFine" width={GRID_MM} height={GRID_MM} patternUnits="userSpaceOnUse">
            <path
              d={`M${GRID_MM} 0 L0 0 0 ${GRID_MM}`}
              fill="none"
              stroke="#F4D7CF"
              strokeWidth="1.6"
            />
          </pattern>
          <pattern id="electroGridBold" width={GRID_MM * 5} height={GRID_MM * 5} patternUnits="userSpaceOnUse">
            <rect width={GRID_MM * 5} height={GRID_MM * 5} fill="url(#electroGridFine)" />
            <path
              d={`M${GRID_MM * 5} 0 L0 0 0 ${GRID_MM * 5}`}
              fill="none"
              stroke="#E9B7AA"
              strokeWidth="3"
            />
          </pattern>
          {/* El barrido: una ventana que crece de izquierda a derecha y va
              destapando el trazo, igual que el cabezal de un monitor. */}
          <clipPath id="electroSweepClip">
            <motion.rect
              x={SCREEN_X}
              y={SCREEN_Y}
              height={SCREEN_H}
              initial={{ width: 0 }}
              animate={hovered ? { width: [0, SCREEN_W] } : { width: 0 }}
              transition={
                hovered
                  ? { duration: SWEEP_S, repeat: Infinity, ease: 'linear' }
                  : { duration: 0.2 }
              }
            />
          </clipPath>
        </defs>

        {/* Carcasa */}
        <g filter="url(#electroMonitorShadow)">
          <rect x="20" y="20" width="680" height="520" rx="48" fill="#fff" stroke="#2c3e50" strokeWidth="14" />
        </g>

        {/* Pie del monitor */}
        <path d="M330 540v42h60v-42" fill="#fff" stroke="#2c3e50" strokeWidth="12" strokeLinejoin="round" />
        <rect x="250" y="576" width="220" height="26" rx="13" fill="#fff" stroke="#2c3e50" strokeWidth="12" />

        {/* Constantes: corazón que late y frecuencia */}
        <motion.path
          d="M96 66c-16-16-42-14-54 4-11 17-6 38 10 52l44 40 44-40c16-14 21-35 10-52-12-18-38-20-54-4z"
          fill="#E8A598"
          stroke="#2c3e50"
          strokeWidth="10"
          strokeLinejoin="round"
          style={selfOrigin}
          animate={hovered ? { scale: [1, 1.18, 0.97, 1] } : { scale: 1 }}
          transition={
            hovered
              ? { duration: BEAT_MS, repeat: Infinity, ease: 'easeOut', times: [0, 0.16, 0.34, 1] }
              : { duration: 0.25 }
          }
        />
        <text x="176" y="126" fontSize="76" fontWeight="800" fill="#2c3e50" fontFamily="inherit">
          75
        </text>
        <text x="292" y="126" fontSize="38" fontWeight="600" fill="#9aa7b2" fontFamily="inherit">
          lpm
        </text>

        {/* Etiqueta de la derivación */}
        <rect x="596" y="62" width="66" height="60" rx="16" fill="#2c3e50" />
        <text x="629" y="106" fontSize="38" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="inherit">
          II
        </text>

        {/* Pantalla: papel de ECG */}
        <rect
          x={SCREEN_X}
          y={SCREEN_Y}
          width={SCREEN_W}
          height={SCREEN_H}
          rx="20"
          fill="#FFF5F2"
          stroke="#2c3e50"
          strokeWidth="8"
        />
        <g clipPath="url(#electroScreenClip)">
          <rect
            x={SCREEN_X}
            y={SCREEN_Y}
            width={SCREEN_W}
            height={SCREEN_H}
            fill="url(#electroGridBold)"
          />

          {/* Trazo, destapado por el barrido */}
          <g clipPath="url(#electroSweepClip)">
            <path
              d={TRACE}
              fill="none"
              stroke="#2c3e50"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Cabezal del barrido */}
          {hovered ? (
            <motion.g
              initial={{ x: 0 }}
              animate={{ x: [0, SCREEN_W] }}
              transition={{ duration: SWEEP_S, repeat: Infinity, ease: 'linear' }}
            >
              <line
                x1={SCREEN_X}
                y1={SCREEN_Y}
                x2={SCREEN_X}
                y2={SCREEN_Y + SCREEN_H}
                stroke="#E8A598"
                strokeWidth="5"
                opacity="0.55"
              />
              <circle cx={SCREEN_X} cy={BASE_Y} r="11" fill="#E8A598" stroke="#2c3e50" strokeWidth="5" />
            </motion.g>
          ) : null}
        </g>
      </svg>
    </motion.div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   CTA — trazos de ECG deslizándose, hermano del oleaje de Simulacros
═══════════════════════════════════════════════════════════════════════ */

const CTA_W = 1440
const CTA_H = 120
const CTA_BEAT_W = 240
const CTA_BASE_Y = 84

const CTA_LINE = ecgPath(0, CTA_BEAT_W, CTA_W / CTA_BEAT_W, CTA_BASE_Y, 0.52)
const CTA_BODY = `${CTA_LINE} L${CTA_W},${CTA_H} L0,${CTA_H} Z`

/**
 * Una sola tira de ECG desplazándose.
 *
 * Antes eran tres capas a distintas velocidades: doce rutas grandes
 * transformándose a la vez, que es lo que hacía que el hover se notara pesado,
 * y además el apilado ensuciaba la lectura del trazo. Con una capa el gesto se
 * entiende igual y cuesta una fracción.
 */
function TraceMarquee() {
  return (
    <motion.div
      className="absolute inset-y-0 left-0 flex h-full"
      style={{ width: '200%' }}
      initial={{ x: '0%' }}
      animate={{ x: ['0%', '-50%'] }}
      transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
    >
      {[0, 1].map((i) => (
        <svg
          key={i}
          viewBox={`0 0 ${CTA_W} ${CTA_H}`}
          preserveAspectRatio="none"
          className="block h-full w-1/2"
        >
          <path d={CTA_BODY} fill="#E8A598" fillOpacity={0.26} />
          <path
            d={CTA_LINE}
            fill="none"
            stroke="#E8A598"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ))}
    </motion.div>
  )
}

export function EcgTraceCta({ hovered, children }: { hovered: boolean; children: ReactNode }) {
  return (
    <button type="button" className="absolute inset-x-0 bottom-0 z-0 h-24 overflow-hidden rounded-b-2xl">
      <motion.div
        className="absolute inset-0 flex items-end justify-center pb-6"
        initial="rest"
        animate={hovered ? 'risen' : 'rest'}
        variants={{
          rest: { y: '100%', opacity: 0 },
          risen: { y: '0%', opacity: 1 },
        }}
        transition={ctaBounce}
      >
        {/* Solo existe mientras se ve: al salir el ratón se desmonta y no queda
            ninguna animación corriendo de fondo. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -bottom-4">
          {hovered ? <TraceMarquee /> : null}
        </div>
        <span className="relative z-10 flex items-center gap-2 text-base font-semibold text-[#2c3e50] [text-shadow:0_1px_2px_rgba(255,255,255,0.55)]">
          {children}
        </span>
      </motion.div>
    </button>
  )
}
