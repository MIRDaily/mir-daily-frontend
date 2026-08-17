'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { MODULES } from '@/lib/electros/academia/curriculum'
import {
  commitProgress,
  countDone,
  getProgressSnapshot,
  getServerProgressSnapshot,
  isUnlocked,
  moduleProgress,
  subscribeToProgress,
  withModuleDone,
  withStepReached,
} from '@/lib/electros/academia/progress'
import { AUTO_UNLOCK, StepRenderer } from './academia/steps'

type View = { screen: 'map' } | { screen: 'lesson'; moduleIndex: number } | { screen: 'done'; moduleIndex: number }

export default function AcademiaClient() {
  const progress = useSyncExternalStore(subscribeToProgress, getProgressSnapshot, getServerProgressSnapshot)
  const [view, setView] = useState<View>({ screen: 'map' })
  // Paso por el que entrar al módulo (se reanuda donde lo dejó el alumno).
  const [startStep, setStartStep] = useState(0)

  const openModule = useCallback((moduleIndex: number, step: number) => {
    setStartStep(step)
    setView({ screen: 'lesson', moduleIndex })
  }, [])

  if (view.screen === 'map') {
    return <ModuleMap progress={progress} onOpen={openModule} />
  }

  if (view.screen === 'done') {
    return (
      <ModuleDone
        moduleIndex={view.moduleIndex}
        canContinue={isUnlocked(progress, view.moduleIndex + 1)}
        onNext={() => openModule(view.moduleIndex + 1, 0)}
        onHome={() => setView({ screen: 'map' })}
      />
    )
  }

  return (
    <LessonPlayer
      key={view.moduleIndex}
      moduleIndex={view.moduleIndex}
      startStep={startStep}
      onExit={() => setView({ screen: 'map' })}
      onFinish={() => setView({ screen: 'done', moduleIndex: view.moduleIndex })}
    />
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MAPA DE LA RUTA
═══════════════════════════════════════════════════════════════════════════ */
function ModuleMap({
  progress,
  onOpen,
}: {
  progress: ReturnType<typeof getProgressSnapshot>
  onOpen: (moduleIndex: number, startStep: number) => void
}) {
  const done = countDone(progress)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-[#E8A598] p-3 text-white shadow-md shadow-[#E8A598]/25">
          <span className="material-symbols-outlined text-3xl">cardiology</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-[#2C3E50] sm:text-4xl">Academia ECG</h1>
        <p className="max-w-md text-base font-light text-[#7D8A96]">
          Aprende a leer un electro paso a paso: de la chispa eléctrica del corazón al diagnóstico.
        </p>
        <div className="flex w-full max-w-sm items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EAE4E2]">
            <motion.div
              className="h-full rounded-full bg-[#E8A598]"
              initial={false}
              animate={{ width: `${(done / MODULES.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className="shrink-0 text-xs font-bold text-[#7D8A96] tabular-nums">
            {done}/{MODULES.length} módulos
          </span>
        </div>
      </header>

      <nav className="flex flex-col gap-2.5" aria-label="Ruta de aprendizaje">
        {MODULES.map((m, i) => {
          const unlocked = isUnlocked(progress, i)
          const isDone = Boolean(progress[m.id]?.done)
          const fraction = moduleProgress(progress, i)
          const circumference = 2 * Math.PI * 19

          return (
            <button
              key={m.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onOpen(i, isDone ? 0 : (progress[m.id]?.step ?? 0))}
              className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                unlocked
                  ? 'border-[#EAE4E2] bg-white shadow-sm hover:-translate-y-0.5 hover:border-[#2c3e50] hover:shadow-[3px_3px_0_0_#2c3e50]'
                  : 'cursor-not-allowed border-[#EAE4E2]/60 bg-[#F7F4F2] opacity-60'
              }`}
            >
              <div className="relative h-11 w-11 shrink-0">
                <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                  <circle cx="22" cy="22" r="19" fill="none" stroke="#EFE9E6" strokeWidth="4" />
                  <circle
                    cx="22"
                    cy="22"
                    r="19"
                    fill="none"
                    stroke={m.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - fraction)}
                  />
                </svg>
                <span
                  className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-lg"
                  style={{ color: unlocked ? m.color : '#B5ADA8' }}
                >
                  {unlocked ? m.icon : 'lock'}
                </span>
                {isDone ? (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8BA888] text-white">
                    <span className="material-symbols-outlined text-[10px]">check</span>
                  </span>
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">
                  Módulo {i + 1}
                </span>
                <p className="text-sm font-bold text-[#2C3E50]">{m.title}</p>
                <p className="truncate text-xs text-[#7D8A96]">{m.subtitle}</p>
              </div>

              {unlocked ? (
                <span className="material-symbols-outlined shrink-0 text-lg text-[#7D8A96]/50">arrow_forward</span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <p className="text-center text-xs text-[#7D8A96]/70">
        Tu progreso se guarda en este dispositivo. La Academia no cuenta para tus estadísticas de rendimiento.
      </p>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   REPRODUCTOR DE LECCIONES
═══════════════════════════════════════════════════════════════════════════ */
function LessonPlayer({
  moduleIndex,
  startStep,
  onExit,
  onFinish,
}: {
  moduleIndex: number
  startStep: number
  onExit: () => void
  onFinish: () => void
}) {
  const lesson = MODULES[moduleIndex]
  const [stepIndex, setStepIndex] = useState(() => Math.min(startStep, lesson.steps.length - 1))
  const step = lesson.steps[stepIndex]
  // Los pasos de solo lectura entran ya desbloqueados; el resto esperan al gesto.
  const [solved, setSolved] = useState(() => AUTO_UNLOCK.has(lesson.steps[stepIndex].type))

  const handleSolved = useCallback(() => setSolved(true), [])

  const isLast = stepIndex === lesson.steps.length - 1

  const goNext = () => {
    if (isLast) {
      commitProgress(withModuleDone(getProgressSnapshot(), lesson.id, lesson.steps.length))
      onFinish()
      return
    }
    const next = stepIndex + 1
    commitProgress(withStepReached(getProgressSnapshot(), lesson.id, next))
    setStepIndex(next)
    setSolved(AUTO_UNLOCK.has(lesson.steps[next].type))
  }

  const goBack = () => {
    if (stepIndex === 0) {
      onExit()
      return
    }
    const prev = stepIndex - 1
    setStepIndex(prev)
    // Volver atrás no vuelve a exigir resolver lo ya resuelto.
    setSolved(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#2C3E50]"
          aria-label="Paso anterior"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <div className="flex flex-1 gap-1" aria-label={`Paso ${stepIndex + 1} de ${lesson.steps.length}`}>
          {lesson.steps.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === stepIndex ? 'bg-[#E8A598]' : i < stepIndex ? 'bg-[#E8A598]/40' : 'bg-[#EAE4E2]'
              }`}
            />
          ))}
        </div>

        <span className="shrink-0 text-xs font-semibold text-[#7D8A96]">{lesson.title}</span>
      </header>

      <AnimatePresence mode="wait">
        <motion.section
          key={stepIndex}
          className="rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm sm:p-6"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: lesson.color }}>
            {step.kicker}
          </p>
          <h2 className="mb-4 text-xl font-bold text-[#2C3E50] sm:text-2xl">{step.title}</h2>
          <StepRenderer step={step} onSolved={handleSolved} color={lesson.color} />
        </motion.section>
      </AnimatePresence>

      <button
        type="button"
        disabled={!solved}
        onClick={goNext}
        className="w-full rounded-xl bg-[#E8A598] px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] disabled:cursor-not-allowed disabled:bg-[#E8A598]/35 disabled:shadow-none"
      >
        {isLast ? 'Terminar módulo' : 'Continuar'}
      </button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MÓDULO COMPLETADO
═══════════════════════════════════════════════════════════════════════════ */
function ModuleDone({
  moduleIndex,
  canContinue,
  onNext,
  onHome,
}: {
  moduleIndex: number
  canContinue: boolean
  onNext: () => void
  onHome: () => void
}) {
  const lesson = MODULES[moduleIndex]
  const next = MODULES[moduleIndex + 1]

  return (
    <motion.section
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-[#EAE4E2] bg-white px-6 py-10 text-center shadow-sm"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <motion.div
        className="rounded-full p-4 text-white"
        style={{ backgroundColor: lesson.color }}
        initial={{ scale: 0.6, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      >
        <span className="material-symbols-outlined text-4xl">verified</span>
      </motion.div>

      <h2 className="text-2xl font-bold text-[#2C3E50]">Módulo completado</h2>
      <p className="text-sm text-[#7D8A96]">{lesson.title}</p>

      <div className="mt-2 flex w-full flex-col gap-3">
        {next && canContinue ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-[#E8A598] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d18d80]"
          >
            Módulo {moduleIndex + 2}: {next.title}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onHome}
          className="rounded-xl border border-[#7D8A96]/30 bg-white px-6 py-3 text-sm font-semibold text-[#7D8A96] transition-colors hover:bg-[#F2EFED]"
        >
          Volver al mapa
        </button>
        {!next ? (
          <Link
            href="/studio/electros/explorador"
            className="text-xs font-semibold text-[#d18d80] hover:underline"
          >
            Practicar en el explorador de 12 derivaciones →
          </Link>
        ) : null}
      </div>
    </motion.section>
  )
}
