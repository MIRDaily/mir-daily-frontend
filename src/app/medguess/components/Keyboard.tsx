'use client'

import { motion } from 'framer-motion'
import type { TileFeedback } from '../types/medguess'

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

type KeyboardProps = {
  onCharacter: (character: string) => void
  keyStatuses: Record<string, TileFeedback>
  disabled: boolean
}

function getKeyTone(status?: TileFeedback) {
  if (status === 'correct') {
    return 'border-[#8BA888]/40 bg-[#A0BD9C] text-[#334D33]'
  }
  if (status === 'present') {
    return 'border-[#8BA888]/40 bg-[#A0BD9C] text-[#334D33]'
  }
  if (status === 'absent') {
    return 'border-[#1D2430] bg-[#1C2430] text-[#CBD5E1]'
  }
  return 'border-[#D7C2BE]/75 bg-[#F0EDEA] text-[#524341] hover:bg-[#EAE8E5]'
}

export function Keyboard({
  onCharacter,
  keyStatuses,
  disabled,
}: KeyboardProps) {
  return (
    <section className="space-y-2.5">
      {KEYBOARD_ROWS.map((row, index) => (
        <div
          key={row}
          className={`flex gap-1.5 sm:gap-2 ${index === 1 ? 'justify-center' : ''} ${
            index === 2 ? 'justify-center' : ''
          } ${index === 2 ? 'px-2 sm:px-3' : ''}`}
        >
          {row.split('').map((character) => (
            <motion.button
              key={character}
              type="button"
              disabled={disabled}
              onClick={() => onCharacter(character)}
              whileTap={{ scale: 0.9 }}
              className={`h-10 min-w-8 rounded-lg border px-2 text-sm font-semibold uppercase transition disabled:opacity-50 sm:h-11 sm:min-w-10 ${getKeyTone(
                keyStatuses[character],
              )}`}
            >
              {character}
            </motion.button>
          ))}
        </div>
      ))}
    </section>
  )
}
