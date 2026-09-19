'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ZoomableImage } from '@/components/simulacro/QuestionImage'
import SaveToDeckButton from '@/components/simulacro/SaveToDeckButton'
import HighlightableStatement from '@/components/simulacro/HighlightableStatement'
import SaveQuestionsToDeck from '@/components/simulacro/SaveQuestionsToDeck'
import type {
  SimulacroAnswer,
  SimulacroQuestion,
  SimulacroResult,
} from '@/lib/simulacro/types'

type SimulacroResultsGridProps = {
  questions: SimulacroQuestion[]
  answers: SimulacroAnswer[]
  results: (SimulacroResult | null)[]
  /** Subrayado del enunciado, por índice de pregunta: el de la sesión en curso
   *  o, en el historial, el que se guardó al finalizar. */
  highlights?: Record<number, ReadonlySet<number>>
  onRestart: () => void
}

type Status = 'correct' | 'incorrect' | 'empty' | 'annulled'

function statusOf(
  answer: SimulacroAnswer | undefined,
  result: SimulacroResult | null | undefined,
): Status {
  // Anulada en el MIR: no puntúa, respondiera lo que respondiera.
  if (result?.anulada) return 'annulled'
  const selected = answer?.selectedIndex ?? null
  if (selected == null) return 'empty'
  if (!result) return 'incorrect'
  return selected === result.correctIndex ? 'correct' : 'incorrect'
}

const CELL_STYLE: Record<Status, string> = {
  correct: 'bg-[#8BA888] text-white',
  incorrect: 'bg-[#C4655A] text-white',
  empty: 'bg-[#EDE8E5] text-[#7D8A96]',
  // Rayado: se distingue del blanco sin depender solo del color.
  annulled:
    'bg-[repeating-linear-gradient(135deg,#EDE6F3_0,#EDE6F3_4px,#DCD0E8_4px,#DCD0E8_8px)] text-[#6B5A80]',
}

type Filter = 'all' | Status

