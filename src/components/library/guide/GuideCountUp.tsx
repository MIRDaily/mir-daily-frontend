'use client'

import { useEffect, useRef, useState } from 'react'
import { useRevealOnce } from '@/components/library/guide/GuideReveal'

type GuideCountUpProps = {
  to: number
  durationMs?: number
}

// Cuenta de 0 a `to` al entrar en pantalla. Sin JS o con movimiento reducido muestra el valor final.
export default function GuideCountUp({ to, durationMs = 1100 }: GuideCountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const visible = useRevealOnce(ref, 0.4)
  const [value, setValue] = useState(to)

  useEffect(() => {
    if (!visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(to * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [visible, to, durationMs])

  return (
    <span ref={ref} className="tabular-nums">
      {value}
    </span>
  )
}
