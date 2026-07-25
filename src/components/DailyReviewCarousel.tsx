import { AnimatePresence, motion } from 'framer-motion'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ZoomableImage } from '@/components/simulacro/QuestionImage'

interface Question {
  reviewId?: string | number | null
  questionId?: string | number | null
  id: string
  category: string
  question: string
  correctAnswer: string | number | null
  selectedAnswer?: string | number | null
  isCorrect?: boolean | null
  /** 'blank' = el usuario dejó la pregunta en blanco (no puntúa ni penaliza). */
  result?: 'correct' | 'wrong' | 'blank' | null
  explanation: string
  hasImage?: boolean
  imageUrl?: string | null
  options: string[]
}

interface Props {
  questions: Question[]
}

function DailyReviewCarousel({ questions }: Props) {
  const [index, setIndex] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Imagen de la pregunta activa: oculta por defecto (evita tarjetas enormes y
  // scrollbars). Se muestra/oculta con el botón o la barra espaciadora y se
  // reinicia al cambiar de pregunta.
  const [imageShown, setImageShown] = useState(false)
  const total = questions.length
  const safeTotal = Math.max(total, 1)

  const getQuestionKey = useCallback((q: Question, i: number) =>
    String(q.reviewId ?? q.id ?? i), [])

  // Cada tarjeta conserva su propio scroll interno mientras permanece montada
  // (todas las preguntas se renderizan siempre, solo la activa es visible).
  // Al pasar a ser la activa, la reiniciamos a la parte superior para que
  // nunca aparezca ya desplazada hacia abajo (p. ej. tras haber hecho scroll
  // en una visita anterior a la misma pregunta).
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const setCardRef = useCallback(
    (key: string) => (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(key, el)
      else cardRefs.current.delete(key)
    },
    [],
  )

  // Viewport del carrusel (el contenedor que envuelve las tarjetas). A
  // diferencia de las tarjetas, este div NUNCA lleva transform/animación de
  // framer-motion, así que su posición es estable incluso mientras la
  // tarjeta activa todavía está a mitad de su transición de entrada.
  const carouselViewportRef = useRef<HTMLDivElement | null>(null)

  // Además del scroll interno, la propia página puede estar desplazada (p. ej.
  // el usuario bajó para leer el final de una pregunta larga). Si al cambiar
  // de pregunta no movemos también la página, la tarjeta nueva puede quedar
  // parcialmente por encima del viewport. Hacemos un scroll suave para que la
  // parte superior de la tarjeta activa quede siempre a la vista, tanto al
  // avanzar como al retroceder. En el primer render (montaje) no se anima,
  // solo en las navegaciones posteriores.
  const isFirstRenderRef = useRef(true)
  const activeQuestion = questions[index]
  useEffect(() => {
    const key = getQuestionKey(activeQuestion, index)
    const el = cardRefs.current.get(key)
    if (el) el.scrollTop = 0

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      return
    }

    // Ojo: NO medimos la tarjeta activa ni usamos el.scrollIntoView() aquí.
    // La tarjeta todavía está a mitad de su transición de framer-motion
    // (scale/opacity/blur, 0.5s) cuando este efecto se dispara, así que su
    // getBoundingClientRect() en ese instante NO coincide con su posición
    // final ya asentada: calcular el scroll a partir de ahí dejaba la
    // tarjeta desplazada (arriba quedaba oculta) una vez terminaba la
    // animación. En su lugar medimos el viewport del carrusel, que es
    // estático (sin transform) y por tanto siempre fiable, y solo tocamos el
    // scroll VERTICAL de la ventana (nunca el horizontal, que rompía el
    // carrusel al mezclarse con su propia animación de deslizamiento).
    const container = carouselViewportRef.current
    if (!container) return
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rect = container.getBoundingClientRect()
    const scrollMarginTop = parseFloat(getComputedStyle(container).scrollMarginTop) || 0
    const targetY = window.scrollY + rect.top - scrollMarginTop
    window.scrollTo({
      top: Math.max(0, targetY),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [index, activeQuestion, getQuestionKey])

  useEffect(() => {
    if (!activeQuestion?.hasImage || !activeQuestion?.imageUrl) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Spacebar') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      setImageShown((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeQuestion?.hasImage, activeQuestion?.imageUrl])

  const prev = useCallback(() => {
    setImageShown(false)
    setIndex((prevIndex) =>
      prevIndex === 0 ? questions.length - 1 : prevIndex - 1,
    )
  }, [questions.length])

  const next = useCallback(() => {
    setImageShown(false)
    setIndex((prevIndex) =>
      prevIndex === questions.length - 1 ? 0 : prevIndex + 1,
    )
  }, [questions.length])

  const resolveLetterOptionIndex = (value: string, optionsLength: number) => {
    const normalized = value.trim().toUpperCase()
    if (normalized.length !== 1) return -1
    const code = normalized.charCodeAt(0)
    if (code < 65 || code >= 65 + optionsLength) return -1
    return code - 65
  }

  const resolveCorrectOptionIndex = (q: Question) => {
    if (q.correctAnswer == null) return -1

    if (typeof q.correctAnswer === 'number') {
      const asIndex = q.correctAnswer - 1
      return asIndex >= 0 && asIndex < q.options.length ? asIndex : -1
    }

    const normalized = q.correctAnswer.trim().toUpperCase()
    const letterIndex = resolveLetterOptionIndex(normalized, q.options.length)
    if (letterIndex >= 0) return letterIndex

    const numeric = Number(normalized)
    if (Number.isFinite(numeric)) {
      const asIndex = numeric - 1
      return asIndex >= 0 && asIndex < q.options.length ? asIndex : -1
    }

    return q.options.findIndex((opt) => opt.trim() === q.correctAnswer?.toString().trim())
  }

  const resolveSelectedOptionIndex = (q: Question) => {
    if (q.selectedAnswer == null) return -1
    if (typeof q.selectedAnswer === 'number') {
      const maybeOneBased = q.selectedAnswer - 1
      if (maybeOneBased >= 0 && maybeOneBased < q.options.length) {
        return maybeOneBased
      }
      return q.selectedAnswer >= 0 && q.selectedAnswer < q.options.length
        ? q.selectedAnswer
        : -1
    }
    const normalized = q.selectedAnswer.trim().toUpperCase()
    const letterIndex = resolveLetterOptionIndex(normalized, q.options.length)
    if (letterIndex >= 0) return letterIndex
    const numeric = Number(normalized)
    if (Number.isFinite(numeric)) {
      const asIndex = numeric - 1
      return asIndex >= 0 && asIndex < q.options.length ? asIndex : -1
    }
    return q.options.findIndex(
      (opt) => opt.trim() === q.selectedAnswer?.toString().trim(),
    )
  }

  const adjacentIndexes = useMemo(() => {
    const prevIndex = (index - 1 + safeTotal) % safeTotal
    const nextIndex = (index + 1) % safeTotal
    return { prevIndex, nextIndex }
  }, [index, safeTotal])

  if (!questions || questions.length === 0) {
    return null
  }

  return (
    <div className="w-full mt-20 px-2 sm:px-4">
      <h2 className="text-2xl font-semibold mb-6 text-[#374151]">
        Revisión del Daily
      </h2>

      <div className="relative flex items-center justify-center">
        <button
          type="button"
          onClick={prev}
          className="absolute left-1 sm:left-0 z-20 size-10 rounded-full border border-[#E9E4E1] bg-white/90 text-[#7D8A96] hover:text-[#2D3748] hover:border-[#D8CFC9] transition-all"
          aria-label="Anterior"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>

        <div
          ref={carouselViewportRef}
          className="relative flex w-full max-w-6xl scroll-mt-24 justify-center items-start overflow-x-hidden overflow-y-visible min-h-[720px] sm:min-h-[780px] py-6"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-10 sm:w-20 bg-gradient-to-r from-[#FAF7F4] via-[#FAF7F4]/90 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[3] w-10 sm:w-20 bg-gradient-to-l from-[#FAF7F4] via-[#FAF7F4]/90 to-transparent" />
          {questions.map((q, i) => {
            const isActive = i === index
            const isSide = i === adjacentIndexes.prevIndex || i === adjacentIndexes.nextIndex
            const xOffset =
              isActive
                ? 0
                : i === adjacentIndexes.prevIndex
                  ? -290
                  : i === adjacentIndexes.nextIndex
                    ? 290
                    : 0
            const questionKey = getQuestionKey(q, i)
            const isExpanded = expandedId === questionKey
            const correctOptionIndex = resolveCorrectOptionIndex(q)
            const selectedOptionIndex = resolveSelectedOptionIndex(q)

            return (
              <motion.div
                key={questionKey}
                ref={setCardRef(questionKey)}
                onClick={() => {
                  if (isSide) {
                    setImageShown(false)
                    setIndex(i)
                  }
                }}
                animate={{
                  x: xOffset,
                  scale: isActive ? 1 : isSide ? 0.9 : 0.7,
                  opacity: isActive ? 1 : isSide ? 0.6 : 0,
                  filter: isActive
                    ? 'blur(0px)'
                    : isSide
                      ? 'blur(3px)'
                      : 'blur(6px)',
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`absolute w-[90%] sm:w-[82%] max-w-4xl max-h-[75vh] overflow-y-auto no-scrollbar rounded-3xl border border-white/60 ring-1 ring-white/70 bg-white p-5 sm:p-7 shadow-[0_18px_40px_rgba(125,138,150,0.16)] ${
                  isSide ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  pointerEvents: isActive || isSide ? 'auto' : 'none',
                  zIndex: isActive ? 2 : isSide ? 1 : 0,
                }}
              >
                <header className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-[#7D8A96] font-semibold">
                      {q.category}
                    </p>
                    <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 mt-2 leading-snug">
                      {q.question}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E7E3] px-3 py-1 text-xs font-semibold text-[#C45B4B]">
                      <span className="material-symbols-outlined text-sm">history</span>
                      Daily
                    </span>
                    {(q.result === 'blank' ||
                      (q.result == null && q.selectedAnswer == null && q.isCorrect == null)) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#7D8A96]/10 px-3 py-1 text-xs font-semibold text-[#7D8A96]">
                        <span className="material-symbols-outlined text-sm">block</span>
                        En blanco
                      </span>
                    )}
                  </div>
                </header>

                <div className="mt-6 space-y-2">
                  {q.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`w-full text-left px-4 py-2.5 rounded-2xl border text-sm flex items-center gap-3 transition-colors ${
                        isExpanded && idx === correctOptionIndex
                          ? 'border-[#8BA888]/40 bg-[#8BA888]/10 text-[#2D3748]'
                          : isExpanded &&
                              idx === selectedOptionIndex &&
                              selectedOptionIndex !== correctOptionIndex
                            ? 'border-[#E8A598]/45 bg-[#FFF1EC] text-[#2D3748]'
                          : 'border-[#F0EAE6] bg-white/70 text-[#7D8A96]'
                      }`}
                    >
                      <span
                        className={`size-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold leading-none ${
                          isExpanded && idx === correctOptionIndex
                            ? 'bg-[#8BA888] border-[#8BA888] text-white'
                            : 'bg-[#FAF7F4] border-[#E8A598]/30 text-[#C45B4B]'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                      {isExpanded && idx === correctOptionIndex && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#8BA888]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#4C6A4D]">
                          <span className="material-symbols-outlined text-[14px]">
                            check_circle
                          </span>
                          Correcta
                        </span>
                      )}
                      {isExpanded &&
                        idx === selectedOptionIndex &&
                        selectedOptionIndex !== correctOptionIndex && (
                          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#E8A598]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#C45B4B]">
                            <span className="material-symbols-outlined text-[14px]">
                              person
                            </span>
                            Tu respuesta
                          </span>
                        )}
                    </div>
                  ))}
                </div>

                {q.hasImage && q.imageUrl && isActive ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => setImageShown((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#E8A598]/40 bg-white px-4 py-2.5 text-sm font-bold text-[#d18d80] transition-colors hover:bg-[#fff0ec]"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {imageShown ? 'visibility_off' : 'image'}
                      </span>
                      {imageShown ? 'Ocultar imagen' : 'Ver imagen'}
                      <span className="ml-1 hidden rounded border border-[#E9E4E1] bg-[#FAF7F4] px-1.5 py-0.5 font-mono text-[10px] text-[#7D8A96] sm:inline">
                        Espacio
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {imageShown ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3">
                            <ZoomableImage
                              url={q.imageUrl}
                              className="mx-auto max-h-80 w-auto max-w-full rounded-2xl border border-[#E9E4E1] bg-white object-contain"
                            />
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === questionKey ? null : questionKey,
                    )
                  }
                  className="mt-6 w-full rounded-2xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-left hover:border-[#E8A598]/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#C45B4B]">
                      Respuesta correcta - Ver explicación
                    </span>
                    <span className="material-symbols-outlined text-[#C45B4B]">
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 rounded-2xl border border-[#E9E4E1] bg-[#FAF7F4] px-4 py-4 text-sm text-[#7D8A96] leading-relaxed">
                        {q.explanation || 'No hay explicación disponible para esta pregunta.'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={next}
          className="absolute right-1 sm:right-0 z-20 size-10 rounded-full border border-[#E9E4E1] bg-white/90 text-[#7D8A96] hover:text-[#2D3748] hover:border-[#D8CFC9] transition-all"
          aria-label="Siguiente"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>
    </div>
  )
}

export default memo(DailyReviewCarousel)
