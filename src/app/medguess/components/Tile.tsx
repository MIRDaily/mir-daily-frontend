'use client'

import { motion } from 'framer-motion'
import type { TileFeedback } from '../types/medguess'

type TileProps = {
  letter: string
  status?: TileFeedback
  shouldReveal: boolean
  processing?: boolean
  processingOrder?: number
  processingIncorrectGlow?: boolean
  sealed?: boolean
  delayMs?: number
}

function getTileTone(status?: TileFeedback, hasLetter?: boolean, sealed?: boolean) {
  if (sealed && !hasLetter) {
    return 'border-[#B9A9A6] bg-[#EEE8E6] text-[#B9A9A6]'
  }
  if (status === 'correct') {
    return 'border-[#8BA888]/45 bg-[#A0BD9C] text-[#334D33] shadow-[0_8px_24px_rgba(139,168,136,0.2)]'
  }
  if (status === 'present') {
    return 'border-[#8BA888]/45 bg-[#A0BD9C] text-[#334D33] shadow-[0_8px_24px_rgba(139,168,136,0.2)]'
  }
  if (status === 'absent') {
    return 'border-[#1D2430] bg-[#1C2430] text-[#CBD5E1]'
  }
  if (hasLetter) {
    return 'border-[#C7B6B2] bg-[#F0EDEA] text-[#524341]'
  }
  return 'border-[#E5E2DF] bg-white text-[#B3A3A0]'
}

export function Tile({
  letter,
  status,
  shouldReveal,
  processing = false,
  processingOrder = 0,
  processingIncorrectGlow = false,
  sealed = false,
  delayMs = 0,
}: TileProps) {
  const hasLetter = Boolean(letter)

  const toneClass = getTileTone(status, hasLetter, sealed)
  const processingGlowToneClass =
    processing && hasLetter && processingIncorrectGlow
      ? 'text-[#D98C7E]'
      : ''
  const showSeal = sealed && !hasLetter
  const feedbackAnimation =
    shouldReveal && status === 'correct'
      ? { scale: [1, 1.08, 1] }
      : shouldReveal && status === 'present'
        ? { x: [0, -4, 4, -2, 2, 0] }
        : shouldReveal && status === 'absent'
          ? { opacity: [0.55, 1], scale: [0.95, 1] }
          : {}
  const processingAnimation =
    processing && hasLetter
      ? {
          y: [0, -18, 0, 8, 0],
          scaleX: [1, 1.18, 0.92, 1.08, 1],
          scaleY: [1, 0.82, 1.12, 0.92, 1],
          rotate: [0, -2, 2, -1, 0],
        }
      : {}
  const activeAnimation =
    shouldReveal
      ? { rotateX: 0, opacity: 1, ...feedbackAnimation }
      : processing && hasLetter && processingIncorrectGlow
        ? {
            opacity: [1, 1, 1],
            scale: [1, 1.04, 1],
            borderColor: ['#C7B6B2', '#E8A598', '#C7B6B2'],
            backgroundColor: ['#F0EDEA', '#FBECE8', '#F0EDEA'],
          }
      : processing && hasLetter
        ? { opacity: 1, ...processingAnimation }
        : undefined

  return (
    <motion.div
      className="relative aspect-square w-full"
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 440, damping: 28 }}
    >
      <motion.div
        className={`relative flex h-full w-full items-center justify-center rounded-xl border text-lg font-bold uppercase tracking-[0.08em] ${toneClass} ${processingGlowToneClass}`}
        initial={shouldReveal ? { rotateX: 90, opacity: 0.7 } : false}
        animate={activeAnimation}
        transition={{
          duration: shouldReveal ? 0.36 : processingIncorrectGlow ? 0.42 : 0.55,
          ease: 'easeInOut',
          delay: shouldReveal
            ? delayMs / 1000
            : processingIncorrectGlow
              ? 0
              : processing && hasLetter
                ? processingOrder * 0.08
                : 0,
          repeat:
            !shouldReveal && processing && hasLetter && !processingIncorrectGlow ? Infinity : 0,
        }}
      >
        {showSeal ? '×' : letter || ''}
      </motion.div>
    </motion.div>
  )
}
