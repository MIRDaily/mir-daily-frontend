'use client'

// Página del creador de simulacros (placeholder, aislado bajo `simulacro/`).
// Orquesta las fases builder → running → results. Las preguntas y su corrección
// se obtienen del BACKEND (autenticado); el cliente nunca recibe la respuesta
// correcta hasta que el usuario responde y el servidor la valida (/check).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SimulacroBuilder from '@/components/simulacro/SimulacroBuilder'
import SimulacroRunner from '@/components/simulacro/SimulacroRunner'
import SimulacroResultsGrid from '@/components/simulacro/SimulacroResultsGrid'
import {
  checkSimulacroAnswers,
  fetchSimulacroQuestions,
  finishSimulacroSession,
} from '@/lib/simulacro/queries'
import type {
  SimulacroAnswer,
  SimulacroConfig,
  SimulacroPhase,
  SimulacroQuestion,
  SimulacroResult,
} from '@/lib/simulacro/types'

// Mensaje único reutilizado en el modal propio (botón "Salir", atrás del
// navegador, cualquier enlace de navegación) mientras hay un simulacro en
// curso. Cerrar/recargar la pestaña usa el diálogo nativo del navegador
// aparte (ver el useEffect de "beforeunload" más abajo): ese SÍ es
// obligatoriamente nativo, ningún navegador deja sustituirlo por UI propia.
const EXIT_WARNING =
  'Si sales ahora no podrás continuar este simulacro ni se guardará en tu historial. ¿Seguro que quieres salir?'

