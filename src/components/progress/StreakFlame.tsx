'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { INK } from '@/components/ui/sticker'

/* ════════════════════════════════════════════════════════════════════════
   La llama de la racha.

   Sustituye al círculo naranja con el icono de Material: aquel era un icono
   metido en un botón, no una imagen de la racha. Esta es una llama dibujada a
   medida con el borde de tinta del kit, así que envejece con el resto de la
   web y no depende de la fuente de iconos.

   Cambia de color con la racha, y ese es el punto: el usuario ve que su fuego
   "sube de temperatura" sin leer un número. Los cortes son los mismos que los
   del multiplicador de XP, para que lo que ve concuerde con lo que gana.
═══════════════════════════════════════════════════════════════════════════ */

type Escala = {
  /** Racha mínima para este aspecto */
  min: number
  /** Cuerpo de la llama */
  cuerpo: string
  /** Corazón de la llama, más claro */
  corazon: string
}

// Ceniza -> ámbar -> naranja -> rojo vivo. El día 30 es donde el multiplicador
// toca su techo (×1,5), así que es donde la llama llega a su color final.
const ESCALA: ReadonlyArray<Escala> = [
  { min: 0,  cuerpo: '#C9C3BE', corazon: '#EAE4E2' },
  { min: 1,  cuerpo: '#EDB53F', corazon: '#FBE2A0' },
  { min: 7,  cuerpo: '#EA8600', corazon: '#FFCE7A' },
  { min: 15, cuerpo: '#DE6A2B', corazon: '#FFB067' },
  { min: 30, cuerpo: '#C4655A', corazon: '#F3A183' },
] as const

function aspectoDe(racha: number): Escala {
  let out = ESCALA[0]
  for (const e of ESCALA) if (racha >= e.min) out = e
  return out
}

export default function StreakFlame({
  streak,
  size = 28,
  className = '',
}: {
  streak: number
  /** Alto en píxeles; el ancho sale de la proporción del dibujo. */
  size?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()
  const { cuerpo, corazon } = aspectoDe(streak)
  const viva = streak > 0

  // El latido va en el grupo interior y no en el svg: escalar el svg entero
  // movería también el borde de tinta y se vería "gordo" a mitad de ciclo.
  const late = viva && !reduceMotion

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size * 0.82, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 28 34"
        width="100%"
        height="100%"
        fill="none"
        style={{ overflow: 'visible' }}
      >
        <motion.g
          // transformBox + transformOrigin por CSS y no las props originX/Y de
          // framer: en SVG framer las pisa y el latido acababa pivotando desde
          // una esquina, con la llama bailando en vez de respirar.
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          animate={late ? { scaleY: [1, 1.06, 0.99, 1], scaleX: [1, 0.98, 1.02, 1] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* Cuerpo: la lengua de fuego, con la punta ladeada para que no
              parezca una gota simétrica. */}
          <path
            d="M14 1.5c3.2 4.4 2.1 7.2.4 9.6-1.2 1.7-2.4 3.2-2 5.1.3 1.5 1.6 2.4 2.9 2 1.5-.5 2-2.2 1.6-4.2 2.6 2 4.6 5 4.6 8.5 0 5.2-4.3 9-8.5 9S4.5 27.7 4.5 22.5c0-4.6 2.6-7.2 4.7-10C11.6 9.3 13.2 6.2 14 1.5Z"
            fill={cuerpo}
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Corazón: la parte caliente de abajo. Sin borde, para que lea como
              luz y no como una segunda pieza pegada. */}
          <motion.path
            d="M14 17.8c2.2 1.8 3.4 4 3.4 6.2 0 2.6-1.6 4.4-3.4 4.4s-3.4-1.8-3.4-4.4c0-2.2 1.2-4.4 3.4-6.2Z"
            fill={corazon}
            animate={late ? { opacity: [0.85, 1, 0.85] } : undefined}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.g>
      </svg>
    </span>
  )
}
