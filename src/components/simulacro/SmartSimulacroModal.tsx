'use client'

// Popup del "Simulacro a tu medida" (botón de Studio).
//
// El usuario no elige nada del contenido: el backend arma una tanda de 30
// preguntas centrada en sus puntos débiles. Aquí solo se decide el modo de
// corrección, y se enseña antes el desglose real por asignatura de la propia
// tanda —calculado, no inventado—.
//
// Las preguntas se piden al abrir el popup; "Empezar" las guarda en
// sessionStorage y navega al runner (/studio/simulacro), que las recoge y
// arranca directo. El padre monta este componente solo cuando está abierto,
// así que cada apertura es una carga nueva.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { fetchSmartSimulacro } from '@/lib/simulacro/queries'
import type { SimulacroMode, SmartSimulacroPlan } from '@/lib/simulacro/types'

export const SMART_SIM_STORAGE_KEY = 'mirdaily:smartSim'

type SmartSimulacroModalProps = {
  onClose: () => void
}

// Mismas dos opciones que el creador normal (SimulacroBuilder). El orden importa:
// primero la que imita al examen real, que es la que conviene la mayoría de las veces.
const MODE_OPTIONS: ReadonlyArray<{
  value: SimulacroMode
  title: string
  description: string
  icon: string
}> = [
  {
    value: 'deferred',
    title: 'Corrección al final',
    description: 'Sin pistas durante el test; repasas todo al terminar.',
    icon: 'flag',
  },
  {
    value: 'immediate',
    title: 'Corrección inmediata',
    description: 'Ves si aciertas y la explicación justo al responder.',
    icon: 'bolt',
  },
] as const

// `false` en el servidor, `true` en el cliente, sin efecto ni desajuste de
// hidratación: el portal a document.body solo se pinta cuando hay DOM.
const subscribeNoop = () => () => {}
function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  )
}

