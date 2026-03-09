'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import TrashTimer from '@/components/studio/TrashTimer'
import { fetchDeletedDecks, restoreDeck, type TrashedDeck } from '@/lib/studio/trash'

function formatDate(value?: string | null): string {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type ToastState = {
  type: 'success' | 'error'
  message: string
} | null

export default function StudioDeckTrashPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [trashDecks, setTrashDecks] = useState<TrashedDeck[]>([])
  const [restoringDeckIds, setRestoringDeckIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    let mounted = true

    const loadTrashDecks = async () => {
      setLoading(true)
      setError(null)
      try {
        const decks = await fetchDeletedDecks()
        if (!mounted) return
        setTrashDecks(decks)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar la papelera de mazos.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadTrashDecks()

    return () => {
      mounted = false
    }
  }, [])

  const trashCount = useMemo(() => trashDecks.length, [trashDecks.length])

  const handleRestoreDeck = async (deckId: string) => {
    setError(null)
    setRestoringDeckIds((prev) => {
      const next = new Set(prev)
      next.add(deckId)
      return next
    })

    try {
      await restoreDeck(deckId)
      setTrashDecks((prev) => prev.filter((deck) => String(deck.id) !== deckId))
      setToast({ type: 'success', message: 'Mazo restaurado' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo restaurar el mazo.'
      setToast({ type: 'error', message })
    } finally {
      setRestoringDeckIds((prev) => {
        const next = new Set(prev)
        next.delete(deckId)
        return next
      })
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Studio</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Papelera</h1>
          <p className="mt-2 text-sm text-slate-600">
            {trashCount} mazo{trashCount === 1 ? '' : 's'} eliminado{trashCount === 1 ? '' : 's'}
          </p>

          <div className="mt-4">
            <Link
              href="/studio/mazos"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Volver a mazos
            </Link>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-600">Cargando papelera...</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-sm text-rose-700">{error}</p>
          </section>
        ) : null}

        {!loading && !error ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {trashDecks.length === 0 ? (
              <p className="text-sm text-slate-600">No hay mazos en la papelera.</p>
            ) : (
              <ul className="space-y-3">
                {trashDecks.map((deck) => {
                  const deckId = String(deck.id)
                  const isRestoring = restoringDeckIds.has(deckId)

                  return (
                    <li key={deckId} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {deck.name?.trim() || `Mazo ${deckId}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            Eliminado: {formatDate(deck.deleted_at)}
                          </p>
                          <TrashTimer
                            purgeAt={deck.purge_at}
                            onExpire={() => {
                              setTrashDecks((prev) => prev.filter((entry) => String(entry.id) !== deckId))
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={() => {
                            void handleRestoreDeck(deckId)
                          }}
                          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRestoring ? 'Restaurando...' : 'Restaurar'}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}
      </div>

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  )
}
