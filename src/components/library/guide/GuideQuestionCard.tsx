import type { GuideQuestion } from '@/types/studyGuide'
import { QUESTION_KIND_STYLES } from '@/components/library/guide/guideStyles'

type GuideQuestionCardProps = {
  question: GuideQuestion
  lastExamLabel: string
}

// La opción correcta solo se resalta al abrir "Ver respuesta" (CSS :has, sin JS).
export default function GuideQuestionCard({ question, lastExamLabel }: GuideQuestionCardProps) {
  const kind = QUESTION_KIND_STYLES[question.kind]

  return (
    <article
      id={`pregunta-${question.number}`}
      className="group/q flex scroll-mt-24 flex-col gap-4 rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-[#2C3E50]">
          {lastExamLabel} · P{question.number}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${kind.chip}`}>{kind.label}</span>
        <span className="text-xs text-[#7D8A96]">{question.tag}</span>
      </header>

      <p className="text-sm leading-relaxed font-medium text-[#2C3E50]">{question.stem}</p>

      <ol className="flex flex-col gap-1.5">
        {question.options.map((option, index) => {
          const isCorrect = index + 1 === question.correct
          return (
            <li
              key={option}
              className={`flex gap-2.5 rounded-lg bg-[#F9F8F7] px-3 py-2 text-sm leading-snug text-[#2C3E50] transition-all duration-300 ${
                isCorrect
                  ? 'group-has-[details[open]]/q:bg-[#8BA888]/15 group-has-[details[open]]/q:font-semibold group-has-[details[open]]/q:text-[#3F5E3C]'
                  : 'group-has-[details[open]]/q:opacity-55'
              }`}
            >
              <span className="font-bold text-[#7D8A96]">{index + 1}.</span>
              <span>{option}</span>
            </li>
          )
        })}
      </ol>

      <details className="group/a">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-full border border-[#EAE4E2] px-3.5 py-1.5 text-xs font-semibold text-[#2C3E50] transition-colors hover:border-[#8BA888] [&::-webkit-details-marker]:hidden">
          <span className="material-symbols-outlined text-[16px] text-[#8BA888]">visibility</span>
          <span className="group-open/a:hidden">Ver respuesta</span>
          <span className="hidden group-open/a:inline">Ocultar respuesta</span>
        </summary>
        <div className="guia-answer mt-3 flex flex-col gap-2 rounded-xl border-l-4 border-[#8BA888] bg-[#8BA888]/10 p-4">
          <p className="text-sm font-bold text-[#3F5E3C]">Respuesta: {question.correct}</p>
          <p className="text-sm leading-relaxed text-[#2C3E50]">{question.explanation}</p>
          {question.topicId ? (
            <a href={`#tema-${question.topicId}`} className="w-fit text-xs font-semibold text-[#B5655A] hover:underline">
              Repasar el tema →
            </a>
          ) : null}
        </div>
      </details>
    </article>
  )
}