const FILTERS: ReadonlyArray<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'incorrect', label: 'Fallos' },
  { value: 'empty', label: 'En blanco' },
  { value: 'correct', label: 'Aciertos' },
  { value: 'annulled', label: 'Anuladas' },
]

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
    label: 'En blanco',
    icon: 'radio_button_unchecked',
    chip: 'bg-[#EDE8E5] text-[#7D8A96]',
    bar: 'bg-[#C9C2BC]',
  },
  annulled: {
    label: 'Anulada',
    icon: 'do_not_disturb_on',
    chip: 'bg-[#EDE6F3] text-[#6B5A80]',
    bar: 'bg-[#B9A6CF]',
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
  highlights,
  onRestart,
}: SimulacroResultsGridProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  // Dirección del último desplazamiento, para animar la entrada/salida.
  const [direction, setDirection] = useState(0)
  // Panel lateral de imagen visible (se reinicia al cambiar de pregunta).
  const [showImage, setShowImage] = useState(false)
  // Pista de "barra espaciadora": solo la primera vez que aparece una pregunta con imagen.
  const [playHint, setPlayHint] = useState(false)
  const hintPlayed = useRef(false)

  const openAt = useCallback((index: number) => {
    setDirection(0)
    setShowImage(false)
    setActiveIndex(index)
  }, [])

  // Dispara la pista de barra espaciadora la primera vez que se ve una pregunta con imagen.
  useEffect(() => {
    if (activeIndex == null) return
    const q = questions[activeIndex]
    if (q?.has_image && q?.image_url && !hintPlayed.current) {
      hintPlayed.current = true
      setPlayHint(true)
    }
  }, [activeIndex, questions])

  const statuses = useMemo(
    () => questions.map((_, i) => statusOf(answers[i], results[i])),
    [questions, answers, results],
  )

  const stats = useMemo(() => {
    const count = { correct: 0, incorrect: 0, empty: 0, annulled: 0 }
    for (const s of statuses) count[s] += 1
    // Las anuladas no puntúan: el total y el % son sobre las puntuables (igual
    // que el historial, ver sql/2026-09-simulacro-anuladas.sql).
    const total = statuses.length - count.annulled
    const pct = total > 0 ? Math.round((count.correct / total) * 100) : 0
    return { ...count, total, pct }
  }, [statuses])

  // Filtros del repaso: por resultado y por asignatura. Numeración original.
  const [filter, setFilter] = useState<Filter>('all')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const subjects = useMemo(
    () =>
      [...new Set(questions.map((q) => q.subject).filter((s): s is string => Boolean(s)))].sort(
        (a, b) => a.localeCompare(b, 'es'),
      ),
    [questions],
  )
  const visibleIndexes = useMemo(
    () =>
      questions
        .map((q, i) => i)
        .filter(
          (i) =>
            (filter === 'all' || statuses[i] === filter) &&
            (subjectFilter === 'all' || questions[i].subject === subjectFilter),
        ),
    [questions, statuses, filter, subjectFilter],
  )
  const activePos = activeIndex != null ? visibleIndexes.indexOf(activeIndex) : -1

  // El detalle navega dentro de lo filtrado: con "Fallos" puesto, las flechas
  // pasan de fallo en fallo.
  const navigate = useCallback(
    (delta: number) => {
      setActiveIndex((prev) => {
        if (prev == null) return prev
        const pos = visibleIndexes.indexOf(prev)
        const next = pos < 0 ? undefined : visibleIndexes[pos + delta]
        if (next == null) return prev
        setDirection(delta)
        setShowImage(false)
        setPlayHint(false)
        return next
      })
    },
    [visibleIndexes],
  )

  // Flechas del teclado y Escape mientras el detalle está abierto.
  useEffect(() => {
    if (activeIndex == null) return
    const onKeyDown = (e: KeyboardEvent) => {
      // Escribiendo el nombre de un mazo nuevo, flechas y espacio son texto.
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') navigate(1)
      else if (e.key === 'ArrowLeft') navigate(-1)
      else if (e.key === 'Escape') setActiveIndex(null)
      else if (e.key === ' ' || e.key === 'Spacebar') {
        const q = questions[activeIndex]
        if (q?.has_image && q?.image_url) {
          e.preventDefault()
          setShowImage((v) => !v)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, navigate, questions])

  // Lo que se guarda con "Guardar falladas" (anuladas fuera: no son fallos).
  const failedIds = useMemo(
    () => questions.filter((_, i) => statuses[i] === 'incorrect').map((q) => String(q.id)),
    [questions, statuses],
  )
  const blankIds = useMemo(
    () => questions.filter((_, i) => statuses[i] === 'empty').map((q) => String(q.id)),
    [questions, statuses],
  )

  const activeQuestion = activeIndex != null ? questions[activeIndex] : null
  const activeAnswer = activeIndex != null ? answers[activeIndex] : undefined
  const activeResult = activeIndex != null ? results[activeIndex] : null
  const activeStatus: Status = activeQuestion
    ? statusOf(activeAnswer, activeResult)
    : 'empty'

  return (
    <div className="mx-auto w-full max-w-3xl">
      <motion.header
        className="relative mb-6 overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-gradient-to-br from-white via-[#FFFBFA] to-[#FFF2ED] px-6 py-7 sm:px-9"
        style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
          <ScoreRing pct={stats.pct} />
          <div className="min-w-0 text-center sm:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E8A598]/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#d18d80]">
              <span className="material-symbols-outlined text-sm">task_alt</span>
              Simulacro completado
            </span>
            <h1 className="mt-3 text-3xl font-black leading-none tracking-tight text-[#2c3e50] sm:text-4xl">
              {stats.correct} / {stats.total}
            </h1>
            <p className="mt-2 text-base font-light text-[#7D8A96]">
              {scoreMessage(stats.pct)}
            </p>
            {stats.annulled > 0 ? (
              <p className="mt-1 text-xs font-semibold text-[#6B5A80]">
                {stats.annulled === 1
                  ? '1 pregunta anulada no puntúa.'
                  : `${stats.annulled} preguntas anuladas no puntúan.`}
              </p>
            ) : null}
          </div>
        </div>
      </motion.header>

      {/* Resumen */}
      <div className={`mb-6 grid gap-3 ${stats.annulled > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {[
          { v: stats.correct, label: 'Aciertos', color: '#8BA888', text: '#5f7d5c' },
          { v: stats.incorrect, label: 'Fallos', color: '#C4655A', text: '#C4655A' },
          { v: stats.empty, label: 'En blanco', color: '#7D8A96', text: '#7D8A96' },
          ...(stats.annulled > 0
            ? [{ v: stats.annulled, label: 'Anuladas', color: '#B9A6CF', text: '#6B5A80' }]
            : []),
        ].map((box, i) => (
          <motion.div
            key={box.label}
            className="rounded-2xl border-2 border-[#2c3e50] bg-white p-4 text-center"
            style={{ boxShadow: `4px 4px 0 0 ${box.color}` }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.35, ease: 'easeOut' }}
          >
            <p className="text-3xl font-black tabular-nums" style={{ color: box.text }}>
              {box.v}
            </p>
            <p className="text-[11px] font-black uppercase tracking-wide text-[#7D8A96]">
              {box.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Grid de preguntas */}
      <div
        className="rounded-3xl border-2 border-[#2c3e50] bg-white p-6"
        style={{ boxShadow: '5px 5px 0 0 #2c3e50' }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="mb-1 text-lg font-black text-[#2c3e50]">Repaso de preguntas</h3>
            <p className="text-xs text-[#7D8A96]">
              Toca una pregunta para ver la respuesta correcta y su explicación.
            </p>
          </div>
          <SaveQuestionsToDeck failedIds={failedIds} blankIds={blankIds} />
        </div>

        {/* Filtros: por resultado (con su cuenta) y por asignatura */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.filter((f) => f.value !== 'annulled' || stats.annulled > 0).map((f) => {
            const n = f.value === 'all' ? statuses.length : stats[f.value]
            const active = filter === f.value
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                aria-pressed={active}
                className={`rounded-full border-2 px-3 py-1 text-xs font-black transition-all ${
                  active
                    ? 'border-[#2c3e50] bg-[#2c3e50] text-white'
                    : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2c3e50]'
                }`}
              >
                {f.label}
                <span className={`ml-1.5 tabular-nums ${active ? 'text-white/70' : 'text-[#7D8A96]/60'}`}>
                  {n}
                </span>
              </button>
            )
          })}
          {subjects.length > 1 ? (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Filtrar por asignatura"
              className="ml-auto max-w-full rounded-full border-2 border-[#EAE4E2] bg-white px-3 py-1 text-xs font-bold text-[#2c3e50] outline-none transition-colors hover:border-[#2c3e50] focus:border-[#2c3e50]"
            >
              <option value="all">Todas las asignaturas</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {visibleIndexes.length === 0 ? (
          <p className="rounded-2xl bg-[#FAF7F4] px-4 py-6 text-center text-sm font-semibold text-[#7D8A96]">
            Ninguna pregunta con este filtro.
          </p>
        ) : null}
        <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
          {visibleIndexes.map((i) => {
            const question = questions[i]
            const status = statuses[i]
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => openAt(i)}
                className={`group relative flex h-10 items-center justify-center rounded-lg border-2 border-[#2c3e50] text-xs font-black transition-transform hover:-translate-y-0.5 ${CELL_STYLE[status]}`}
                aria-label={`Pregunta ${i + 1}`}
              >
                {i + 1}
                <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max -translate-x-1/2 -translate-y-full rounded-lg bg-[#2c3e50] px-2 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  Pregunta {i + 1} · {STATUS_META[status].label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="mt-5 flex flex-wrap gap-4 text-xs font-bold text-[#7D8A96]">
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border-2 border-[#2c3e50] bg-[#8BA888]" /> Acierto
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border-2 border-[#2c3e50] bg-[#C4655A]" /> Fallo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3.5 w-3.5 rounded border-2 border-[#2c3e50] bg-[#EDE8E5]" /> En blanco
          </span>
          {stats.annulled > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className={`h-3.5 w-3.5 rounded border-2 border-[#2c3e50] ${CELL_STYLE.annulled}`} /> Anulada
              (no puntúa)
            </span>
          ) : null}
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRestart}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-6 py-3.5 text-base font-black text-white transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
        >
          <span className="material-symbols-outlined">replay</span>
          Crear otro simulacro
        </button>
        <Link
          href="/studio"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-white px-6 py-3.5 text-base font-bold text-[#7D8A96] transition-all hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2C3E50]"
        >
          Volver a Studio
        </Link>
      </div>

      {/* Modal de detalle. Va en un portal a <body>: las páginas que usan la
          rejilla envuelven el contenido en un <main relative z-10>, y dentro
          de ese contexto el z-50 del modal quedaba por DEBAJO de la cabecera
          global (sticky z-50), que tapaba la parte de arriba del detalle. */}
      {typeof document !== 'undefined' ? createPortal(
      <AnimatePresence>
        {activeQuestion ? (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[#2D3748]/40 p-4 backdrop-blur-sm sm:items-center"
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
              disabled={activePos <= 0}
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
              disabled={activePos < 0 || activePos >= visibleIndexes.length - 1}
              className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#F0EBE8] bg-white text-[#7D8A96] shadow-md transition-all hover:bg-[#FAF7F4] hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30 sm:right-6 md:right-10"
              aria-label="Pregunta siguiente"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>

            <div className="flex items-center justify-center gap-4">
            <motion.div
              layout
              className="relative z-10 flex max-h-[85vh] w-[42rem] max-w-[92vw] flex-col overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
              style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
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
                <div className="flex shrink-0 items-center gap-1">
                  {/* Guardar desde el repaso: es justo cuando se ve el fallo
                      y se decide que hay que volver a ella (como en la app). */}
                  <SaveToDeckButton questionId={activeQuestion.id} />
                  <button
                    type="button"
                    onClick={() => setActiveIndex(null)}
                    className="rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#C4655A]"
                    aria-label="Cerrar"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
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
                    <h2 className="mb-4 text-xl font-black leading-snug text-[#2C3E50]">
                      {/* Con lo que se subrayó al responder, en solo lectura. */}
                      {highlights?.[activeIndex ?? -1]?.size ? (
                        <HighlightableStatement
                          text={activeQuestion.statement}
                          highlighted={highlights[activeIndex ?? -1]}
                        />
                      ) : (
                        activeQuestion.statement
                      )}
                    </h2>

                    {activeQuestion.has_image && activeQuestion.image_url ? (
                      <div className="mb-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowImage((v) => !v)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Spacebar') e.preventDefault()
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#E8A598]/40 bg-white px-4 py-2.5 text-sm font-bold text-[#d18d80] transition-colors hover:bg-[#fff0ec]"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showImage ? 'visibility_off' : 'image'}
                          </span>
                          {showImage ? 'Ocultar imagen' : 'Ver imagen'}
                        </button>
                        {playHint ? (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
                            transition={{
                              duration: 3,
                              times: [0, 0.12, 0.33, 0.5, 0.66, 0.83, 1],
                              ease: 'easeInOut',
                            }}
                            onAnimationComplete={() => setPlayHint(false)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7D8A96]"
                          >
                            <span className="rounded border border-[#E9E4E1] bg-[#FAF7F4] px-1.5 py-0.5 font-mono text-[10px] text-[#2D3748]">
                              Espacio
                            </span>
                            Presiona barra espaciadora
                          </motion.span>
                        ) : null}
                      </div>
                    ) : null}

                    {activeStatus === 'annulled' ? <AnnulledNotice /> : null}

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
                            <span className="text-[#2C3E50]">{option}</span>
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

                    <div className="mt-5 rounded-2xl border-2 border-[#2c3e50] bg-[#FFFBFA] px-4 py-4" style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}>
                      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                        <span className="material-symbols-outlined text-base text-[#E8A598]">
                          lightbulb
                        </span>
                        Explicación
                      </p>
                      <p className="text-[15px] leading-relaxed text-[#2C3E50]">
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
                  disabled={activePos <= 0}
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
                  disabled={activePos < 0 || activePos >= visibleIndexes.length - 1}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-[#7D8A96] transition-colors hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Siguiente
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              </div>
            </motion.div>

            {/* Ventana lateral de imagen: emerge desde detrás de la tarjeta */}
            <AnimatePresence mode="popLayout">
              {showImage && activeQuestion.has_image && activeQuestion.image_url ? (
                <motion.div
                  key="image-panel"
                  className="relative z-0 flex max-h-[85vh] min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
                  initial={{ opacity: 0, x: -140, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -120, scale: 0.92 }}
                  transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#F0EBE8] px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                      <span className="material-symbols-outlined text-base text-[#E8A598]">
                        image
                      </span>
                      Imagen
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowImage(false)}
                      aria-label="Ocultar imagen"
                      className="rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#C4655A]"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="h-1 w-full bg-[#E8A598]" />
                  <div className="overflow-auto p-3">
                    <ZoomableImage
                      url={activeQuestion.image_url}
                      className="max-h-[68vh] w-auto max-w-[42vw] rounded-lg object-contain"
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      document.body,
      ) : null}
    </div>
  )
}

/** Aviso de pregunta anulada (en el detalle de resultados y en el runner). */
export function AnnulledNotice() {
  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border-2 border-[#B9A6CF]/60 bg-[#F6F2FA] px-4 py-3 text-sm text-[#5A4A6E]">
      <span className="material-symbols-outlined mt-px text-lg text-[#8C76A8]">do_not_disturb_on</span>
      <p>
        <span className="font-black">Pregunta anulada en el MIR.</span> No puntúa: no cuenta ni como
        acierto, ni como fallo, ni como blanco.
      </p>
    </div>
  )
}

/** Anillo de puntuación: el remate visual del simulacro. */
function ScoreRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 44
  const color = pct >= 70 ? '#8BA888' : pct >= 40 ? '#C9A24A' : '#C4655A'

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="#EDE9E4" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct / 100) }}
          transition={{ duration: 0.9, delay: 0.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-black tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

function scoreMessage(pct: number): string {
  if (pct === 100) return 'Pleno. No has fallado ni una.'
  if (pct >= 70) return 'Buen resultado. Repasa los fallos y a por el siguiente.'
  if (pct >= 40) return 'Vas por buen camino: revisa las que fallaste.'
  return 'Toca repasar. Mira la explicación de cada fallo antes de repetir.'
}
