'use client'

// Historial de simulacros: solo aparecen aquí los simulacros COMPLETADOS con
// al menos 50 preguntas (criterio validado en el backend, ver
// POST /api/simulacro/finish). Sirve para repasar con calma la corrección de
// un simulacro pasado, aunque en su momento no diera tiempo a mirarla.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SimulacroCalendarHeatmap from '@/components/simulacro/SimulacroCalendarHeatmap'
import { fetchSimulacroHistory } from '@/lib/simulacro/queries'
import type { SimulacroHistorySession } from '@/lib/simulacro/types'
import { useHeaderUI } from '@/providers/HeaderUIProvider'

const PAGE_SIZE = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SimulacroHistorialPage() {
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const [sessions, setSessions] = useState<SimulacroHistorySession[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Flecha de "volver" en la cabecera global, mismo mecanismo que en Mazos
  // (p. ej. `/decks/[deckId]/trash`).
  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio' })
    return () => setBackAction(null)
  }, [setBackAction])

  useEffect(() => {
    let active = true
    // Pide una de más para saber si hay página siguiente sin un COUNT aparte.
    fetchSimulacroHistory(PAGE_SIZE + 1, page * PAGE_SIZE)
      .then((data) => {
        if (!active) return
        setHasMore(data.length > PAGE_SIZE)
        setSessions(data.slice(0, PAGE_SIZE))
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(
          err instanceof Error ? err.message : 'No se pudo cargar el historial.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [page])

  const openSession = (id: string) => {
    router.push(`/studio/simulacro/historial/${id}`)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,rgba(125,138,150,0.08)_0,transparent_30%),radial-gradient(circle_at_80%_75%,rgba(232,165,152,0.08)_0,transparent_30%)]" />

      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-4xl font-black tracking-tight text-[#2c3e50]">
            Tus simulacros
          </h1>
          <p className="mt-2 text-base font-light text-[#7D8A96]">
            Solo se guardan aquí los simulacros que completaste enteros con al
            menos 50 preguntas. Los que dejaste a medias no aparecen.
          </p>
        </header>

        <SimulacroCalendarHeatmap onOpenSession={openSession} />

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="h-28 w-full animate-pulse rounded-2xl bg-white/60"
              />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
            {error}
          </p>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#EAE4E2] bg-white p-10 text-center shadow-sm">
            <span className="material-symbols-outlined text-4xl text-[#E8A598]">quiz</span>
            <p className="mt-3 text-base font-semibold text-[#2c3e50]">
              Todavía no tienes simulacros en el historial
            </p>
            <p className="mt-1 text-sm text-[#7D8A96]">
              Completa un simulacro de 50 preguntas o más y aparecerá aquí para
              que puedas repasarlo con calma.
            </p>
            <Link
              href="/studio/simulacro"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E8A598] px-6 py-3 text-sm font-bold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80]"
            >
              <span className="material-symbols-outlined text-lg">play_arrow</span>
              Crear un simulacro
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => {
              const pct =
                session.total_questions > 0
                  ? Math.round((session.correct_count / session.total_questions) * 100)
                  : 0
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                  className="group flex flex-col gap-4 rounded-2xl border border-[#EAE4E2] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#E8A598]/40 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7D8A96]">
                      {formatDate(session.finished_at)}
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#2c3e50]">
                      {session.total_questions} preguntas · {pct}% de aciertos
                    </p>
                    {session.subjects.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {session.subjects.slice(0, 4).map((name) => (
                          <span
                            key={name}
                            className="rounded-full bg-[#F2EFED] px-2.5 py-1 text-[11px] font-semibold text-[#7D8A96]"
                          >
                            {name}
                          </span>
                        ))}
                        {session.subjects.length > 4 ? (
                          <span className="group/chip relative rounded-full bg-[#F2EFED] px-2.5 py-1 text-[11px] font-semibold text-[#7D8A96]">
                            +{session.subjects.length - 4}
                            <span className="pointer-events-none absolute -top-2 left-1/2 z-20 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded bg-[#374151] px-2 py-1 text-center text-[10px] font-medium normal-case text-white opacity-0 shadow-md transition-opacity duration-150 group-hover/chip:opacity-100">
                              {session.subjects.slice(4).join(', ')}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-3 text-center">
                    <div className="rounded-xl bg-[#8BA888]/10 px-3 py-2">
                      <p className="text-base font-black text-[#5f7d5c]">{session.correct_count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]">Aciertos</p>
                    </div>
                    <div className="rounded-xl bg-[#C4655A]/10 px-3 py-2">
                      <p className="text-base font-black text-[#C4655A]">{session.wrong_count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]">Fallos</p>
                    </div>
                    <div className="rounded-xl bg-[#EDE8E5] px-3 py-2">
                      <p className="text-base font-black text-[#7D8A96]">{session.blank_count}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#7D8A96]">Blanco</p>
                    </div>
                    <span className="material-symbols-outlined text-[#7D8A96] transition-transform group-hover:translate-x-1">
                      chevron_right
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && !error && (sessions.length > 0 || page > 0) ? (
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => {
                setLoading(true)
                setPage((p) => Math.max(0, p - 1))
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#E9E4E1] px-4 py-2 text-sm font-semibold text-[#7D8A96] transition-all hover:border-[#E8A598]/40 hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Anterior
            </button>
            <span className="text-xs font-bold uppercase tracking-wide text-[#7D8A96]">
              Página {page + 1}
            </span>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => {
                setLoading(true)
                setPage((p) => p + 1)
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#E9E4E1] px-4 py-2 text-sm font-semibold text-[#7D8A96] transition-all hover:border-[#E8A598]/40 hover:text-[#2D3748] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
