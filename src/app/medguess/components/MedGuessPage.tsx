'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useProfile } from '@/hooks/useProfile'
import { getAvatarUrl, getSafeAvatarId } from '@/lib/avatar'
import { useMedGuess } from '../hooks/useMedGuess'
import { Board } from './Board'
import { ClueCard } from './ClueCard'
import { Keyboard } from './Keyboard'
import { ResultModal } from './ResultModal'
import { WordProgress } from './WordProgress'
import {
  MEDGUESS_ATTEMPT_LENGTH,
  MEDGUESS_MAX_ATTEMPTS,
} from '../types/medguess'

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="h-24 animate-pulse rounded-3xl border border-[#D7C2BE]/50 bg-[#F6F3F0]" />
      <div className="grid gap-2.5">
        {Array.from({ length: MEDGUESS_MAX_ATTEMPTS }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: MEDGUESS_ATTEMPT_LENGTH }).map((_, tileIndex) => (
              <div
                key={`${rowIndex}-${tileIndex}`}
                className="aspect-square animate-pulse rounded-xl border border-[#D7C2BE]/45 bg-[#F6F3F0]"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MedGuessPage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [dismissedForStatus, setDismissedForStatus] = useState<'won' | 'lost' | null>(null)
  const {
    category,
    clue,
    cluesUnlocked,
    wordLength,
    attempts,
    attemptsUsed,
    gameStatus,
    answer,
    explanation,
    openedCompletedGame,
    currentGuess,
    processingGuess,
    processingRowIndex,
    processingCycle,
    processingIncorrectGlow,
    loading,
    submitting,
    resultAnimating,
    error,
    keyStatuses,
    progressMasks,
    revealingRowIndex,
    revealCycle,
    isInputBlocked,
    setGuess,
    appendGuessCharacter,
    removeGuessCharacter,
    submitGuess,
  } = useMedGuess()

  const canSubmitGuess = currentGuess.length === MEDGUESS_ATTEMPT_LENGTH && !isInputBlocked
  const showResultModal =
    gameStatus !== 'playing' &&
    dismissedForStatus !== gameStatus
  const avatarUrl =
    profile && typeof profile.avatar_id === 'number'
      ? getAvatarUrl(getSafeAvatarId(profile.avatar_id))
      : null
  const username = profile?.username || profile?.display_name || null
  const glowAnimation =
    gameStatus === 'won'
      ? { opacity: [0.22, 0.45, 0.22] }
      : { opacity: 0.22 }
  const visibleClues =
    cluesUnlocked.length > 0 ? cluesUnlocked : [clue || 'Sin pista disponible.']

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeInOut',
        staggerChildren: 0.08,
      },
    },
  } as const

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeInOut' } },
  } as const

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAF7F4] text-[#1C1C1A]">
      <div className="pointer-events-none absolute inset-0 [background:radial-gradient(circle_at_18%_14%,rgba(232,165,152,0.16),transparent_36%),radial-gradient(circle_at_83%_18%,rgba(139,168,136,0.12),transparent_34%),radial-gradient(circle_at_52%_82%,rgba(212,225,239,0.26),transparent_36%)]" />
      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(139,168,136,0.25),transparent_45%)]"
        animate={glowAnimation}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-8 pt-6 sm:px-6">
        <motion.header
          className="mb-5 flex items-center justify-between"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full border border-[#D7C2BE] bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#524341] transition hover:bg-white"
          >
            Atrás
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[#865046]">MedGuess</h1>
            <p className="text-xs uppercase tracking-[0.14em] text-[#7D8A96]">Reto diario</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-full border border-[#D7C2BE] bg-white/85 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#524341] transition hover:bg-white"
          >
            Daily
          </Link>
        </motion.header>

        {loading ? (
          <LoadingState />
        ) : (
          <motion.main
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-1 flex-col gap-4"
          >
            <motion.div variants={itemVariants}>
              <WordProgress progressMasks={progressMasks} />
            </motion.div>
            <motion.div
              variants={itemVariants}
              className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-start xl:gap-6"
            >
              <motion.div variants={itemVariants} className="space-y-4">
                <section className="rounded-3xl border border-[#D7C2BE]/50 bg-white/75 p-3.5 sm:p-4">
                  <Board
                    attempts={attempts}
                    currentGuess={currentGuess}
                    processingGuess={processingGuess}
                    processingRowIndex={processingRowIndex}
                    processingCycle={processingCycle}
                    processingIncorrectGlow={processingIncorrectGlow}
                    revealingRowIndex={revealingRowIndex}
                    revealCycle={revealCycle}
                    isProcessingAttempt={submitting && !resultAnimating}
                    gameEnded={gameStatus !== 'playing'}
                    gameStatus={gameStatus}
                  />
                </section>
              </motion.div>

              <motion.div variants={itemVariants} className="space-y-4 xl:sticky xl:top-24 xl:ml-1">
                <section className="rounded-3xl border border-[#D7C2BE]/50 bg-white/75 p-3.5 sm:p-4">
                  <form
                    className="mb-3 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void submitGuess()
                    }}
                  >
                    <input
                      type="text"
                      value={currentGuess}
                      onChange={(event) => setGuess(event.target.value)}
                      placeholder="Palabra de 5 letras"
                      disabled={isInputBlocked}
                      className="h-11 flex-1 rounded-xl border border-[#D7C2BE] bg-[#FCF9F6] px-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#3F3432] outline-none transition placeholder:text-[#9E8F8B] focus:border-[#E8A598]"
                    />
                    <motion.button
                      type="button"
                      onClick={removeGuessCharacter}
                      disabled={isInputBlocked || currentGuess.length === 0}
                      whileTap={{ scale: 0.96 }}
                      className="h-11 rounded-xl border border-[#D7C2BE] bg-[#FCF9F6] px-3 text-sm font-semibold text-[#524341] transition hover:bg-[#F0EDEA] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Borrar
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={!canSubmitGuess}
                      whileTap={{ scale: 0.96 }}
                      whileHover={{ scale: 1.03 }}
                      className="h-11 rounded-xl bg-[#E8A598] px-4 text-sm font-semibold text-white transition hover:bg-[#D79386] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Enviar
                    </motion.button>
                  </form>

                  <Keyboard
                    onCharacter={appendGuessCharacter}
                    keyStatuses={keyStatuses}
                    disabled={isInputBlocked}
                  />
                </section>

                <section className="rounded-3xl border border-[#E8A598]/55 bg-[#FBECE8] p-3.5 sm:p-4">
                  <motion.section
                    className="relative overflow-hidden rounded-3xl border border-[#E8A598]/55 bg-[#FBECE8] p-5 shadow-[0_10px_30px_rgba(232,165,152,0.2)] sm:p-6"
                    animate={{ scale: [1, 1.015, 1], opacity: [0.96, 1, 0.96] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#E8A598]/30 blur-2xl" />
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7D8A96]">
                      CATEGORÍA
                    </p>
                    <p className="text-base font-medium leading-relaxed text-[#3F3432] sm:text-lg">
                      {(category || 'Sin categoría').toUpperCase()}
                    </p>
                  </motion.section>
                </section>

                <section className="rounded-3xl border border-[#D7C2BE]/50 bg-white/75 p-3.5 sm:p-4">
                  <div className="space-y-3">
                    {visibleClues.map((visibleClue, index) => (
                      <ClueCard
                        key={`${index}-${visibleClue}`}
                        clue={visibleClue}
                        title={index === 0 ? 'Pista médica' : `Pista ${index + 1}`}
                        revealIndex={index}
                      />
                    ))}
                  </div>
                </section>
              </motion.div>
            </motion.div>
          </motion.main>
        )}

        <AnimatePresence>
          {resultAnimating && !loading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4"
            >
              <div className="rounded-full border border-[#D7C2BE] bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#865046] shadow-[0_8px_24px_rgba(82,67,65,0.18)]">
                Revelando resultado...
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 bottom-5 z-30 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-[#E8A598]/65 bg-[#FFF2EF] px-4 py-3 text-sm text-[#7F3D33]"
          >
            <p className="line-clamp-2 text-center">{error}</p>
          </motion.div>
        ) : null}
      </div>

      <ResultModal
        open={showResultModal}
        status={gameStatus === 'won' ? 'won' : 'lost'}
        answer={answer}
        explanation={explanation}
        username={username}
        avatarUrl={avatarUrl}
        attemptsUsed={attemptsUsed}
        openedCompletedGame={openedCompletedGame}
        onClose={() =>
          setDismissedForStatus(gameStatus === 'playing' ? null : gameStatus)
        }
      />

      {wordLength > 0 ? (
        <span className="sr-only">{`Longitud de la palabra: ${wordLength}`}</span>
      ) : null}
    </div>
  )
}
