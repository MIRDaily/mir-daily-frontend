'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { QuestionCardIcon } from './QuestionCardIcon'

const bounce = { type: 'spring', stiffness: 340, damping: 20, mass: 0.9 } as const
const cycleBounce = { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 } as const
const deckOrigin = { transformOrigin: '50% 100%' }

const roles = ['front', 'mid', 'back'] as const
type Role = (typeof roles)[number]
type DeckState = 'rest' | Role

const roleVariant: Record<Role, { opacity: number; x: string; y: number; rotate: number; scale: number; zIndex: number }> = {
  front: { opacity: 1, x: '0%', y: 0, rotate: -2, scale: 1, zIndex: 3 },
  mid: { opacity: 0.85, x: '6%', y: 4, rotate: -10, scale: 0.9, zIndex: 2 },
  back: { opacity: 0.6, x: '12%', y: 8, rotate: -18, scale: 0.8, zIndex: 1 },
}

const restVariant = { opacity: 0, x: '130%', y: 0, rotate: 10, scale: 1, zIndex: 0 }

export function DeckArt({ hovered }: { hovered: boolean }) {
  const [cycling, setCycling] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!hovered) {
      setCycling(false)
      setTick(0)
      return
    }
    const startTimeout = setTimeout(() => setCycling(true), 500)
    return () => clearTimeout(startTimeout)
  }, [hovered])

  useEffect(() => {
    if (!cycling) return
    const interval = setInterval(() => setTick((t) => (t + 1) % 3), 1000)
    return () => clearInterval(interval)
  }, [cycling])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-10 top-[45%] z-0 hidden aspect-[720/620] w-52 -translate-y-1/2 sm:block"
    >
      {[0, 1, 2].map((layerIndex) => {
        const role = roles[(layerIndex + tick) % 3]
        const state: DeckState = hovered ? role : 'rest'
        return (
          <motion.div
            key={layerIndex}
            className="absolute inset-0"
            style={deckOrigin}
            initial="rest"
            animate={state}
            variants={{ rest: restVariant, front: roleVariant.front, mid: roleVariant.mid, back: roleVariant.back }}
            transition={
              hovered && !cycling
                ? { ...bounce, delay: layerIndex * 0.04 }
                : cycleBounce
            }
          >
            <QuestionCardIcon className="h-auto w-full drop-shadow-lg" />
          </motion.div>
        )
      })}
    </div>
  )
}
