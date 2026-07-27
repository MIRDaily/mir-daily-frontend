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

// Mensaje único reutilizado en todos los puntos de salida (botón "Salir",
// atrás del navegador, cerrar/recargar pestaña, cualquier enlace de
// navegación) mientras hay un simulacro en curso.
const EXIT_WARNING =
  'Si sales ahora no podrás continuar este simulacro ni se guardará en tu historial. ¿Seguro que quieres salir?'

export default function SimulacroPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<SimulacroPhase>('builder')
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

  // El botón "Salir" del runner ya no descarta el progreso sin avisar.
  const handleExitClick = () => {
    if (window.confirm(EXIT_WARNING)) {
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
      if (window.confirm(EXIT_WARNING)) {
        handleRestart()
        window.history.back()
      } else {
        window.history.pushState({ simulacroGuard: true }, '')
      }
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
      if (window.confirm(EXIT_WARNING)) {
        handleRestart()
        router.push(url.pathname + url.search + url.hash)
      }
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
    </div>
  )
}
