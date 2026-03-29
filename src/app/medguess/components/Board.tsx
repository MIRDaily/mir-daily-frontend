'use client'

import { motion } from 'framer-motion'
import { Tile } from './Tile'
import type { MedGuessAttemptRow } from '../types/medguess'
import {
  MEDGUESS_ATTEMPT_LENGTH,
  MEDGUESS_MAX_ATTEMPTS,
} from '../types/medguess'

type BoardProps = {
  attempts: MedGuessAttemptRow[]
  currentGuess: string
  processingGuess?: string
  processingRowIndex?: number | null
  processingCycle?: number
  processingIncorrectGlow?: boolean
  revealingRowIndex: number | null
  revealCycle: number
  isProcessingAttempt?: boolean
  gameEnded: boolean
  gameStatus: 'playing' | 'won' | 'lost'
}

const rowTransition = {
  type: 'spring',
  stiffness: 280,
  damping: 30,
} as const

export function Board({
  attempts,
  currentGuess,
  processingGuess = '',
  processingRowIndex = null,
  processingCycle = 0,
  processingIncorrectGlow = false,
  revealingRowIndex,
  revealCycle,
  isProcessingAttempt = false,
  gameEnded,
  gameStatus,
}: BoardProps) {
  const rows = Array.from({ length: MEDGUESS_MAX_ATTEMPTS }, (_, index) => {
    const attempt = attempts[index]
    const isActiveRow = !attempt && index === attempts.length
    const isProcessingRow = isProcessingAttempt && processingRowIndex === index
    const letters = (attempt?.guess ?? (isProcessingRow ? processingGuess : isActiveRow ? currentGuess : ''))
      .padEnd(MEDGUESS_ATTEMPT_LENGTH)
      .slice(0, MEDGUESS_ATTEMPT_LENGTH)
      .split('')

    return {
      index,
      attempt,
      letters,
      isActiveRow,
      isProcessingRow,
    }
  })

  const boardAnimation =
    gameStatus === 'won'
      ? { scale: [1, 1.02, 1] }
      : gameStatus === 'lost'
        ? { x: [0, -6, 6, -4, 4, 0] }
        : { scale: 1, x: 0 }

  return (
    <motion.div
      className="grid gap-2.5 sm:gap-3"
      animate={boardAnimation}
      transition={{ duration: 0.36, ease: 'easeInOut' }}
    >
      {rows.map((row) => {
        const isProcessingRow = row.isProcessingRow && !row.attempt
        const isRevealRow = revealingRowIndex === row.index && Boolean(row.attempt)
        return (
        <motion.div
          key={row.index}
          className="grid grid-cols-5 gap-2.5 sm:gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={
            isProcessingRow
              ? { opacity: [1, 0.9, 1], y: [0, -1, 0] }
              : isRevealRow
                ? { opacity: 1, y: [0, -8, 0], scale: [1, 1.02, 1] }
                : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            isProcessingRow
              ? {
                  type: 'tween',
                  ease: 'easeInOut',
                  duration: 0.6,
                  repeat: Infinity,
                }
              : isRevealRow
                ? {
                    type: 'tween',
                    ease: [0.22, 1, 0.36, 1],
                    duration: 0.42,
                  }
              : {
                  ...rowTransition,
                  delay: row.index * 0.04,
                }
          }
        >
          {row.letters.map((letter, letterIndex) => {
            const shouldReveal = revealingRowIndex === row.index && Boolean(row.attempt)
            const status = row.attempt?.result[letterIndex]
            const sealed = gameEnded && !row.attempt
            return (
              <Tile
                key={`${row.index}-${letterIndex}-${revealCycle}-${isProcessingRow ? processingCycle : 0}`}
                letter={letter.trim()}
                status={status}
                shouldReveal={shouldReveal}
                processing={isProcessingRow}
                processingOrder={letterIndex}
                processingIncorrectGlow={processingIncorrectGlow && isProcessingRow}
                sealed={sealed}
                delayMs={letterIndex * 120}
              />
            )
          })}
        </motion.div>
      )})}
    </motion.div>
  )
}
