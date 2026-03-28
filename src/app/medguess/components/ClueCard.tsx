'use client'

import { motion } from 'framer-motion'

type ClueCardProps = {
  clue: string
  title?: string
  revealIndex?: number
}

export function ClueCard({ clue, title = 'Pista médica', revealIndex = 0 }: ClueCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: 0.12 + revealIndex * 0.15, ease: 'easeInOut' }}
      className="relative overflow-hidden rounded-3xl border border-[#D7C2BE]/45 bg-white/80 p-5 shadow-[0_10px_30px_rgba(125,138,150,0.14)] sm:p-6"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#E8A598]/25 blur-2xl" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7D8A96]">{title}</p>
      <p className="text-base font-medium leading-relaxed text-[#3F3432] sm:text-lg">{clue}</p>
    </motion.section>
  )
}
