'use client'

import { motion } from 'framer-motion'

type WordProgressProps = {
  progressMasks: Array<Array<string | null>>
}

export function WordProgress({ progressMasks }: WordProgressProps) {
  const rows = progressMasks.length > 0 ? progressMasks : [[]]
  const isLetter = (value: string | null) =>
    typeof value === 'string' && /[A-Z\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1]/.test(value)
  const splitIntoWords = (mask: Array<string | null>) => {
    const words: Array<Array<string | null>> = []
    let current: Array<string | null> = []

    mask.forEach((char) => {
      if (char === ' ') {
        if (current.length > 0) words.push(current)
        current = []
        return
      }
      current.push(char)
    })

    if (current.length > 0) words.push(current)
    return words
  }

  return (
    <section className="rounded-2xl border border-[#D7C2BE]/45 bg-[#F6F3F0] p-4 text-center sm:p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7D8A96]">
        Término médico del día
      </p>
      <div className="space-y-2.5">
        {rows.map((progressMask, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap justify-center gap-8 sm:gap-12">
            {splitIntoWords(progressMask).map((word, wordIndex) => (
              <div key={`${rowIndex}-word-${wordIndex}`} className="flex whitespace-nowrap gap-2 sm:gap-2.5">
                {word.map((char, charIndex) => (
                  <motion.div
                    key={`${rowIndex}-${wordIndex}-${charIndex}-${char ?? 'empty'}`}
                    initial={isLetter(char) ? { scale: 0.8, opacity: 0 } : false}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    className={`tile flex h-11 w-9 items-center justify-center rounded-lg border text-sm font-bold uppercase tracking-[0.06em] sm:h-12 sm:w-10 sm:text-base ${
                      isLetter(char)
                        ? 'border-[#E8A598]/45 bg-[#E8A598] text-[#6A3930]'
                        : 'border-[#D7C2BE] bg-[#FCF9F6] text-[#9E8F8B]'
                    }`}
                  >
                    {char ?? ''}
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
