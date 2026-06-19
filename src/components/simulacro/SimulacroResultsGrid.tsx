'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  SimulacroAnswer,
  SimulacroQuestion,
  SimulacroResult,
} from '@/lib/simulacro/types'

type SimulacroResultsGridProps = {
  questions: SimulacroQuestion[]
  answers: SimulacroAnswer[]
  results: (SimulacroResult | null)[]
  onRestart: () => void
}

type Status = 'correct' | 'incorrect' | 'empty'

function statusOf(
  answer: SimulacroAnswer | undefined,
  result: SimulacroResult | null | undefined,
): Status {
  const selected = answer?.selectedIndex ?? null
  if (selected == null) return 'empty'
  if (!result) return 'incorrect'
  return selected === result.correctIndex ? 'correct' : 'incorrect'
}

const CELL_STYLE: Record<Status, string> = {
  correct: 'bg-[#8BA888] text-white',
  incorrect: 'bg-[#C4655A] text-white',
  empty: 'bg-[#EDE8E5] text-[#7D8A96]',
}

const STATUS_META: Record<
  Status,
  { label: string; icon: string; chip: string; bar: string }
> = {
  correct: {
    label: 'Acierto',
    icon: 'check_circle',
    chip: 'bg-[#8BA888]/15 text-[#5f7d5c]',
    bar: 'bg-[#8BA888]',
  },
  incorrect: {
    label: 'Fallo',
    icon: 'cancel',
    chip: 'bg-[#C4655A]/10 text-[#C4655A]',
    bar: 'bg-[#C4655A]',
  },
  empty: {
    label: 'Sin responder',
    icon: 'radio_button_unchecked',
    chip: 'bg-[#EDE8E5] text-[#7D8A96]',
    bar: 'bg-[#C9C2BC]',
  },
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : dir < 0 ? -60 : 0,
    opacity: 0,
    scale: 0.92,
    filter: 'blur(10px)',
  }),
  center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : dir < 0 ? 60 : 0,
    opacity: 0,
    scale: 0.92,
    filter: 'blur(10px)',
  }),
}

// Curva con un punto de "rebote" suave para que la transición se sienta viva.
const morphTransition = {
  duration: 0.42,
  ease: [0.22, 1, 0.36, 1] as const,
  filter: { duration: 0.3 },
  opacity: { duration: 0.28 },
}

