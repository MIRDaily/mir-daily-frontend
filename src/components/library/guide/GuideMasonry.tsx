'use client'

import { Children, useEffect, useRef, type ReactNode } from 'react'

/** Alto de cada fila implícita de la rejilla (px): 1 px para que el hueco sea exacto */
const ROW = 1
/** Separación vertical entre tarjetas (px); igual que el gap horizontal (gap-x-4) */
const GAP = 16
/** Duración y curva de la recolocación (las mismas para todas las tarjetas, para que se muevan como un bloque) */
const DURATION = 520
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

type GuideMasonryProps = {
  children: ReactNode
}

// Rejilla de 1 columna (móvil) o 2 (lg) sin huecos entre tarjetas de distinta altura: cada tarjeta
// ocupa tantas filas de 1 px como mide, y la rejilla coloca la siguiente en la columna que queda más
// arriba, respetando el orden. Un ResizeObserver recalcula al abrir una respuesta o cambiar el ancho.
// Hasta medir (y sin JS) se ve como una rejilla normal alineada arriba.
//
// Transición (FLIP): el ResizeObserver se ejecuta tras el layout y antes de pintar, así que se puede
// guardar dónde se ve cada tarjeta (incluida una animación a medias), recolocar, medir el destino y
// animar con transform desde la posición vieja: nunca se ve el salto, ni siquiera al cambiar de
// columna. La tarjeta que crece no anima su altura (eso rompe el scroll suave): se descubre con un
// clip-path que acompaña al desplazamiento del resto.
export default function GuideMasonry({ children }: GuideMasonryProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cells = Array.from(grid.children) as HTMLElement[]
    const sizes = new WeakMap<HTMLElement, { width: number; height: number }>()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let measured = false

    const layout = () => {
      const animate = measured && !reduceMotion.matches
      // First: dónde se ve cada tarjeta ahora mismo (con su transform, si estaba animándose)
      const before = animate ? cells.map((cell) => cell.getBoundingClientRect()) : []
      const grown: Array<{ card: HTMLElement; delta: number }> = []
      let widthChanged = false

      for (const cell of cells) {
        const card = cell.firstElementChild as HTMLElement | null
        if (!card) continue
        const { width, height } = card.getBoundingClientRect()
        const prev = sizes.get(card)
        if (prev) {
          if (Math.abs(prev.width - width) > 0.5) widthChanged = true
          else if (height > prev.height + 0.5) grown.push({ card, delta: height - prev.height })
        }
        sizes.set(card, { width, height })
        cell.style.gridRowEnd = `span ${Math.ceil((height + GAP) / ROW)}`
      }
      grid.dataset.masonry = 'on'
      measured = true
      // Al cambiar el ancho (girar el móvil, redimensionar) se recoloca sin animación
      if (!animate || widthChanged) {
        for (const cell of cells) cell.getAnimations().forEach((animation) => animation.cancel())
        return
      }

      cells.forEach((cell, index) => {
        cell.getAnimations().forEach((animation) => animation.cancel())
        // Last: destino real, ya sin transform
        const after = cell.getBoundingClientRect()
        const dx = before[index].left - after.left
        const dy = before[index].top - after.top
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
        // Las que cambian de columna pasan por encima de las demás
        if (Math.abs(dx) >= 0.5) cell.style.zIndex = '1'
        const move = cell.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
          { duration: DURATION, easing: EASING },
        )
        move.onfinish = move.oncancel = () => {
          cell.style.zIndex = ''
        }
      })

      for (const { card, delta } of grown) {
        const radius = getComputedStyle(card).borderTopLeftRadius
        card.getAnimations().filter((animation) => animation.id === 'guia-grow').forEach((animation) => animation.cancel())
        const reveal = card.animate(
          [{ clipPath: `inset(0 0 ${delta}px 0 round ${radius})` }, { clipPath: `inset(0 0 0 0 round ${radius})` }],
          { duration: DURATION, easing: EASING },
        )
        reveal.id = 'guia-grow'
      }
    }

    const observer = new ResizeObserver(layout)
    for (const cell of cells) if (cell.firstElementChild) observer.observe(cell.firstElementChild)
    layout()
    return () => {
      observer.disconnect()
      for (const cell of cells) cell.getAnimations().forEach((animation) => animation.cancel())
    }
  }, [children])

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 data-[masonry=on]:auto-rows-[1px] data-[masonry=on]:gap-y-0"
    >
      {Children.map(children, (child) => (
        <div className="min-w-0">{child}</div>
      ))}
    </div>
  )
}
