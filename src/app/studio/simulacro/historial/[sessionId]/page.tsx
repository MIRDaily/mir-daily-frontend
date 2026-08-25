'use client'

// Repaso de un simulacro concreto del historial. Antes era un estado de
// cliente dentro de la página de listado (sin URL propia): la flecha de
// "volver" de la cabecera global no podía llevar a ningún sitio distinto de
// donde ya se estaba, y el botón atrás del navegador tampoco cerraba el
// repaso, se salía de golpe del historial. Al ser una ruta real (mismo
// patrón que `/decks/[deckId]/trash`), ambas cosas funcionan solas.

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SimulacroResultsGrid from '@/components/simulacro/SimulacroResultsGrid'
import { fetchSimulacroHistoryDetail } from '@/lib/simulacro/queries'
import type { SimulacroHistoryDetail } from '@/lib/simulacro/types'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

export default function SimulacroHistoryDetailPage() {
  const params = useParams<{ sessionId: string }>()
  const router = useRouter()
  const sessionId = String(params?.sessionId ?? '')
  const { setBackAction } = useHeaderUI()

  const [detail, setDetail] = useState<SimulacroHistoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // El "current" (nº de preguntas) solo se conoce una vez llega el repaso;
    // hasta entonces se enseña solo la flecha con "Historial".
    setBackAction({
      label: 'Historial de simulacros',
      href: '/studio/simulacro/historial',
      current: detail ? `${detail.questions.length} preguntas` : undefined,
    })
    return () => setBackAction(null)
  }, [detail, setBackAction])

  useEffect(() => {
    let active = true
    fetchSimulacroHistoryDetail(sessionId)
      .then((data) => {
        if (!active) return
        setDetail(data)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar el repaso de este simulacro.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sessionId])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(125,138,150,0.08)_0,transparent_30%),radial-gradient(circle_at_80%_75%,rgba(232,165,152,0.08)_0,transparent_30%)]" />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-10">
        {loading ? (
          <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 rounded-2xl border border-[#F0EBE8] bg-white p-10 text-sm font-medium text-[#7D8A96] shadow-sm">
            <span className="material-symbols-outlined animate-spin text-base text-[#E8A598]">
              progress_activity
            </span>
            Cargando repaso...
          </div>
        ) : error ? (
          <p className="mx-auto max-w-3xl rounded-2xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
            {error}
          </p>
        ) : detail ? (
          <SimulacroResultsGrid
            questions={detail.questions}
            answers={detail.answers}
            results={detail.results}
            onRestart={() => router.push('/studio/simulacro/historial')}
          />
        ) : null}
      </main>
    </div>
  )
}
