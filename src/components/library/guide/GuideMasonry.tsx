'use client'

import { Children, useEffect, useRef, type ReactNode } from 'react'

/** Alto de cada fila implícita de la rejilla (px): 1 px para que el hueco sea exacto */
const ROW = 1
/** Separación vertical entre tarjetas (px); igual que el gap horizontal (gap-x-4) */
const GAP = 16

type GuideMasonryProps = {
  children: ReactNode
}

// Rejilla de 1 columna (móvil) o 2 (lg) sin huecos entre tarjetas de distinta altura: cada tarjeta
// ocupa tantas filas de 1 px como mide, y la rejilla coloca la siguiente en la columna que queda más
// arriba, respetando el orden. Un ResizeObserver recalcula al abrir una respuesta o cambiar el ancho.
// Hasta medir (y sin JS) se ve como una rejilla normal alineada arriba.
export default function GuideMasonry({ children }: GuideMasonryProps) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const cells = Array.from(grid.children) as HTMLElement[]
    const layout = () => {
      for (const cell of cells) {
        const card = cell.firstElementChild as HTMLElement | null
        if (!card) continue
        const height = card.getBoundingClientRect().height
        cell.style.gridRowEnd = `span ${Math.ceil((height + GAP) / ROW)}`
      }
      grid.dataset.masonry = 'on'
    }
    const observer = new ResizeObserver(layout)
    for (const cell of cells) if (cell.firstElementChild) observer.observe(cell.firstElementChild)
    layout()
    return () => observer.disconnect()
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
