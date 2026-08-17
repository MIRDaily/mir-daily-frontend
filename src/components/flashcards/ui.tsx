'use client'

/* ════════════════════════════════════════════════════════════════════════
   Kit visual de flashcards.

   Mismo lenguaje que la Academia de Electros —borde de tinta, sombra dura y
   una textura que "explica" de qué va la herramienta— pero con la ficha de
   cartulina rayada en lugar del papel milimetrado del ECG. Todo se pinta con
   gradientes repetidos: escala a cualquier tamaño y no cuesta una imagen.
═══════════════════════════════════════════════════════════════════════════ */
import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'

// Las primitivas del lenguaje (tarjeta, portada, botones…) son compartidas:
// se reexportan para que los módulos de flashcards importen de un solo sitio.
export {
  GhostButton,
  Hero,
  INK,
  SectionLabel,
  StatChip,
  StepBadge,
  StickerButton,
  StickerCard,
} from '@/components/ui/sticker'

import { INK } from '@/components/ui/sticker'

/** Cartulina rayada: renglones y margen, como una ficha de estudio de verdad. */
export function ruledPaper(line = 'rgba(125,138,150,0.16)', step = 28): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${step - 1}px, ${line} ${step - 1}px ${step}px)`,
    backgroundPosition: '0 6px',
  }
}

/** Variante teñida con el color de la asignatura, para las caras de tarjeta. */
export function tintedPaper(tint: string, step = 30): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: [
      `repeating-linear-gradient(to bottom, transparent 0 ${step - 1}px, rgba(125,138,150,0.13) ${step - 1}px ${step}px)`,
      `linear-gradient(135deg, ${tint}14 0%, transparent 55%)`,
    ].join(','),
    backgroundPosition: '0 8px, 0 0',
  }
}

/* ─── Arte decorativo: una pila de fichas ──────────────────────────────── */
export function CardStackArt({ accent = '#E8A598' }: { accent?: string }) {
  const sheets = [
    { x: 14, y: 18, rot: -7, fill: '#FFF5F2', delay: 0 },
    { x: 7, y: 9, rot: 4, fill: '#FFFFFF', delay: 0.08 },
    { x: 0, y: 0, rot: -2, fill: '#FFFFFF', delay: 0.16 },
  ]

  return (
    <motion.svg
      viewBox="0 0 200 150"
      className="h-32 w-40 lg:h-40 lg:w-52"
      aria-hidden
      animate={{ y: [0, -7, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {sheets.map((s, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: s.delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          transform={`translate(${s.x} ${s.y}) rotate(${s.rot} 90 70)`}
        >
          <rect x="22" y="16" width="140" height="102" rx="12" fill={s.fill} stroke={INK} strokeWidth="4" />
          {i === sheets.length - 1 ? (
            <>
              <line x1="40" y1="52" x2="144" y2="52" stroke="#D9D2CE" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="40" y1="72" x2="126" y2="72" stroke="#D9D2CE" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="40" y1="92" x2="108" y2="92" stroke="#D9D2CE" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="40" y="30" width="42" height="11" rx="5.5" fill={accent} />
            </>
          ) : null}
        </motion.g>
      ))}
    </motion.svg>
  )
}
