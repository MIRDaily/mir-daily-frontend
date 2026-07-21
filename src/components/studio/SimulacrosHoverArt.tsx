'use client'

import { motion } from 'framer-motion'
import { ExamSheetIcon } from './ExamSheetIcon'
import { ExamSheetOutline } from './ExamSheetOutline'

const bounce = { type: 'spring', stiffness: 340, damping: 20, mass: 0.9 } as const

const singleVariants = {
  rest: { opacity: 0, x: '130%', rotate: 10 },
  hover: { opacity: 1, x: '0%', rotate: -4 },
}

export function SingleSheetArt({ hovered }: { hovered: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute right-8 top-1/2 z-0 hidden w-48 -translate-y-1/2 sm:block"
      initial="rest"
      animate={hovered ? 'hover' : 'rest'}
      exit="rest"
      variants={singleVariants}
      transition={bounce}
    >
      <ExamSheetIcon className="h-auto w-full drop-shadow-lg" />
    </motion.div>
  )
}

const fanOrigin = { transformOrigin: '82% 100%' }

export function StackedSheetsArt({ hovered }: { hovered: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-8 top-6 z-0 hidden aspect-[720/760] w-36 sm:block"
    >
      <motion.div
        className="absolute inset-0"
        style={fanOrigin}
        initial="rest"
        animate={hovered ? 'hover' : 'rest'}
        exit="rest"
        variants={{
          rest: { opacity: 0, x: '150%', y: 6, rotate: 6, scale: 0.8 },
          hover: { opacity: 0.5, x: '2%', y: 0, rotate: -30, scale: 0.8 },
        }}
        transition={{ ...bounce, delay: hovered ? 0.1 : 0 }}
      >
        <ExamSheetOutline className="h-auto w-full" />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        style={fanOrigin}
        initial="rest"
        animate={hovered ? 'hover' : 'rest'}
        exit="rest"
        variants={{
          rest: { opacity: 0, x: '140%', y: 4, rotate: 8, scale: 0.9 },
          hover: { opacity: 0.78, x: '1%', y: 0, rotate: -16, scale: 0.9 },
        }}
        transition={{ ...bounce, delay: hovered ? 0.05 : 0 }}
      >
        <ExamSheetOutline className="h-auto w-full" detail />
      </motion.div>

      <motion.div
        className="absolute inset-0"
        style={fanOrigin}
        initial="rest"
        animate={hovered ? 'hover' : 'rest'}
        exit="rest"
        variants={{
          rest: { opacity: 0, x: '130%', rotate: 10 },
          hover: { opacity: 1, x: '0%', rotate: -3 },
        }}
        transition={{ ...bounce, delay: hovered ? 0 : 0 }}
      >
        <ExamSheetIcon className="h-auto w-full drop-shadow-lg" />
      </motion.div>
    </div>
  )
}
