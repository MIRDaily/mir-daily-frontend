'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'

type ResultModalProps = {
  open: boolean
  status: 'won' | 'lost'
  answer: string | null
  explanation?: string | null
  username?: string | null
  avatarUrl?: string | null
  attemptsUsed: number
  openedCompletedGame: boolean
  onClose: () => void
}

export function ResultModal({
  open,
  status,
  answer,
  explanation = null,
  username = null,
  avatarUrl = null,
  attemptsUsed,
  openedCompletedGame,
  onClose,
}: ResultModalProps) {
  const winVariants = ['Increíble', 'Perfecto', 'Dominado', 'Nivel MIR']
  const lossVariants = ['Casi...', 'Buen intento', 'Mañana lo clavas']
  const source = status === 'won' ? winVariants : lossVariants
  const seedText = `${username ?? ''}-${attemptsUsed}-${answer ?? ''}-${status}`
  let hash = 0
  for (let index = 0; index < seedText.length; index += 1) {
    hash = (hash * 31 + seedText.charCodeAt(index)) >>> 0
  }
  const emotionalTitle = source[hash % source.length]

  const title = status === 'won' ? 'Reto completado' : 'Intentos agotados'
  const subtitle =
    status === 'won'
      ? `Resolviste el reto en ${attemptsUsed} intentos.`
      : 'No pasa nada. Mañana tendrás un nuevo MedGuess.'

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#1C1C1A]/40 p-4 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="w-full max-w-md rounded-3xl border border-[#D7C2BE]/70 bg-[#FCF9F6] p-6 shadow-[0_22px_60px_rgba(82,67,65,0.26)]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7D8A96]">
                  {openedCompletedGame ? 'Ya jugado hoy' : 'Resultado diario'}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[#3F3432]">{title}</h2>
                <p className="mt-1 text-sm font-semibold text-[#865046]">{`¡${emotionalTitle}!`}</p>
                <p className="mt-2 text-sm text-[#57646F]">{subtitle}</p>
              </div>
            </div>

            {status === 'won' ? (
              <div className="mb-5 rounded-2xl border border-[#D7C2BE]/60 bg-white/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-[#D7C2BE] bg-[#F0EDEA]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Avatar"
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-[#7D8A96]">Enhorabuena</p>
                    <p className="text-base font-bold text-[#3F3432]">
                      {username ? `@${username}` : 'Usuario'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {answer ? (
              <div className="mb-5 rounded-2xl border border-[#E8A598]/55 bg-[#FBECE8] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#865046]/80">Palabra médica</p>
                <p className="mt-1 text-xl font-bold tracking-[0.08em] text-[#6A3930]">{answer}</p>
              </div>
            ) : null}

            {explanation ? (
              <div className="mb-5 rounded-2xl border border-[#D7C2BE]/60 bg-white/85 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#7D8A96]">Explicación</p>
                <p className="mt-1 text-sm leading-relaxed text-[#3F3432]">{explanation}</p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl bg-[#E8A598] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#D79386]"
              >
                Ir al Daily
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#D7C2BE] px-4 py-3 text-center text-sm font-semibold text-[#7D8A96] transition hover:bg-[#F0EDEA]"
              >
                Volver a MedGuess
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
