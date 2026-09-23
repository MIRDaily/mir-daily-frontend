'use client'

import { useEffect, useState } from 'react'
import type { GuideQuestion } from '@/types/studyGuide'
import { QUESTION_KIND_STYLES } from '@/components/library/guide/guideStyles'
import { useGuideQuiz } from '@/components/library/guide/GuideQuiz'
import { goTo } from '@/components/library/guide/GuideTableOfContents'

type GuideQuestionCardProps = {
  question: GuideQuestion
  lastExamLabel: string
}

// El usuario marca una opción y corrige; al corregir ve qué marcó frente a la correcta.
// La elección solo vive en esta sesión (no se guarda).
export default function GuideQuestionCard({ question, lastExamLabel }: GuideQuestionCardProps) {
  const kind = QUESTION_KIND_STYLES[question.kind]
  const quiz = useGuideQuiz()
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [seenResetToken, setSeenResetToken] = useState(quiz?.resetToken ?? 0)

  // "Empezar de nuevo" del marcador limpia todas las tarjetas.
  if (quiz && quiz.resetToken !== seenResetToken) {
    setSeenResetToken(quiz.resetToken)
    setSelected(null)
    setRevealed(false)
  }

  const isRight = selected === question.correct
  const record = quiz?.record

  useEffect(() => {
    if (!record) return
    record(question.number, revealed ? (selected === null ? 'sin-marcar' : isRight ? 'acierto' : 'fallo') : null)
  }, [record, question.number, revealed, selected, isRight])

  const reset = () => {
    setSelected(null)
    setRevealed(false)
  }

  return (
    <article
      id={`pregunta-${question.number}`}
      className={`flex scroll-mt-24 flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-colors duration-300 ${
        revealed && selected !== null ? (isRight ? 'border-[#8BA888]/60' : 'border-[#D9786B]/50') : 'border-[#EAE4E2]'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-[#2C3E50]">
          {lastExamLabel} · P{question.number}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${kind.chip}`}>{kind.label}</span>
        <span className="text-xs text-[#7D8A96]">{question.tag}</span>
      </header>

      <p className="text-sm leading-relaxed font-medium text-[#2C3E50]">{question.stem}</p>

      <ol className="flex flex-col gap-1.5" role={revealed ? undefined : 'radiogroup'} aria-label="Opciones">
        {question.options.map((option, index) => {
          const number = index + 1
          const isCorrect = number === question.correct
          const isSelected = number === selected

          let tone = 'bg-[#F9F8F7] text-[#2C3E50] hover:bg-[#F2EFED]'
          let badge = 'bg-white text-[#7D8A96] ring-1 ring-[#EAE4E2]'
          let mark: string | null = null
          if (!revealed && isSelected) {
            tone = 'bg-[#2C3E50] text-white shadow-md'
            badge = 'bg-white text-[#2C3E50]'
          }
          if (revealed) {
            if (isCorrect) {
              tone = 'bg-[#8BA888]/15 font-semibold text-[#3F5E3C] ring-1 ring-[#8BA888]/50'
              badge = 'bg-[#8BA888] text-white'
              mark = 'check_circle'
            } else if (isSelected) {
              tone = 'bg-[#D9786B]/12 text-[#A4463A] ring-1 ring-[#D9786B]/40'
              badge = 'bg-[#D9786B] text-white'
              mark = 'cancel'
            } else {
              tone = 'bg-[#F9F8F7] text-[#2C3E50] opacity-50'
            }
          }

          return (
            <li key={option}>
              <button
                type="button"
                role={revealed ? undefined : 'radio'}
                aria-checked={revealed ? undefined : isSelected}
                disabled={revealed}
                onClick={() => setSelected(isSelected ? null : number)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm leading-snug transition-all duration-200 disabled:cursor-default ${tone}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${badge}`}>
                  {number}
                </span>
                <span className="flex-1">{option}</span>
                {revealed && isSelected ? (
                  <span className="shrink-0 self-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                    Tu respuesta
                  </span>
                ) : null}
                {mark ? (
                  <span className="material-symbols-outlined shrink-0 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {mark}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ol>

      {!revealed ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              selected !== null
                ? 'bg-[#E8A598] text-white hover:bg-[#d18d80]'
                : 'border border-[#EAE4E2] text-[#2C3E50] hover:border-[#8BA888]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{selected !== null ? 'fact_check' : 'visibility'}</span>
            {selected !== null ? 'Corregir' : 'Ver respuesta'}
          </button>
          {selected === null ? <span className="text-xs text-[#7D8A96]">o marca una opción para corregirte</span> : null}
        </div>
      ) : (
        <div className="guia-answer flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {selected === null ? (
              <span className="rounded-full bg-[#F2EFED] px-3 py-1 text-xs font-bold text-[#6B7884]">
                Sin marcar · la correcta es la {question.correct}
              </span>
            ) : isRight ? (
              <span className="flex items-center gap-1 rounded-full bg-[#8BA888] px-3 py-1 text-xs font-bold text-white">
                <span className="material-symbols-outlined text-[15px]">celebration</span>
                ¡Correcta!
              </span>
            ) : (
              <span className="rounded-full bg-[#D9786B] px-3 py-1 text-xs font-bold text-white">
                Marcaste la {selected} · la correcta es la {question.correct}
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              className="ml-auto flex items-center gap-1 rounded-full border border-[#EAE4E2] px-3 py-1 text-xs font-semibold text-[#2C3E50] transition-colors hover:border-[#E8A598]"
            >
              <span className="material-symbols-outlined text-[15px]">replay</span>
              Reintentar
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border-l-4 border-[#8BA888] bg-[#8BA888]/10 p-4">
            <p className="text-sm leading-relaxed text-[#2C3E50]">{question.explanation}</p>
            {question.topicId ? (
              <a
                href={`#tema-${question.topicId}`}
                onClick={(event) => {
                  event.preventDefault()
                  goTo(`tema-${question.topicId}`)
                }}
                className="w-fit text-xs font-semibold text-[#B5655A] hover:underline"
              >
                Repasar el tema →
              </a>
            ) : null}
          </div>
        </div>
      )}
    </article>
  )
}
