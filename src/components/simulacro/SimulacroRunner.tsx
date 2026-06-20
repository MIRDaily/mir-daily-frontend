'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  SimulacroAnswer,
  SimulacroMode,
  SimulacroQuestion,
  SimulacroResult,
} from '@/lib/simulacro/types'

type SimulacroRunnerProps = {
  questions: SimulacroQuestion[]
  mode: SimulacroMode
  answers: SimulacroAnswer[]
  results: (SimulacroResult | null)[]
  finishing: boolean
  onSelect: (questionIndex: number, optionIndex: number) => void
  onFinish: () => void
  onExit: () => void
}

export default function SimulacroRunner({
  questions,
  mode,
  answers,
  results,
  finishing,
  onSelect,
  onFinish,
  onExit,
}: SimulacroRunnerProps) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState<string | null>(null)

  const total = questions.length
  const current = questions[index]
  const selected = answers[index]?.selectedIndex ?? null
  const result = results[index] ?? null
  const correctIndex = result?.correctIndex ?? -1
  const isLast = index === total - 1

  // En modo inmediato, al responder se bloquea la pregunta. La corrección llega
  // del servidor: mientras no está, mostramos "comprobando"; cuando llega, se
  // revela el resultado.
  const locked = mode === 'immediate' && selected != null
  const revealed = locked && result != null
  const checking = locked && result == null

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => {
    if (isLast) {
      onFinish()
      return
    }
    setIndex((i) => Math.min(total - 1, i + 1))
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Barra superior */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-2 rounded-xl border border-[#E9E4E1] px-4 py-2 text-sm font-semibold text-[#7D8A96] transition-all hover:border-[#E8A598]/40 hover:text-[#2D3748]"
        >
          <span className="material-symbols-outlined text-lg">close</span>
          Salir
        </button>
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7D8A96] shadow-sm">
          <span className="material-symbols-outlined text-base text-[#E8A598]">
            {mode === 'immediate' ? 'bolt' : 'flag'}
          </span>
          {mode === 'immediate' ? 'Corrección inmediata' : 'Corrección al final'}
        </span>
      </div>

      {/* Progreso */}
      <div className="mb-10 w-full">
        <div className="mb-3 flex items-end justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#7D8A96]">
            Progreso del simulacro
          </span>
          <span className="text-sm font-bold text-[#7D8A96]">
            Pregunta <span className="text-[#C45B4B]">{index + 1}</span> de {total}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#E9E4E1]">
          <div
            className="h-full rounded-full bg-[#E8A598] transition-all duration-500 ease-out"
            style={{ width: `${Math.round(((index + 1) / total) * 100)}%` }}
          />
        </div>
      </div>

      <div className="w-full space-y-8">
        <div>
          {current?.subject ? (
            <span className="mb-6 inline-block rounded-full border border-[#E9E4E1] bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7D8A96]">
              {current.subject}
            </span>
          ) : null}
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#2D3748] sm:text-[32px]">
            {current?.statement}
          </h1>
          {current?.has_image && current?.image_url ? (
            <button
              type="button"
              onClick={() => setZoom(current.image_url!)}
              className="group mt-5 block overflow-hidden rounded-2xl border border-[#E9E4E1] bg-white"
              aria-label="Ampliar imagen"
            >
              <img
                src={current.image_url}
                alt="Imagen de la pregunta"
                className="mx-auto max-h-[340px] w-auto object-contain transition-transform duration-200 group-hover:scale-[1.01]"
              />
              <span className="flex items-center justify-center gap-1 border-t border-[#F0EAE6] bg-[#FAF7F4] py-1.5 text-[11px] font-semibold text-[#7D8A96]">
                <span className="material-symbols-outlined text-sm">zoom_in</span>
                Ampliar
              </span>
            </button>
          ) : null}
        </div>

        <div className="grid gap-4">
          {current?.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex
            const isCorrect = optionIndex === correctIndex

            // Colores en estado revelado (modo inmediato tras responder).
            let containerClass =
              'bg-white border-transparent hover:border-[#E8A598]/30'
            if (revealed) {
              if (isCorrect) {
                containerClass = 'bg-[#8BA888]/10 border-[#8BA888]/60'
              } else if (isSelected) {
                containerClass = 'bg-[#FFF1EC] border-[#C4655A]/50'
              } else {
                containerClass = 'bg-white border-transparent opacity-70'
              }
            } else if (isSelected) {
              containerClass = 'bg-white border-[#E8A598]/60'
            }

            return (
              <button
                key={`${current.id}-${optionIndex}`}
                type="button"
                disabled={locked}
                onClick={() => onSelect(index, optionIndex)}
                className={`group flex items-center rounded-2xl border-2 p-5 text-left shadow-sm transition-all duration-200 hover:shadow-md disabled:cursor-default ${containerClass}`}
              >
                <div
                  className={`mr-4 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    revealed && isCorrect
                      ? 'border-[#8BA888] bg-[#8BA888]'
                      : revealed && isSelected
                        ? 'border-[#C4655A] bg-[#C4655A]'
                        : isSelected
                          ? 'border-[#E8A598]'
                          : 'border-[#D8D2CE] group-hover:border-[#E8A598]'
                  }`}
                >
                  {revealed && (isCorrect || isSelected) ? (
                    <span className="material-symbols-outlined text-[16px] text-white">
                      {isCorrect ? 'check' : 'close'}
                    </span>
                  ) : (
                    <div
                      className={`size-2.5 rounded-full bg-[#E8A598] transition-opacity ${
                        isSelected && !revealed ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  )}
                </div>
                <span className="text-lg font-medium text-[#4B5563]">
                  <span className="mr-2 font-bold">
                    {String.fromCharCode(65 + optionIndex)})
                  </span>
                  {option}
                </span>
                {revealed && isCorrect ? (
                  <span className="ml-auto rounded-full bg-[#8BA888]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#5f7d5c]">
                    Correcta
                  </span>
                ) : revealed && isSelected ? (
                  <span className="ml-auto rounded-full bg-[#C4655A]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#C4655A]">
                    Tu respuesta
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Comprobando (modo inmediato, esperando corrección del servidor) */}
        {checking ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[#F0EAE6] bg-[#FAF7F4] px-5 py-4 text-sm font-medium text-[#7D8A96]">
            <span className="material-symbols-outlined animate-spin text-base text-[#E8A598]">
              progress_activity
            </span>
            Comprobando tu respuesta...
          </div>
        ) : null}

        {/* Explicación (modo inmediato, una vez corregida en el servidor) */}
        <AnimatePresence initial={false}>
          {revealed ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-[#F0EAE6] bg-[#FAF7F4] px-5 py-4"
            >
              <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                <span className="material-symbols-outlined text-base text-[#E8A598]">
                  lightbulb
                </span>
                Explicación
              </p>
              <p className="text-sm leading-relaxed text-[#4B5563]">
                {result?.explanation?.trim() ||
                  'No hay explicación disponible para esta pregunta.'}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Controles */}
        <div className="flex items-center justify-between gap-3 pt-4">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="flex items-center gap-2 rounded-2xl border border-[#E9E4E1] px-5 py-3 text-sm font-semibold text-[#7D8A96] transition-all hover:border-[#E8A598]/40 hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Anterior
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={selected == null || finishing}
            className="flex items-center gap-3 rounded-2xl bg-[#E8A598] px-8 py-4 font-bold text-white shadow-lg shadow-[#E8A598]/20 transition-all hover:bg-[#d18d80] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLast && finishing ? (
              <>
                Corrigiendo
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              </>
            ) : (
              <>
                {isLast ? 'Finalizar' : 'Siguiente'}
                <span className="material-symbols-outlined">
                  {isLast ? 'done_all' : 'arrow_forward'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {zoom ? (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1F2937]/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoom(null)}
          >
            <img
              src={zoom}
              alt="Imagen ampliada"
              className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoom(null)}
              aria-label="Cerrar"
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#2D3748] shadow-lg transition-colors hover:bg-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
