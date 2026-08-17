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
import { AmbientTrace, HeartConduction, useAnimationLoop } from './academia/scenes'
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

/**
 * El corazón de la portada, con su propio estado.
 *
 * Va aparte a propósito: el bucle de animación actualiza estado 60 veces por
 * segundo y, si viviera en `ModuleMap`, repintaría las nueve tarjetas de la
 * ruta en cada fotograma.
 */
function BeatingHeart() {
  const [f, setF] = useState(0)
  useAnimationLoop((t) => setF((t / 3.6) % 1), true)

  return (
    <motion.div
      className="hidden h-44 w-36 shrink-0 md:block lg:h-52 lg:w-44"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <HeartConduction f={f} />
    </motion.div>
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

  // El primer módulo sin terminar es por donde se retoma la ruta.
  const nextIndex = MODULES.findIndex((m) => !progress[m.id]?.done)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      {/* ─── Portada ─────────────────────────────────────────────────── */}
      <motion.header
        className="relative overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-gradient-to-br from-white via-[#FFF9F7] to-[#FFEFEA] px-6 py-8 shadow-[7px_7px_0_0_#2c3e50] sm:px-10 sm:py-10"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <AmbientTrace />

        <div className="relative z-10 flex flex-col items-start gap-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#E8A598]/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#d18d80]">
              <span className="material-symbols-outlined text-sm">school</span>
              Ruta guiada
            </span>
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-[#2C3E50] sm:text-5xl">
              Academia ECG
            </h1>
            <p className="mt-3 text-lg font-light leading-relaxed text-[#7D8A96]">
              De la chispa del nodo sinusal al diagnóstico razonado. {MODULES.length} módulos que se desbloquean a
              medida que avanzas.
            </p>

            <div className="mt-6 flex items-center gap-4">
              <div className="h-2.5 w-48 overflow-hidden rounded-full bg-white/80 ring-1 ring-[#EAE4E2]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#E8A598] to-[#d18d80]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(done / MODULES.length) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <span className="text-sm font-black text-[#2C3E50] tabular-nums">
                {done}/{MODULES.length}
              </span>
            </div>
          </div>

          <BeatingHeart />
        </div>
      </motion.header>

      {/* ─── Ruta ────────────────────────────────────────────────────── */}
      <nav className="grid gap-5 md:grid-cols-2" aria-label="Ruta de aprendizaje">
        {MODULES.map((m, i) => {
          const unlocked = isUnlocked(progress, i)
          const isDone = Boolean(progress[m.id]?.done)
          const fraction = moduleProgress(progress, i)
          const circumference = 2 * Math.PI * 26
          const isNext = i === nextIndex

          return (
            <motion.button
              key={m.id}
              type="button"
              disabled={!unlocked}
              onClick={() => onOpen(i, isDone ? 0 : (progress[m.id]?.step ?? 0))}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className={`group relative flex items-center gap-5 overflow-hidden rounded-3xl border-2 p-5 text-left transition-all sm:p-6 ${
                unlocked
                  ? 'border-[#2c3e50] bg-white shadow-[5px_5px_0_0_#2c3e50] hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#2c3e50]'
                  : 'cursor-not-allowed border-[#EAE4E2] bg-[#F7F4F2]'
              }`}
            >
              {/* Tinte del módulo, que asoma al pasar el ratón */}
              {unlocked ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.09] transition-opacity duration-300 group-hover:opacity-20"
                  style={{ backgroundColor: m.color }}
                />
              ) : null}

              <div className="relative h-16 w-16 shrink-0">
                <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="#EFE9E6" strokeWidth="5" />
                  <motion.circle
                    cx="30"
                    cy="30"
                    r="26"
                    fill="none"
                    stroke={unlocked ? m.color : '#D9D2CE'}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference * (1 - fraction) }}
                    transition={{ duration: 0.7, delay: 0.1 + 0.05 * i, ease: 'easeOut' }}
                  />
                </svg>
                {/* El centrado va en un envoltorio, no en el propio icono: la
                    hoja de Material Symbols llega sin capa de cascada y su
                    `display` gana a las utilidades de Tailwind v4. */}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{ color: unlocked ? m.color : '#B5ADA8' }}
                  >
                    {unlocked ? m.icon : 'lock'}
                  </span>
                </span>
              </div>

              <div className="relative min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/60">
                    Módulo {i + 1}
                  </span>
                  {/* La marca de completado va aquí y no sobre el anillo: encima
                      le comía un trozo y parecía que el progreso no llegaba al final. */}
                  {isDone ? (
                    <span className="flex items-center gap-1 rounded-full bg-[#8BA888]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#6a8a67]">
                      <span className="material-symbols-outlined text-[11px]">check</span>
                      Completado
                    </span>
                  ) : null}
                  {isNext && unlocked ? (
                    <span className="rounded-full bg-[#E8A598] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                      Continuar
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-lg font-black leading-tight text-[#2C3E50]">{m.title}</p>
                <p className="mt-1 text-sm leading-snug text-[#7D8A96]">{m.subtitle}</p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-[#7D8A96]/50">
                  {m.steps.length} pasos
                </p>
              </div>

              {unlocked ? (
                <span className="material-symbols-outlined shrink-0 text-2xl text-[#7D8A96]/40 transition-transform group-hover:translate-x-1 group-hover:text-[#E8A598]">
                  arrow_forward
                </span>
              ) : null}
            </motion.button>
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
    setStepIndex(stepIndex - 1)
    // Volver atrás no vuelve a exigir resolver lo ya resuelto.
    setSolved(true)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* ─── Barra del módulo ───────────────────────────────────────── */}
      <motion.header
        className="flex items-center gap-4 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-3 shadow-[4px_4px_0_0_#2c3e50]"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <button
          type="button"
          onClick={goBack}
          className="flex items-center justify-center rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#2C3E50]"
          aria-label={stepIndex === 0 ? 'Volver al mapa' : 'Paso anterior'}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: lesson.color }}
        >
          <span className="material-symbols-outlined text-lg">{lesson.icon}</span>
        </span>

        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-black leading-tight text-[#2C3E50]">{lesson.title}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">
            Módulo {moduleIndex + 1}
          </p>
        </div>

        <div className="flex flex-1 items-center gap-1.5" aria-label={`Paso ${stepIndex + 1} de ${lesson.steps.length}`}>
          {lesson.steps.map((_, i) => (
            <motion.span
              key={i}
              className="h-1.5 flex-1 rounded-full"
              animate={{
                backgroundColor: i === stepIndex ? lesson.color : i < stepIndex ? `${lesson.color}66` : '#EAE4E2',
              }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        <span className="shrink-0 text-xs font-black text-[#7D8A96] tabular-nums">
          {stepIndex + 1}/{lesson.steps.length}
        </span>
      </motion.header>

      {/* ─── Escena del paso ────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.section
          key={stepIndex}
          className="rounded-3xl border-2 border-[#EAE4E2] bg-white/70 p-5 backdrop-blur-sm sm:p-8"
          initial={{ opacity: 0, x: 40, filter: 'blur(6px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: -40, filter: 'blur(6px)' }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-6">
            <motion.p
              className="text-[11px] font-black uppercase tracking-[0.16em]"
              style={{ color: lesson.color }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
            >
              {step.kicker}
            </motion.p>
            <motion.h2
              className="mt-1.5 text-3xl font-black leading-[1.1] tracking-tight text-[#2C3E50] sm:text-4xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, ease: 'easeOut' }}
            >
              {step.title}
            </motion.h2>
          </div>

          <StepRenderer step={step} onSolved={handleSolved} color={lesson.color} />
        </motion.section>
      </AnimatePresence>

      {/* ─── Pie fijo ───────────────────────────────────────────────── */}
      <div className="sticky bottom-4 z-20">
        <motion.button
          type="button"
          disabled={!solved}
          onClick={goNext}
          animate={
            solved
              ? { opacity: 1, y: 0, boxShadow: '5px 5px 0 0 #2c3e50' }
              : { opacity: 0.55, y: 0, boxShadow: '0px 0px 0 0 #2c3e50' }
          }
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-6 py-4 text-base font-black transition-colors ${
            solved
              ? 'border-[#2c3e50] bg-[#E8A598] text-white hover:bg-[#d18d80]'
              : 'cursor-not-allowed border-[#EAE4E2] bg-white text-[#7D8A96]'
          }`}
        >
          {solved ? (isLast ? 'Terminar módulo' : 'Continuar') : 'Completa la actividad para seguir'}
          {solved ? <span className="material-symbols-outlined">arrow_forward</span> : null}
        </motion.button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   MÓDULO COMPLETADO
═══════════════════════════════════════════════════════════════════════════ */
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  x: (i % 7) * 60 - 180,
  delay: i * 0.045,
  color: ['#E8A598', '#8BA888', '#C9A24A', '#7CA3C9'][i % 4],
}))

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
      className="relative mx-auto flex w-full max-w-xl flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white px-6 py-12 text-center shadow-[7px_7px_0_0_#2c3e50]"
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Confeti: cae una vez, sin bucle, para no distraer del texto */}
      {CONFETTI.map((c, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="absolute left-1/2 top-0 h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: c.color }}
          initial={{ y: -30, x: c.x, opacity: 0, rotate: 0 }}
          animate={{ y: 420, opacity: [0, 1, 1, 0], rotate: 420 }}
          transition={{ duration: 2.1, delay: 0.25 + c.delay, ease: 'easeIn' }}
        />
      ))}

      <motion.div
        className="relative flex items-center justify-center rounded-full border-2 border-[#2c3e50] p-5 text-white"
        style={{ backgroundColor: lesson.color }}
        initial={{ scale: 0.5, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 15, delay: 0.1 }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 44 }}>verified</span>
      </motion.div>

      <div className="relative">
        <h2 className="text-3xl font-black tracking-tight text-[#2C3E50]">Módulo completado</h2>
        <p className="mt-1 text-base text-[#7D8A96]">{lesson.title}</p>
      </div>

      <div className="relative mt-2 flex w-full flex-col gap-3">
        {next && canContinue ? (
          <button
            type="button"
            onClick={onNext}
            className="rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-6 py-3.5 text-base font-black text-white shadow-[4px_4px_0_0_#2c3e50] transition-transform hover:-translate-y-0.5"
          >
            Módulo {moduleIndex + 2}: {next.title}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onHome}
          className="rounded-2xl border-2 border-[#EAE4E2] bg-white px-6 py-3 text-sm font-bold text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
        >
          Volver al mapa
        </button>
        {!next ? (
          <Link
            href="/studio/electros/explorador"
            className="text-sm font-bold text-[#d18d80] hover:underline"
          >
            Practicar en el explorador de 12 derivaciones →
          </Link>
        ) : null}
      </div>
    </motion.section>
  )
}
