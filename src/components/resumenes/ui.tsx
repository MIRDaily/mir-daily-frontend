'use client'

/* ════════════════════════════════════════════════════════════════════════
   Kit visual de los resúmenes activos.

   El lenguaje de la casa (borde de tinta, sombra dura) con la textura que
   explica la herramienta: la HOJA DE APUNTES —renglones alineados con el
   texto, margen rojo y una pasada de fosforito—, porque un resumen activo es
   eso, un apunte con los datos tapados. Todo con gradientes (sin imágenes):
   escala a cualquier tamaño.
═══════════════════════════════════════════════════════════════════════════ */
import type { CSSProperties } from 'react'

export { GhostButton, Hero, INK, SectionLabel, StatChip, StickerButton, StickerCard } from '@/components/ui/sticker'

/**
 * Hoja de apuntes: un renglón por línea de texto (`linea` en em, la MISMA que el `line-height` del
 * párrafo, para que cada línea se escriba sobre su renglón), el margen rojo a la izquierda y una
 * pasada de fosforito en la esquina.
 */
export function hojaApuntes(linea = 2.15, fosforito = '#E8A598'): CSSProperties {
  return {
    backgroundColor: '#fff',
    backgroundImage: [
      `linear-gradient(100deg, ${fosforito}26 0 30%, transparent 30%)`,
      'linear-gradient(to right, transparent 0 22px, rgba(176,74,94,0.28) 22px 24px, transparent 24px)',
      `repeating-linear-gradient(to bottom, transparent 0 calc(${linea}em - 1px), rgba(63,126,166,0.14) calc(${linea}em - 1px) ${linea}em)`,
    ].join(','),
    backgroundSize: '9rem 0.6rem, 100% 100%, 100% 100%',
    backgroundRepeat: 'no-repeat, no-repeat, repeat',
    backgroundPosition: '1.5rem 0.9rem, 0 0, 0 calc(1.5rem - 0.35em)',
  }
}

/** Clases para ocultar las pistas de teclado en pantallas táctiles (allí no hay teclado). */
export const SOLO_TECLADO = '[@media(pointer:coarse)]:hidden'
