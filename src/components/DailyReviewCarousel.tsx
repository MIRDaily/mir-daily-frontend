import { AnimatePresence, motion } from 'framer-motion'
import { memo, useCallback, useMemo, useState } from 'react'

interface Question {
  reviewId?: string | number | null
  questionId?: string | number | null
  id: string
  category: string
  question: string
  correctAnswer: string | number | null
  selectedAnswer?: string | number | null
  isCorrect?: boolean | null
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
  const total = questions.length
  const safeTotal = Math.max(total, 1)

  const prev = useCallback(() =>
    setIndex((prevIndex) =>
      prevIndex === 0 ? questions.length - 1 : prevIndex - 1,
    ), [questions.length])

  const next = useCallback(() =>
    setIndex((prevIndex) =>
      prevIndex === questions.length - 1 ? 0 : prevIndex + 1,
    ), [questions.length])

  const resolveCorrectOptionIndex = (q: Question) => {
    if (q.correctAnswer == null) return -1

    if (typeof q.correctAnswer === 'number') {
      const asIndex = q.correctAnswer - 1
      return asIndex >= 0 && asIndex < q.options.length ? asIndex : -1
    }

    const normalized = q.correctAnswer.trim().toUpperCase()
    if (['A', 'B', 'C', 'D'].includes(normalized)) {
      return normalized.charCodeAt(0) - 65
    }

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
    if (['A', 'B', 'C', 'D'].includes(normalized)) {
      return normalized.charCodeAt(0) - 65
    }
    const numeric = Number(normalized)
    if (Number.isFinite(numeric)) {
      const asIndex = numeric - 1
      return asIndex >= 0 && asIndex < q.options.length ? asIndex : -1
    }
    return q.options.findIndex(
      (opt) => opt.trim() === q.selectedAnswer?.toString().trim(),
    )
  }

  const getQuestionKey = useCallback((q: Question, i: number) =>
    String(q.reviewId ?? q.id ?? i), [])
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

        <div className="relative flex w-full max-w-6xl justify-center items-center overflow-x-hidden overflow-y-visible min-h-[720px] sm:min-h-[780px] py-6">
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
                onClick={() => {
                  if (isSide) setIndex(i)
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E7E3] px-3 py-1 text-xs font-semibold text-[#C45B4B] shrink-0">
                    <span className="material-symbols-outlined text-sm">history</span>
                    Daily
                  </span>
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
                        className={`size-7 rounded-full border flex items-center justify-center text-xs font-bold ${
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

                {q.hasImage && q.imageUrl && (
                  <div className="mt-5">
                    <img
                      src={q.imageUrl}
                      alt="Imagen de la pregunta"
                      className="w-full rounded-2xl border border-[#E9E4E1] object-cover max-h-64"
                      loading="lazy"
                    />
                  </div>
                )}

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
