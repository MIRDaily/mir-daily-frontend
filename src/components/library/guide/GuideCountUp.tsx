'use client'

import { useEffect, useRef, useState } from 'react'
import { useReveal } from '@/components/library/guide/GuideReveal'

type GuideCountUpProps = {
  to: number
  durationMs?: number
}

// Cuenta de 0 a `to` cada vez que entra en pantalla. Sin JS o con movimiento reducido muestra el valor final.
export default function GuideCountUp({ to, durationMs = 1100 }: GuideCountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const visible = useReveal(ref, 0.4)
  const [value, setValue] = useState(to)

  useEffect(() => {
    if (!visible || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    // El inicio se toma del primer fotograma: su marca de tiempo puede ser anterior a performance.now().
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const progress = Math.min(1, Math.max(0, (now - start) / durationMs))
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
