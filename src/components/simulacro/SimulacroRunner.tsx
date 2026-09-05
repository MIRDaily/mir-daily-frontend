'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QuestionImage from '@/components/simulacro/QuestionImage'
import SaveToDeckButton from '@/components/simulacro/SaveToDeckButton'
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
  onSelect: (questionIndex: number, optionIndex: number, timeSpent?: number) => void
  onBlank: (questionIndex: number, timeSpent?: number) => void
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
  onBlank,
  onFinish,
  onExit,
}: SimulacroRunnerProps) {
  const [index, setIndex] = useState(0)

  const total = questions.length
  const current = questions[index]
  const selected = answers[index]?.selectedIndex ?? null
  const blanked = answers[index]?.blank === true
  const result = results[index] ?? null
  const correctIndex = result?.correctIndex ?? -1
  const isLast = index === total - 1

  // Tiempo dedicado a la pregunta visible (para la analítica de rendimiento).
  const shownAtRef = useRef(Date.now())
  useEffect(() => {
    shownAtRef.current = Date.now()
  }, [index])
  const secondsOnQuestion = () =>
    Math.max(0, Math.round((Date.now() - shownAtRef.current) / 1000))

  // En modo inmediato, al responder (o dejar en blanco) se bloquea la pregunta.
  // La corrección llega del servidor: mientras no está, mostramos "comprobando";
  // cuando llega, se revela el resultado.
  const locked = mode === 'immediate' && (selected != null || blanked)
  const revealed = locked && result != null
  const checking = locked && result == null

  // Imagen de la pregunta: revelar/ocultar con barra espaciadora (o tocando).
  const [imageRevealed, setImageRevealed] = useState(false)
  const [playHint, setPlayHint] = useState(false)
  const hintPlayed = useRef(false)

  // Al cambiar de pregunta, la imagen vuelve a ocultarse.
  useEffect(() => {
    setImageRevealed(false)
    setPlayHint(false)
  }, [index])

  // Pista de barra espaciadora: solo la primera vez que aparece una pregunta con imagen.
  useEffect(() => {
    if (current?.has_image && current?.image_url && !hintPlayed.current) {
      hintPlayed.current = true
      setPlayHint(true)
    }
  }, [current])

  // Barra espaciadora: muestra/oculta la imagen de la pregunta.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Spacebar') && current?.has_image && current?.image_url) {
        e.preventDefault()
        setImageRevealed((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current])

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))
  const goNext = () => {
    // Avanzar sin responder = dejar la pregunta en blanco (como en el MIR).
    if (selected == null && !blanked) {
      onBlank(index, secondsOnQuestion())
      // En modo inmediato nos quedamos para mostrar la corrección revelada.
      if (mode === 'immediate') return
    }
    if (isLast) {
      onFinish()
      return
    }
    setIndex((i) => Math.min(total - 1, i + 1))
  }

  const handleBlankClick = () => {
    if (locked) return
    onBlank(index, secondsOnQuestion())
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Barra superior */}
      {/* Barra de sesión: salir, modo y progreso en una pieza que acompaña */}
      <div
        className="sticky top-4 z-30 mb-8 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-3"
        style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="flex items-center justify-center rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#C4655A]"
            aria-label="Salir del simulacro"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8A598]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#d18d80]">
            <span className="material-symbols-outlined text-sm">
              {mode === 'immediate' ? 'bolt' : 'flag'}
            </span>
            {mode === 'immediate' ? 'Inmediata' : 'Al final'}
          </span>
          <span className="ml-auto text-sm font-black tabular-nums text-[#2c3e50]">
            {index + 1}
            <span className="text-[#7D8A96]/60"> / {total}</span>
          </span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full border border-[#EAE4E2] bg-[#F2EFED]">
          <motion.div
            className="h-full rounded-full bg-[#E8A598]"
            initial={false}
            animate={{ width: `${Math.round(((index + 1) / total) * 100)}%` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="w-full space-y-8">
        <div className="relative pr-14">
          {current ? (
            <div className="absolute right-0 top-0">
              <SaveToDeckButton questionId={current.id} />
            </div>
          ) : null}
          {current?.subject ? (
            <span className="mb-6 inline-block rounded-full border-2 border-[#EAE4E2] bg-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#7D8A96]">
              {current.subject}
            </span>
          ) : null}
          <h1 className="text-[1.75rem] font-black leading-tight tracking-tight text-[#2C3E50] sm:text-[2rem]">
            {current?.statement}
          </h1>
          {current?.has_image && current?.image_url ? (
            <div>
              <QuestionImage
                key={current.id}
                url={current.image_url}
                height={340}
                revealed={imageRevealed}
                onRevealedChange={setImageRevealed}
              />
              {playHint ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
                  transition={{
                    duration: 3,
                    times: [0, 0.12, 0.33, 0.5, 0.66, 0.83, 1],
                    ease: 'easeInOut',
                  }}
                  onAnimationComplete={() => setPlayHint(false)}
                  className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#7D8A96]"
                >
                  <span className="rounded border border-[#E9E4E1] bg-[#FAF7F4] px-1.5 py-0.5 font-mono text-[10px] text-[#2D3748]">
                    Espacio
                  </span>
                  Presiona barra espaciadora para mostrar u ocultar la imagen
                </motion.div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          {current?.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex
            const isCorrect = optionIndex === correctIndex

            // Colores en estado revelado (modo inmediato tras responder).
            // Estado -> borde de tinta + sombra del color que toca, para que
            // acierto y fallo se lean sin depender solo del matiz de fondo.
            let containerClass = 'bg-white border-[#EAE4E2] hover:-translate-y-0.5 hover:border-[#2c3e50]'
            let shadow: string | undefined
            if (revealed) {
              if (isCorrect) {
                containerClass = 'bg-[#F1F5F0] border-[#2c3e50]'
                shadow = '4px 4px 0 0 #8BA888'
              } else if (isSelected) {
                containerClass = 'bg-[#FDF2F0] border-[#2c3e50]'
                shadow = '4px 4px 0 0 #C4655A'
              } else {
                containerClass = 'bg-white border-[#EAE4E2] opacity-60'
              }
            } else if (isSelected) {
              containerClass = 'bg-[#FFF9F7] border-[#2c3e50]'
              shadow = '4px 4px 0 0 #2c3e50'
            }

            return (
              <button
                key={`${current.id}-${optionIndex}`}
                type="button"
                disabled={locked}
                onClick={() => onSelect(index, optionIndex, secondsOnQuestion())}
                className={`group flex items-center rounded-2xl border-2 p-5 text-left transition-all duration-200 disabled:cursor-default disabled:hover:translate-y-0 ${containerClass}`}
                style={shadow ? { boxShadow: shadow } : undefined}
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
                <span className="text-lg font-medium text-[#2C3E50]">
                  <span className="mr-2 font-black">
                    {String.fromCharCode(65 + optionIndex)})
                  </span>
                  {option}
                </span>
                {revealed && isCorrect ? (
                  <span className="ml-auto shrink-0 rounded-full bg-[#8BA888] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                    Correcta
                  </span>
                ) : revealed && isSelected ? (
                  <span className="ml-auto shrink-0 rounded-full bg-[#C4655A] px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                    Tu respuesta
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Dejar en blanco: en el MIR los blancos no puntúan ni penalizan */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBlankClick}
            disabled={locked}
            className={`flex items-center gap-2 rounded-2xl border-2 px-5 py-3 text-sm font-bold transition-all disabled:cursor-default ${
              blanked
                ? 'border-[#2c3e50] bg-[#7D8A96] text-white'
                : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2C3E50]'
            }`}
            style={blanked ? { boxShadow: '4px 4px 0 0 #2c3e50' } : undefined}
          >
            <span className="material-symbols-outlined text-lg">
              {blanked ? 'check_circle' : 'block'}
            </span>
            {blanked ? 'Pregunta en blanco' : 'Dejar en blanco'}
          </button>
          {blanked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#7D8A96]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#7D8A96]">
              <span className="material-symbols-outlined text-sm">info</span>
              No puntúa ni penaliza
            </span>
          ) : null}
        </div>

        {/* Comprobando (modo inmediato, esperando corrección del servidor) */}
        {checking ? (
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-[#FAF7F4] px-5 py-4 text-sm font-bold text-[#7D8A96]">
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
              className="rounded-2xl border-2 border-[#2c3e50] bg-[#FFFBFA] px-5 py-4"
              style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
            >
              <p className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#d18d80]">
                <span className="material-symbols-outlined text-base text-[#E8A598]">
                  lightbulb
                </span>
                Explicación
              </p>
              <p className="text-[15px] leading-relaxed text-[#2C3E50]">
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
            className="flex items-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-white px-5 py-3 text-sm font-bold text-[#7D8A96] transition-all hover:-translate-y-0.5 hover:border-[#2c3e50] hover:text-[#2C3E50] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Anterior
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={checking || finishing}
            className="flex items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-8 py-4 font-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
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
    </div>
  )
}