export default function SimulacroResultsGrid({
  questions,
  answers,
  results,
  onRestart,
}: SimulacroResultsGridProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // Dirección del último desplazamiento, para animar la entrada/salida.
  const [direction, setDirection] = useState(0)

  const openAt = useCallback((index: number) => {
    setDirection(0)
    setActiveIndex(index)
  }, [])

  const navigate = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        if (prev == null) return prev
        const next = prev + delta
        if (next < 0 || next >= questions.length) return prev
        setDirection(delta)
        return next
      })
    },
    [questions.length],
  )

  // Flechas del teclado y Escape mientras el detalle está abierto.
  useEffect(() => {
    if (activeIndex == null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate(1)
      else if (e.key === 'ArrowLeft') navigate(-1)
      else if (e.key === 'Escape') setActiveIndex(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, navigate])

  const stats = useMemo(() => {
    let correct = 0
    let incorrect = 0
    let empty = 0
    questions.forEach((_, i) => {
      const status = statusOf(answers[i], results[i])
      if (status === 'correct') correct += 1
      else if (status === 'incorrect') incorrect += 1
      else empty += 1
    })
    const total = questions.length
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0
    return { correct, incorrect, empty, total, pct }
  }, [questions, answers, results])

  const activeQuestion = activeIndex != null ? questions[activeIndex] : null
  const activeAnswer = activeIndex != null ? answers[activeIndex] : undefined
  const activeResult = activeIndex != null ? results[activeIndex] : null
  const activeStatus: Status = activeQuestion
    ? statusOf(activeAnswer, activeResult)
    : 'empty'

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E8A598]/30 bg-[#E8A598]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#d18d80]">
          <span className="material-symbols-outlined text-base">task_alt</span>
          Simulacro completado
        </span>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-[#2c3e50]">
          {stats.correct} / {stats.total} aciertos
        </h1>
        <p className="mt-2 text-base font-light text-[#7D8A96]">
          Has acertado el {stats.pct}% del simulacro.
        </p>
      </header>

      {/* Resumen */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#8BA888]/30 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#5f7d5c]">{stats.correct}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
            Aciertos
          </p>
        </div>
        <div className="rounded-xl border border-[#C4655A]/30 bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#C4655A]">{stats.incorrect}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
            Fallos
          </p>
        </div>
        <div className="rounded-xl border border-[#EAE4E2] bg-white p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#7D8A96]">{stats.empty}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7D8A96]">
            Sin responder
          </p>
        </div>
      </div>

      {/* Grid de preguntas */}
      <div className="rounded-2xl border border-[#F0EBE8] bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-bold text-[#374151]">Repaso de preguntas</h3>
        <p className="mb-4 text-xs text-[#7D8A96]">
          Toca una pregunta para ver la respuesta correcta y su explicación.
        </p>
        <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
          {questions.map((question, i) => {
            const status = statusOf(answers[i], results[i])
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => openAt(i)}
                className={`group relative flex h-9 items-center justify-center rounded-md text-xs font-bold transition-transform hover:scale-[1.06] ${CELL_STYLE[status]}`}
                aria-label={`Pregunta ${i + 1}`}
              >
                {i + 1}
                <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                  Pregunta {i + 1} ·{' '}
                  {status === 'correct'
                    ? 'Acierto'
                    : status === 'incorrect'
                      ? 'Fallo'
                      : 'Sin responder'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-5 flex flex-wrap gap-4 text-xs text-[#7D8A96]">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#8BA888]" /> Acierto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#C4655A]" /> Fallo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#EDE8E5]" /> Sin responder
          </span>
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRestart}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-6 py-3 text-base font-bold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
        >
          <span className="material-symbols-outlined">replay</span>
          Crear otro simulacro
        </button>
        <Link
          href="/studio"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#7D8A96]/30 bg-white px-6 py-3 text-base font-medium text-[#7D8A96] transition-colors hover:border-[#7D8A96]/50 hover:bg-[#F2EFED]"
        >
          Volver a Studio
        </Link>
      </div>

      {/* Modal de detalle */}
      <AnimatePresence>
        {activeQuestion ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D3748]/40 p-4 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveIndex(null)}
          >
            {/* Flecha anterior (lateral) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(-1)
              }}
              disabled={(activeIndex ?? 0) === 0}
              className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0EBE8] bg-white text-[#7D8A96] shadow-md transition-all hover:bg-[#FAF7F4] hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30 sm:left-6 md:left-10"
              aria-label="Pregunta anterior"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>

            {/* Flecha siguiente (lateral) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(1)
              }}
              disabled={(activeIndex ?? 0) === questions.length - 1}
              className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0EBE8] bg-white text-[#7D8A96] shadow-md transition-all hover:bg-[#FAF7F4] hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30 sm:right-6 md:right-10"
              aria-label="Pregunta siguiente"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>

            <motion.div
              layout
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#F0EBE8] bg-white shadow-xl"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.25, ease: 'easeOut', layout: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera fija: estado + cerrar */}
              <div className="flex items-center justify-between gap-3 border-b border-[#F0EBE8] px-6 py-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${STATUS_META[activeStatus].chip}`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {STATUS_META[activeStatus].icon}
                    </span>
                    {STATUS_META[activeStatus].label}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                    Pregunta {(activeIndex ?? 0) + 1} de {questions.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  className="rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#C4655A]"
                  aria-label="Cerrar"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              {/* Barra de color según estado */}
              <div className={`h-1 w-full ${STATUS_META[activeStatus].bar}`} />

              {/* Cuerpo con animación de morph entre tarjetas */}
              <div className="relative overflow-hidden">
                <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                  <motion.div
                    key={activeIndex}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={morphTransition}
                    className="max-h-[60vh] overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]"
                  >
                    {activeQuestion.subject ? (
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                        {activeQuestion.subject}
                      </p>
                    ) : null}
                    <h2 className="mb-4 text-xl font-bold leading-snug text-[#2D3748]">
                      {activeQuestion.statement}
                    </h2>

                    <div className="space-y-2">
                      {activeQuestion.options.map((option, optionIndex) => {
                        const isCorrect = optionIndex === (activeResult?.correctIndex ?? -1)
                        const isSelected = activeAnswer?.selectedIndex === optionIndex
                        return (
                          <div
                            key={`${activeQuestion.id}-detail-${optionIndex}`}
                            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                              isCorrect
                                ? 'border-[#8BA888]/50 bg-[#8BA888]/10'
                                : isSelected
                                  ? 'border-[#C4655A]/50 bg-[#FFF1EC]'
                                  : 'border-[#F0EAE6] bg-white'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                isCorrect
                                  ? 'bg-[#8BA888] text-white'
                                  : isSelected
                                    ? 'bg-[#C4655A] text-white'
                                    : 'bg-[#FAF7F4] text-[#7D8A96]'
                              }`}
                            >
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="text-[#4B5563]">{option}</span>
                            {isCorrect ? (
                              <span className="ml-auto rounded-full bg-[#8BA888]/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#5f7d5c]">
                                Correcta
                              </span>
                            ) : isSelected ? (
                              <span className="ml-auto rounded-full bg-[#C4655A]/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#C4655A]">
                                Tu respuesta
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-5 rounded-xl border border-[#F0EAE6] bg-[#FAF7F4] px-4 py-4">
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                        <span className="material-symbols-outlined text-base text-[#E8A598]">
                          lightbulb
                        </span>
                        Explicación
                      </p>
                      <p className="text-sm leading-relaxed text-[#4B5563]">
                        {activeResult?.explanation?.trim() ||
                          'No hay explicación disponible para esta pregunta.'}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Pie de navegación */}
              <div className="flex items-center justify-between gap-3 border-t border-[#F0EBE8] px-6 py-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={(activeIndex ?? 0) === 0}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  Anterior
                </button>
                <span className="text-xs text-[#7D8A96]">
                  Usa las flechas del teclado ← →
                </span>
                <button
                  type="button"
                  onClick={() => navigate(1)}
                  disabled={(activeIndex ?? 0) === questions.length - 1}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Siguiente
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
