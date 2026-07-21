'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const bounce = { type: 'spring', stiffness: 340, damping: 20, mass: 0.9 } as const
const flipTransition = { duration: 0.7, ease: [0.22, 1, 0.36, 1] } as const

export function FlipCardArt({ hovered }: { hovered: boolean }) {
  const [cycling, setCycling] = useState(false)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (!hovered) {
      setCycling(false)
      setFlipped(false)
      return
    }
    const startTimeout = setTimeout(() => setCycling(true), 200)
    return () => clearTimeout(startTimeout)
  }, [hovered])

  useEffect(() => {
    if (!cycling) return
    setFlipped(true)
    const interval = setInterval(() => setFlipped((f) => !f), 1800)
    return () => clearInterval(interval)
  }, [cycling])

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute right-10 top-[42%] z-0 hidden w-36 -translate-y-1/2 sm:block"
      initial="rest"
      animate={hovered ? 'settled' : 'rest'}
      variants={{
        rest: { opacity: 0, x: '130%', rotate: 8 },
        settled: { opacity: 1, x: '0%', rotate: -3 },
      }}
      transition={bounce}
    >
      <div style={{ perspective: 900 }}>
        <motion.div
          className="relative aspect-[4/3] w-full"
          style={{ transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={flipTransition}
        >
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl border-[3px] bg-gradient-to-br from-white to-[#fff0ec] p-4 text-center text-sm font-bold text-[#2c3e50] shadow-lg"
            style={{ borderColor: '#2c3e50', backfaceVisibility: 'hidden' }}
          >
            ¿Tríada de Cushing?
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center rounded-2xl border-[3px] bg-white p-4 text-center text-xs font-medium text-[#2c3e50] shadow-lg"
            style={{ borderColor: '#E8A598', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            HTA + bradicardia + resp. irregular
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
