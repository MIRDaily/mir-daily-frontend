'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import QuestionImage from '@/components/simulacro/QuestionImage'
import SaveToDeckButton from '@/components/simulacro/SaveToDeckButton'
import { AnnulledNotice } from '@/components/simulacro/SimulacroResultsGrid'
import HighlightableStatement, { ClearHighlightButton } from '@/components/simulacro/HighlightableStatement'
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
  /** Corrige la pregunta en el servidor (modo inmediato). Rechaza si falla. */
  onCheck: (questionIndex: number, timeSpent?: number) => Promise<void>
  onFinish: () => void
  onExit: () => void
  /** Subrayado de cada pregunta, por índice. Vive en la página para que dure
   *  toda la sesión (volver con "Anterior", repaso de resultados). */
  highlights: Record<number, ReadonlySet<number>>
  onHighlightChange: (questionIndex: number, next: Set<number>) => void
  /** Mostrar la asignatura sobre el enunciado. Apagado por defecto: saberla
   *  acota la respuesta antes de leer el caso (como en la app). */
  showSubject: boolean
  /** Preguntas marcadas "para revisar" (por índice). Viven en la página. */
  flagged: ReadonlySet<number>
  onToggleFlag: (questionIndex: number) => void
}

const NO_HIGHLIGHTS: ReadonlySet<number> = new Set()

