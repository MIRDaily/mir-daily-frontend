'use client'

// Contador de caracteres reutilizable (p. ej. "1.240/5.000"). Cambia de color
// al acercarse al límite y al superarlo.

import { FLASHCARD_CHARS_WARN_AT, MAX_FLASHCARD_CHARS } from '@/lib/flashcardTheme'

export default function CharCounter({
  length,
  max = MAX_FLASHCARD_CHARS,
  warnAt = FLASHCARD_CHARS_WARN_AT,
}: {
  length: number
  max?: number
  warnAt?: number
}) {
  const over = length > max
  const warn = !over && length >= warnAt
  return (
    <span
      className={`text-[11px] font-semibold tabular-nums ${
        over ? 'text-[#C4655A]' : warn ? 'text-[#C99A3A]' : 'text-slate-400'
      }`}
    >
      {length.toLocaleString('es-ES')}/{max.toLocaleString('es-ES')}
    </span>
  )
}
