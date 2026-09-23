'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

// Resultados de la autocorrección de las preguntas de la guía. Solo viven en memoria:
// no se guardan ni cuentan para las estadísticas del usuario.
export type GuideQuizResult = 'acierto' | 'fallo' | 'sin-marcar'

type GuideQuizContextValue = {
  results: Record<number, GuideQuizResult>
  record: (questionNumber: number, result: GuideQuizResult | null) => void
  resetAll: () => void
  resetToken: number
}

const GuideQuizContext = createContext<GuideQuizContextValue | null>(null)

export function GuideQuizProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<Record<number, GuideQuizResult>>({})
  // Cambia al pulsar "Empezar de nuevo": cada tarjeta lo escucha para limpiarse.
  const [resetToken, setResetToken] = useState(0)

  const record = useCallback((questionNumber: number, result: GuideQuizResult | null) => {
    setResults((previous) => {
      const next = { ...previous }
      if (result) next[questionNumber] = result
      else delete next[questionNumber]
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setResults({})
    setResetToken((token) => token + 1)
  }, [])

  const value = useMemo(() => ({ results, record, resetAll, resetToken }), [results, record, resetAll, resetToken])
  return <GuideQuizContext.Provider value={value}>{children}</GuideQuizContext.Provider>
}

export function useGuideQuiz() {
  return useContext(GuideQuizContext)
}

export function GuideQuizScore({ total }: { total: number }) {
  const quiz = useGuideQuiz()
  if (!quiz) return null
  const values = Object.values(quiz.results)
  const corrected = values.length
  const hits = values.filter((result) => result === 'acierto').length
  const misses = values.filter((result) => result === 'fallo').length

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#EAE4E2] bg-white px-4 py-3 text-sm">
      <span className="material-symbols-outlined text-[#E8A598]">fact_check</span>
      {corrected === 0 ? (
        <span>
          Marca tu respuesta y pulsa <strong className="text-[#2C3E50]">Corregir</strong>. Nada de esto se guarda ni cuenta para tus
          estadísticas.
        </span>
      ) : (
        <>
          <span className="font-semibold text-[#2C3E50]">
            {corrected} de {total} corregidas
          </span>
          <span className="rounded-full bg-[#8BA888]/15 px-2.5 py-0.5 text-xs font-bold text-[#3F5E3C]">{hits} {hits === 1 ? 'acierto' : 'aciertos'}</span>
          <span className="rounded-full bg-[#D9786B]/15 px-2.5 py-0.5 text-xs font-bold text-[#A4463A]">{misses} {misses === 1 ? 'fallo' : 'fallos'}</span>
          {corrected - hits - misses > 0 ? (
            <span className="rounded-full bg-[#F2EFED] px-2.5 py-0.5 text-xs font-bold text-[#6B7884]">
              {corrected - hits - misses} sin marcar
            </span>
          ) : null}
          <button
            type="button"
            onClick={quiz.resetAll}
            className="ml-auto flex items-center gap-1 rounded-full border border-[#EAE4E2] px-3 py-1 text-xs font-semibold text-[#2C3E50] transition-colors hover:border-[#E8A598]"
          >
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            Empezar de nuevo
          </button>
        </>
      )}
    </div>
  )
}
