'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

/** true la primera vez que el elemento entra en pantalla (y ya no vuelve a false). */
export function useRevealOnce<T extends Element>(ref: RefObject<T | null>, threshold = 0) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      // Margen inferior: que arranque cuando el bloque ya asoma un poco, no justo en el borde.
      { threshold, rootMargin: '0px 0px -12% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, threshold, visible])

  return visible
}

type GuideRevealProps = {
  children: ReactNode
  className?: string
}

// Activa las animaciones .guia-* de globals.css cuando el bloque se ve.
export default function GuideReveal({ children, className = '' }: GuideRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useRevealOnce(ref)

  return (
    <div ref={ref} className={`guia-reveal ${visible ? 'guia-visible' : ''} ${className}`}>
      {children}
    </div>
  )
}