export default function SmartSimulacroModal({ onClose }: SmartSimulacroModalProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const isClient = useIsClient()
  const [plan, setPlan] = useState<SmartSimulacroPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<SimulacroMode>('deferred')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchSmartSimulacro(30)
      .then((p) => {
        if (!active) return
        setPlan(p)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(
          err instanceof Error ? err.message : 'No se pudo generar tu simulacro a medida.',
        )
        setPlan(null)
      })
    return () => {
      active = false
    }
  }, [attempt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const loading = plan == null && error == null

  const retry = () => {
    setPlan(null)
    setError(null)
    setAttempt((n) => n + 1)
  }

  const goToNormalBuilder = () => {
    onClose()
    router.push('/studio/simulacro')
  }

  const start = () => {
    if (!plan) return
    try {
      sessionStorage.setItem(
        SMART_SIM_STORAGE_KEY,
        JSON.stringify({ questions: plan.questions, mode, ts: Date.now() }),
      )
    } catch {
      /* modo incógnito o storage lleno: se sigue igual, el runner hará su propio
         fallback al creador normal si no encuentra nada. */
    }
    onClose()
    router.push('/studio/simulacro')
  }

  if (!isClient) return null

  const insufficient =
    plan != null && (plan.coverage === 'insufficient' || plan.questions.length === 0)

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#2c3e50]/55 p-0 backdrop-blur-md sm:items-center sm:p-4"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-2 border-[#2c3e50] bg-white sm:max-h-[88vh] sm:rounded-3xl"
        style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
        initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Simulacro a tu medida"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 border-b-2 border-[#2c3e50] bg-[#FFF5F2] px-5 py-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#d18d80]">
              <span className="material-symbols-outlined text-sm">target</span>
              A tu medida
            </span>
            <h2 className="mt-1.5 text-xl font-black text-[#2c3e50]">Simulacro a tu medida</h2>
            <p className="text-sm text-[#7D8A96]">
              {loading
                ? 'Buscando dónde flojeas…'
                : insufficient
                  ? 'Aún sin datos suficientes de tus fallos.'
                  : plan
                    ? `${plan.questions.length} preguntas centradas en donde peor vas ahora mismo.`
                    : 'No se pudo generar.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-white hover:text-[#C4655A]"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#EAE4E2] border-t-[#E8A598]" />
              <p className="text-sm font-bold text-[#7D8A96]">
                Buscando dónde flojeas y armando la tanda…
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="material-symbols-outlined text-4xl text-[#C4655A]">error</span>
              <p className="max-w-sm text-sm font-semibold text-[#C4655A]">{error}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#EAE4E2] bg-white px-5 py-3 text-sm font-bold text-[#7D8A96] transition-all hover:border-[#2c3e50] hover:text-[#2C3E50]"
                >
                  <span className="material-symbols-outlined text-lg">refresh</span>
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={goToNormalBuilder}
                  className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-5 py-3 text-sm font-black text-white"
                  style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
                >
                  Ir al creador normal
                </button>
              </div>
            </div>
          ) : insufficient ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="material-symbols-outlined text-4xl text-[#E8A598]">target</span>
              <p className="text-lg font-black text-[#2c3e50]">
                Todavía no te conocemos lo suficiente
              </p>
              <p className="max-w-md text-sm text-[#7D8A96]">
                Aún no tenemos suficientes datos de tus fallos para armar un simulacro
                centrado en ellos. Responde unas cuantas preguntas más —el Daily, un
                simulacro normal, tus mazos— y vuelve.
              </p>
              <button
                type="button"
                onClick={goToNormalBuilder}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-5 py-3 text-sm font-black text-white"
                style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
              >
                <span className="material-symbols-outlined text-base">tune</span>
                Crear un simulacro normal
              </button>
            </div>
          ) : plan ? (
            <div className="flex flex-col gap-5">
              {/* Qué entra */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#7D8A96]">donut_small</span>
                  <h3 className="text-base font-black text-[#2c3e50]">Qué entra</h3>
                  {plan.coverage === 'mixed' ? (
                    <span className="ml-auto rounded-full bg-[#E8A598]/15 px-2.5 py-1 text-[11px] font-black text-[#d18d80]">
                      Completado con asignaturas flojas
                    </span>
                  ) : null}
                </div>
                <ul className="flex flex-col gap-1.5 rounded-2xl border-2 border-[#EAE4E2] bg-[#FAF7F4] p-4">
                  {plan.composition.map((row) => (
                    <li
                      key={row.subjectName}
                      className="flex items-baseline justify-between gap-3 border-b border-dashed border-[#EAE4E2] pb-1.5 text-sm last:border-0 last:pb-0"
                    >
                      <span className="min-w-0 truncate font-semibold text-[#2c3e50]">
                        {row.subjectName}
                      </span>
                      <span className="shrink-0 font-black tabular-nums text-[#7D8A96]">
                        {row.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Modo de corrección */}
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#7D8A96]">rule</span>
                  <h3 className="text-base font-black text-[#2c3e50]">Modo de corrección</h3>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {MODE_OPTIONS.map((option) => {
                    const active = mode === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                          active
                            ? 'border-[#2c3e50] bg-[#fff0ec]'
                            : 'border-[#EAE4E2] bg-white hover:-translate-y-0.5 hover:border-[#2c3e50]'
                        }`}
                        style={active ? { boxShadow: '4px 4px 0 0 #2c3e50' } : undefined}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            active ? 'bg-[#E8A598] text-white' : 'bg-[#F2EFED] text-[#7D8A96]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl">{option.icon}</span>
                        </span>
                        <span>
                          <span className="block text-sm font-black text-[#2c3e50]">
                            {option.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#7D8A96]">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>
          ) : null}
        </div>

        {/* Pie: solo cuando hay una tanda lista */}
        {plan && !insufficient ? (
          <div className="border-t-2 border-[#2c3e50] bg-white px-5 py-4">
            <button
              type="button"
              onClick={start}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#E8A598] px-6 py-3.5 text-base font-black text-white transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
            >
              <span className="material-symbols-outlined">play_arrow</span>
              Empezar
            </button>
          </div>
        ) : null}
      </motion.div>
    </motion.div>,
    document.body,
  )
}