export default function SimulacroPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<SimulacroPhase>('builder')
  // Modal propio de "¿seguro que quieres salir?" (no el nativo del navegador)
  // para el botón "Salir", el botón atrás y los enlaces de navegación.
  // Cerrar/recargar la pestaña sí usa el diálogo nativo más abajo: ningún
  // navegador permite sustituirlo por una UI propia (medida anti-phishing).
  const [showExitModal, setShowExitModal] = useState(false)
  const exitResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const [mode, setMode] = useState<SimulacroConfig['mode']>('immediate')
  const [questions, setQuestions] = useState<SimulacroQuestion[]>([])
  const [answers, setAnswers] = useState<SimulacroAnswer[]>([])
  // Correcciones alineadas por índice de pregunta (null hasta que llegan).
  const [results, setResults] = useState<(SimulacroResult | null)[]>([])
  const [generating, setGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  // Identificador de la sesión de simulacro: el backend lo usa para persistir
  // cada respuesta (analítica) de forma idempotente.
  const sessionIdRef = useRef<string | null>(null)
  // Copia siempre actualizada de answers para leerla de forma síncrona
  // (p. ej. finalizar justo después de marcar la última en blanco).
  const answersRef = useRef<SimulacroAnswer[]>([])

  const updateAnswers = (
    updater: (prev: SimulacroAnswer[]) => SimulacroAnswer[],
  ) => {
    setAnswers((prev) => {
      const next = updater(prev)
      answersRef.current = next
      return next
    })
  }

  const handleSubmit = async (config: SimulacroConfig) => {
    setGenerating(true)
    setGenerationError(null)
    try {
      const fetched = await fetchSimulacroQuestions(config)
      if (fetched.length === 0) {
        setGenerationError(
          'No se encontraron preguntas con esa selección. Prueba con otras asignaturas o temas.',
        )
        return
      }
      setQuestions(fetched)
      updateAnswers(() => fetched.map(() => ({ selectedIndex: null })))
      setResults(fetched.map(() => null))
      setMode(config.mode)
      sessionIdRef.current = crypto.randomUUID()
      setPhase('running')
    } catch (err: unknown) {
      setGenerationError(
        err instanceof Error
          ? `No se pudieron cargar las preguntas: ${err.message}`
          : 'No se pudieron cargar las preguntas.',
      )
    } finally {
      setGenerating(false)
    }
  }

  // Corrección inmediata de una pregunta en el servidor (respuesta o blanco).
  const checkImmediate = (
    questionIndex: number,
    selectedIndex: number | null,
    timeSpent?: number,
  ) => {
    const question = questions[questionIndex]
    if (!question) return
    checkSimulacroAnswers(
      [{ questionId: question.id, selectedIndex, timeSpent }],
      sessionIdRef.current ?? undefined,
    )
      .then((res) => {
        const result = res[0]
        if (!result) return
        setResults((prev) => {
          const next = [...prev]
          next[questionIndex] = result
          return next
        })
      })
      .catch(() => {
        /* Si falla la corrección, la pregunta queda sin revelar pero el
           usuario puede continuar. */
      })
  }

  const handleSelect = (
    questionIndex: number,
    optionIndex: number,
    timeSpent?: number,
  ) => {
    updateAnswers((prev) => {
      const next = [...prev]
      next[questionIndex] = { selectedIndex: optionIndex, timeSpent }
      return next
    })

    if (mode === 'immediate') {
      checkImmediate(questionIndex, optionIndex, timeSpent)
    }
  }

  // Dejar la pregunta en blanco (no puntúa ni penaliza, pero se registra).
  const handleBlank = (questionIndex: number, timeSpent?: number) => {
    updateAnswers((prev) => {
      const next = [...prev]
      next[questionIndex] = { selectedIndex: null, blank: true, timeSpent }
      return next
    })

    if (mode === 'immediate') {
      checkImmediate(questionIndex, null, timeSpent)
    }
  }

  const handleFinish = async () => {
    // En diferido corregimos todo de una vez al terminar.
    if (mode === 'deferred') {
      setFinishing(true)
      try {
        const payload = questions.map((q, i) => ({
          questionId: q.id,
          selectedIndex: answersRef.current[i]?.selectedIndex ?? null,
          timeSpent: answersRef.current[i]?.timeSpent,
        }))
        const res = await checkSimulacroAnswers(
          payload,
          sessionIdRef.current ?? undefined,
        )
        const byId = new Map(res.map((r) => [r.questionId, r]))
        setResults(questions.map((q) => byId.get(q.id) ?? null))
      } catch {
        // Si falla, mostramos la rejilla igualmente (sin corrección).
      } finally {
        setFinishing(false)
      }
    }
    setPhase('results')

    // Guarda el simulacro en el historial (best-effort: el backend solo lo
    // guarda de verdad si hay >=50 respuestas persistidas para esta sesión;
    // un fallo de red aquí no debe afectar a la pantalla de resultados).
    if (sessionIdRef.current) {
      finishSimulacroSession(sessionIdRef.current, mode).catch(() => {})
    }
  }

  const handleRestart = () => {
    setQuestions([])
    updateAnswers(() => [])
    setResults([])
    setGenerationError(null)
    sessionIdRef.current = null
    setPhase('builder')
  }

  // Abre el modal propio y devuelve una promesa que se resuelve cuando el
  // usuario elige "Salir" (true) o "Cancelar" (false).
  const askToLeave = () =>
    new Promise<boolean>((resolve) => {
      exitResolverRef.current = resolve
      setShowExitModal(true)
    })

  const resolveExit = (confirmed: boolean) => {
    setShowExitModal(false)
    exitResolverRef.current?.(confirmed)
    exitResolverRef.current = null
  }

  // El botón "Salir" del runner ya no descarta el progreso sin avisar.
  const handleExitClick = async () => {
    if (await askToLeave()) {
      handleRestart()
    }
  }

  // Cerrar/recargar la pestaña o navegar a una URL externa mientras hay un
  // simulacro en curso (mismo patrón que ZenRoomClient.tsx: "exit friction").
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (phase === 'running') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase])

  // Botón "atrás" del navegador: se empuja un estado centinela al entrar en
  // la fase "running"; el primer "atrás" lo consume y dispara la
  // confirmación en vez de abandonar la página directamente.
  useEffect(() => {
    if (phase !== 'running') return
    window.history.pushState({ simulacroGuard: true }, '')
    const onPopState = () => {
      askToLeave().then((confirmed) => {
        if (confirmed) {
          handleRestart()
          window.history.back()
        } else {
          window.history.pushState({ simulacroGuard: true }, '')
        }
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Cualquier enlace de navegación interna (el header global es persistente
  // en todas las páginas) también debe avisar antes de sacar al usuario de
  // un simulacro en curso, no solo "Salir" y el botón atrás.
  useEffect(() => {
    if (phase !== 'running') return
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement | null)?.closest('a')
      const href = anchor?.getAttribute('href')
      if (!anchor || !href || href.startsWith('#')) return
      if (anchor.target && anchor.target !== '_self') return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname) return

      e.preventDefault()
      askToLeave().then((confirmed) => {
        if (confirmed) {
          handleRestart()
          router.push(url.pathname + url.search + url.hash)
        }
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, router])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      {/* Fondo decorativo coherente con Studio */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(125,138,150,0.08)_0,transparent_30%),radial-gradient(circle_at_80%_75%,rgba(232,165,152,0.08)_0,transparent_30%)]" />
      <div className="pointer-events-none fixed -bottom-[10%] -left-[5%] z-0 h-96 w-96 rounded-full bg-[#8BA888]/15 blur-3xl" />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10">
        {phase === 'builder' ? (
          <SimulacroBuilder
            onSubmit={handleSubmit}
            generating={generating}
            generationError={generationError}
          />
        ) : phase === 'running' ? (
          <SimulacroRunner
            questions={questions}
            mode={mode}
            answers={answers}
            results={results}
            finishing={finishing}
            onSelect={handleSelect}
            onBlank={handleBlank}
            onFinish={handleFinish}
            onExit={handleExitClick}
          />
        ) : (
          <SimulacroResultsGrid
            questions={questions}
            answers={answers}
            results={results}
            onRestart={handleRestart}
          />
        )}
      </main>

      {showExitModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c3e50]/45 p-4 backdrop-blur-sm"
          onClick={() => resolveExit(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border-2 border-[#2c3e50] bg-white p-6"
            style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl text-[#C4655A]">warning</span>
              <p className="text-base font-black text-[#2C3E50]">Salir del simulacro</p>
            </div>
            <p className="text-sm leading-relaxed text-[#7D8A96]">{EXIT_WARNING}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => resolveExit(false)}
                className="flex-1 rounded-2xl border-2 border-[#EAE4E2] bg-white px-4 py-3 text-sm font-bold text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
              >
                Quedarme
              </button>
              <button
                type="button"
                onClick={() => resolveExit(true)}
                className="flex-1 rounded-2xl border-2 border-[#2c3e50] bg-[#C4655A] px-4 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
