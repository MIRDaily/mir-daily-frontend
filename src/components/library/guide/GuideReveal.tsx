'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

// Distancia (fracción de la pantalla) a la que hay que alejarse de un bloque para que su
// animación se rearme. Evita que parpadee con scrolls pequeños junto al borde.
const REARM_MARGIN = '50%'

/**
 * true cuando el elemento entra en pantalla. Vuelve a false cuando se ha alejado lo
 * suficiente (REARM_MARGIN), así la animación se repite al regresar.
 */
export function useReveal<T extends Element>(ref: RefObject<T | null>, threshold = 0) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const enter = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true)
      },
      // Margen inferior: que arranque cuando el bloque ya asoma un poco, no justo en el borde.
      { threshold, rootMargin: '0px 0px -12% 0px' },
    )
    const leave = new IntersectionObserver(
      (entries) => {
        if (entries.every((entry) => !entry.isIntersecting)) setVisible(false)
      },
      { rootMargin: `${REARM_MARGIN} 0px ${REARM_MARGIN} 0px` },
    )
    enter.observe(node)
    leave.observe(node)
    return () => {
      enter.disconnect()
      leave.disconnect()
    }
  }, [ref, threshold])

  return visible
}

type GuideRevealProps = {
  children: ReactNode
  className?: string
}

// Activa las animaciones .guia-* de globals.css cuando el bloque se ve.
export default function GuideReveal({ children, className = '' }: GuideRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useReveal(ref)

  return (
    <div ref={ref} className={`guia-reveal ${visible ? 'guia-visible' : ''} ${className}`}>
      {children}
    </div>
  )
}