/** 83 → "1:23"; 3725 → "1:02:05". */
function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export default function SimulacroRunner({
  questions,
  mode,
  answers,
  results,
  finishing,
  onSelect,
  onBlank,
  onCheck,
  onFinish,
  onExit,
  highlights,
  onHighlightChange,
  showSubject,
  flagged,
  onToggleFlag,
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

  // Reloj de la sesión. Se calcula contra la hora de inicio (no sumando
  // ticks), así que no se desfasa si la pestaña se duerme en segundo plano.
  const sessionStartRef = useRef(Date.now())
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Elegir no compromete: en modo inmediato la pregunta se bloquea cuando se
  // corrige (botón "Comprobar"), no al tocar una opción. Hasta entonces se
  // puede cambiar de opción, o pasar del blanco a una opción, como en la app.
  const immediate = mode === 'immediate'
  const answered = selected != null || blanked
  const locked = immediate && result != null
  const revealed = locked

  // Cierto mientras se espera la corrección del servidor.
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState(false)

  // Palabras subrayadas del enunciado actual (índices). Se conservan toda la
  // sesión: al volver a una pregunta sigue lo que subrayaste.
  const highlighted = highlights[index] ?? NO_HIGHLIGHTS
  const setHighlighted = (next: Set<number>) => onHighlightChange(index, next)

  // Si "Comprobar" falla (sin red, servidor caído) no se deja al usuario
  // atascado: el botón vuelve a "Siguiente" y esa pregunta se corrige al
  // finalizar, junto con las que falten (ver handleFinish en la página).
  const mustCheck = immediate && answered && result == null && !checkError

  // Imagen de la pregunta: revelar/ocultar con barra espaciadora (o tocando).
  const [imageRevealed, setImageRevealed] = useState(false)
  const [playHint, setPlayHint] = useState(false)
  const hintPlayed = useRef(false)

  // Al cambiar de pregunta, la imagen vuelve a ocultarse.
  useEffect(() => {
    setImageRevealed(false)
    setPlayHint(false)
    setChecking(false)
    setCheckError(false)
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
        // Si se está escribiendo (p. ej. el nombre de un mazo nuevo), el
        // espacio es un espacio, no el atajo de la imagen.
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setImageRevealed((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current])

  const goPrev = () => setIndex((i) => Math.max(0, i - 1))

  // Mapa de preguntas (panel desplegable en la barra de sesión) y aviso antes
  // de finalizar si quedan preguntas sin responder o marcadas.
  const [mapOpen, setMapOpen] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)

  const isAnswered = (i: number) =>
    answers[i]?.selectedIndex != null || answers[i]?.blank === true
  const unansweredIndexes = questions.map((_, i) => i).filter((i) => !isAnswered(i))
  const flaggedIndexes = [...flagged].filter((i) => i < total).sort((a, b) => a - b)

  const goTo = (i: number) => {
    setMapOpen(false)
    setConfirmFinish(false)
    if (i !== index) setIndex(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Estado de cada casilla del mapa. En inmediata, las ya corregidas enseñan
  // su resultado (el usuario ya lo ha visto); en diferida solo si se respondió.
  const mapCellState = (i: number): MapCellState => {
    const r = results[i]
    if (immediate && r) {
      if (r.anulada) return 'annulled'
      return r.result === 'correct' ? 'correct' : r.result === 'blank' ? 'blank' : 'wrong'
    }
    if (answers[i]?.blank) return 'blank'
    if (answers[i]?.selectedIndex != null) return 'answered'
    return 'pending'
  }

  // Finalizar pasa por aquí: si queda algo pendiente, primero se avisa.
  const requestFinish = () => {
    setMapOpen(false)
    if (unansweredIndexes.length > 0 || flaggedIndexes.length > 0) {
      setConfirmFinish(true)
      return
    }
    onFinish()
  }

  const check = async () => {
    if (checking) return
    setChecking(true)
    setCheckError(false)
    try {
      await onCheck(index, secondsOnQuestion())
    } catch {
      setCheckError(true)
    } finally {
      setChecking(false)
    }
  }

  // El botón principal cambia según el estado. Sin responder no hace nada: el
  // blanco tiene que ser una decisión ("Dejar en blanco"), no un clic de más
  // en "Siguiente".
  const goNext = () => {
    if (!answered) return
    if (mustCheck) {
      void check()
      return
    }
    if (isLast) {
      requestFinish()
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
        className="sticky top-4 z-30 mb-8 [@media(max-height:850px)]:mb-5 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-3"
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
          {/* Reloj de la sesión: tiempo total desde que empezó. */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[#E8A598]/15 px-3 py-1 text-xs font-black tabular-nums text-[#d18d80]"
            role="timer"
            aria-label={`Tiempo transcurrido ${formatClock(elapsed)}`}
          >
            <span className="material-symbols-outlined text-base">timer</span>
            {formatClock(elapsed)}
          </span>
          {/* Acciones de la pregunta en la propia barra: antes tenían una
              fila entera encima del enunciado y lo empujaban hacia abajo. */}
          {current ? (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Limpiar el subrayado, a la IZQUIERDA del marcador: el
                  marcador no se mueve cuando esto aparece o desaparece. */}
              <ClearHighlightButton
                compact
                visible={highlighted.size > 0}
                onClear={() => setHighlighted(new Set())}
              />
              {/* Marcar para revisar: sale en el mapa y en el aviso final. */}
              <button
                type="button"
                onClick={() => onToggleFlag(index)}
                aria-pressed={flagged.has(index)}
                aria-label={flagged.has(index) ? 'Quitar marca de revisar' : 'Marcar para revisar'}
                title={flagged.has(index) ? 'Quitar marca de revisar' : 'Marcar para revisar'}
                className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm transition-colors ${
                  flagged.has(index)
                    ? 'border-[#C9A24A]/50 bg-[#FFF7E0] text-[#A9821F]'
                    : 'border-[#E9E4E1] bg-white text-[#7D8A96] hover:border-[#C9A24A]/50 hover:text-[#A9821F]'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={flagged.has(index) ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  flag
                </span>
              </button>
              <SaveToDeckButton questionId={current.id} compact />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setMapOpen((v) => !v)}
            aria-expanded={mapOpen}
            className={`${current ? '' : 'ml-auto '}flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1 text-xs font-black transition-colors ${
              mapOpen
                ? 'border-[#2c3e50] bg-[#2c3e50] text-white'
                : 'border-[#EAE4E2] bg-white text-[#7D8A96] hover:border-[#2c3e50] hover:text-[#2c3e50]'
            }`}
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
            Mapa
            {/* El contador de marcadas entra abriendo su hueco (ancho 0 →
                auto) en vez de aparecer de golpe: así el Mapa y lo que tiene
                a la izquierda se desplazan de forma gradual. */}
            <AnimatePresence initial={false}>
              {flaggedIndexes.length > 0 ? (
                <motion.span
                  key="flag-count"
                  // marginLeft -6 anula el gap-1.5 del botón mientras el hueco
                  // está cerrado, para que no dé un salto de 6 px al montarse.
                  initial={{ width: 0, opacity: 0, marginLeft: -6 }}
                  animate={{ width: 'auto', opacity: 1, marginLeft: 0 }}
                  exit={{ width: 0, opacity: 0, marginLeft: -6 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center overflow-hidden whitespace-nowrap text-[#C9A24A]"
                >
                  <span className="material-symbols-outlined text-sm">flag</span>
                  {flaggedIndexes.length}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </button>
          <span className="text-sm font-black tabular-nums text-[#2c3e50]">
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

        {/* Mapa de preguntas: saltar a cualquiera y ver qué falta */}
        <AnimatePresence initial={false}>
          {mapOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <QuestionMap
                total={total}
                current={index}
                stateOf={(i) => mapCellState(i)}
                flagged={flagged}
                onJump={goTo}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold text-[#7D8A96]">
                  {unansweredIndexes.length === 0
                    ? 'Todas respondidas.'
                    : `${unansweredIndexes.length} sin responder`}
                  {flaggedIndexes.length > 0
                    ? ` · ${flaggedIndexes.length} ${flaggedIndexes.length === 1 ? 'marcada' : 'marcadas'}`
                    : ''}
                </p>
                <button
                  type="button"
                  onClick={requestFinish}
                  disabled={finishing || checking}
                  className="flex items-center gap-1.5 rounded-xl border-2 border-[#2c3e50] bg-[#E8A598] px-3 py-1.5 text-xs font-black text-white disabled:opacity-40"
                  style={{ boxShadow: '3px 3px 0 0 #2c3e50' }}
                >
                  <span className="material-symbols-outlined text-base">done_all</span>
                  Finalizar simulacro
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="w-full space-y-8 [@media(max-height:850px)]:space-y-5">
        <div className="relative">
          {/* La asignatura solo ocupa fila si se muestra. */}
          {showSubject && current?.subject ? (
            <div className="mb-4 [@media(max-height:850px)]:mb-3">
              <span className="inline-block rounded-full border-2 border-[#EAE4E2] bg-white px-3.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#7D8A96]">
                {current.subject}
              </span>
            </div>
          ) : null}
          <h1 className="text-[1.75rem] font-black leading-tight tracking-tight text-[#2C3E50] md:text-[clamp(1.6rem,2.22vw,2rem)]">
            {current ? (
              <HighlightableStatement
                key={current.id}
                text={current.statement}
                highlighted={highlighted}
                onChange={setHighlighted}
              />
            ) : null}
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

        <div className="grid gap-4 [@media(max-height:850px)]:gap-3">
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
                className={`group flex items-center rounded-2xl border-2 p-5 [@media(max-height:850px)]:p-4 text-left transition-all duration-200 disabled:cursor-default disabled:hover:translate-y-0 ${containerClass}`}
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

        {/* La corrección falló (red, servidor): la pregunta sigue abierta */}
        {checkError && !checking ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#C4655A]/40 bg-[#FDF2F0] px-5 py-4 text-sm font-bold text-[#C4655A]">
            <span className="material-symbols-outlined text-base">wifi_off</span>
            <span>
              No se pudo comprobar tu respuesta.
              <span className="block text-xs font-semibold text-[#C4655A]/80">
                Puedes seguir: se corregirá al finalizar.
              </span>
            </span>
            <button
              type="button"
              onClick={() => void check()}
              className="ml-auto rounded-xl border-2 border-[#C4655A] bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#C4655A] transition-colors hover:bg-[#C4655A] hover:text-white"
            >
              Reintentar
            </button>
          </div>
        ) : null}

        {/* Comprobando (modo inmediato, esperando corrección del servidor) */}
        {checking ? (
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-[#FAF7F4] px-5 py-4 text-sm font-bold text-[#7D8A96]">
            <span className="material-symbols-outlined animate-spin text-base text-[#E8A598]">
              progress_activity
            </span>
            Comprobando tu respuesta...
          </div>
        ) : null}

        {/* Anulada: solo se dice al corregir (antes sería una pista). */}
        {revealed && result?.anulada ? <AnnulledNotice /> : null}

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
            disabled={!answered || checking || finishing}
            className="flex items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-8 py-4 font-black text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
          >
            {checking || (isLast && finishing) ? (
              <>
                {checking ? 'Comprobando' : 'Corrigiendo'}
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
              </>
            ) : mustCheck ? (
              <>
                Comprobar
                <span className="material-symbols-outlined">check</span>
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

      {/* Aviso antes de finalizar: preguntas sin responder o marcadas */}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {confirmFinish ? (
                <motion.div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2c3e50]/45 p-4 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setConfirmFinish(false)}
                >
                  <motion.div
                    className="w-full max-w-md rounded-3xl border-2 border-[#2c3e50] bg-white p-6"
                    style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
                    initial={{ y: 16, scale: 0.98 }}
                    animate={{ y: 0, scale: 1 }}
                    exit={{ y: 16, scale: 0.98 }}
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-label="Antes de finalizar"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-2xl text-[#C9A24A]">error</span>
                      <p className="text-base font-black text-[#2C3E50]">¿Finalizar ya?</p>
                    </div>
                    <ul className="mb-4 space-y-1.5 text-sm text-[#2C3E50]">
                      {unansweredIndexes.length > 0 ? (
                        <li>
                          <span className="font-black">{unansweredIndexes.length}</span>{' '}
                          {unansweredIndexes.length === 1 ? 'pregunta sin responder' : 'preguntas sin responder'}
                          <span className="text-[#7D8A96]"> — contarán como en blanco.</span>
                        </li>
                      ) : null}
                      {flaggedIndexes.length > 0 ? (
                        <li>
                          <span className="font-black">{flaggedIndexes.length}</span>{' '}
                          {flaggedIndexes.length === 1 ? 'marcada para revisar' : 'marcadas para revisar'}.
                        </li>
                      ) : null}
                    </ul>
                    <div className="flex flex-col gap-2">
                      {unansweredIndexes.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => goTo(unansweredIndexes[0])}
                          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-2.5 text-sm font-black text-[#2c3e50] transition-transform hover:-translate-y-0.5"
                        >
                          <span className="material-symbols-outlined text-lg">arrow_forward</span>
                          Ir a la primera sin responder ({unansweredIndexes[0] + 1})
                        </button>
                      ) : null}
                      {flaggedIndexes.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => goTo(flaggedIndexes[0])}
                          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-2.5 text-sm font-black text-[#2c3e50] transition-transform hover:-translate-y-0.5"
                        >
                          <span className="material-symbols-outlined text-lg text-[#C9A24A]">flag</span>
                          Revisar marcadas (empieza por la {flaggedIndexes[0] + 1})
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmFinish(false)
                          onFinish()
                        }}
                        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-4 py-2.5 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
                        style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
                      >
                        <span className="material-symbols-outlined text-lg">done_all</span>
                        Finalizar igualmente
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  )
}

type MapCellState = 'pending' | 'answered' | 'blank' | 'correct' | 'wrong' | 'annulled'

const MAP_CELL_STYLE: Record<MapCellState, string> = {
  pending: 'border-[#EAE4E2] bg-white text-[#7D8A96]',
  answered: 'border-[#2c3e50] bg-[#E8A598] text-white',
  blank: 'border-[#2c3e50] bg-[#C9C2BC] text-white',
  correct: 'border-[#2c3e50] bg-[#8BA888] text-white',
  wrong: 'border-[#2c3e50] bg-[#C4655A] text-white',
  annulled:
    'border-[#2c3e50] bg-[repeating-linear-gradient(135deg,#EDE6F3_0,#EDE6F3_4px,#DCD0E8_4px,#DCD0E8_8px)] text-[#6B5A80]',
}

const MAP_LEGEND: ReadonlyArray<{ state: MapCellState; label: string; immediateOnly?: boolean }> = [
  { state: 'pending', label: 'Sin responder' },
  { state: 'answered', label: 'Respondida' },
  { state: 'blank', label: 'En blanco' },
  { state: 'correct', label: 'Acierto', immediateOnly: true },
  { state: 'wrong', label: 'Fallo', immediateOnly: true },
  { state: 'annulled', label: 'Anulada', immediateOnly: true },
]

/** Rejilla de todas las preguntas del simulacro: saltar a cualquiera. */
function QuestionMap({
  total,
  current,
  stateOf,
  flagged,
  onJump,
}: {
  total: number
  current: number
  stateOf: (i: number) => MapCellState
  flagged: ReadonlySet<number>
  onJump: (i: number) => void
}) {
  const states = Array.from({ length: total }, (_, i) => stateOf(i))
  const showsResults = states.some((s) => s === 'correct' || s === 'wrong' || s === 'annulled')
  return (
    <div className="mt-3 border-t border-[#F0EBE8] pt-3">
      {/* Con 210 preguntas son 21 filas: se limita el alto y se hace scroll.
          El scroll recorta lo que se sale de la caja, así que el relleno (p-2)
          deja sitio al anillo de la pregunta actual y a la banderita de las
          marcadas, que sobresalen de cada casilla. */}
      <div className="grid max-h-[45vh] grid-cols-8 gap-2.5 overflow-y-auto p-2 sm:grid-cols-10 md:grid-cols-15">
        {states.map((state, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Ir a la pregunta ${i + 1}`}
            aria-current={i === current ? 'step' : undefined}
            className={`relative flex h-8 items-center justify-center rounded-lg border-2 text-[11px] font-black tabular-nums transition-transform hover:-translate-y-0.5 ${
              MAP_CELL_STYLE[state]
            } ${i === current ? 'ring-2 ring-[#2c3e50] ring-offset-2' : ''}`}
          >
            {i + 1}
            {flagged.has(i) ? (
              <span
                className="material-symbols-outlined pointer-events-none absolute -right-2 -top-2 rounded-full bg-white text-[13px] leading-none text-[#C9A24A]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                flag
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-[#7D8A96]">
        {MAP_LEGEND.filter((l) =>
          l.state === 'annulled'
            ? states.includes('annulled')
            : !l.immediateOnly || showsResults,
        ).map((l) => (
          <span key={l.state} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded border-2 ${MAP_CELL_STYLE[l.state]}`} />
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span
            className="material-symbols-outlined text-[13px] text-[#C9A24A]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            flag
          </span>
          Marcada
        </span>
      </div>
    </div>
  )
}
