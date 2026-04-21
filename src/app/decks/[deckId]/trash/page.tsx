'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import GooFissionLoader from '@/components/studio/GooFissionLoader'
import DeckTrashList from '@/components/studio/DeckTrashList'
import { fetchDeckTrash, restoreDeckItem, type DeckTrashItem } from '@/lib/studio/trash'

type ToastState = {
  type: 'success' | 'error'
  message: string
} | null

export default function DeckTrashPage() {
  const params = useParams<{ deckId: string }>()
  const deckId = String(params?.deckId ?? '')
  const [trashItems, setTrashItems] = useState<DeckTrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [restoringItemIds, setRestoringItemIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!toast) return
    const timeout = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    let mounted = true

    const loadTrash = async () => {
      setLoading(true)
      setError(null)
      setTrashItems([])
      setRestoringItemIds(new Set())

      try {
        if (!deckId) throw new Error('deckId no valido.')
        const items = await fetchDeckTrash(deckId)
        if (!mounted) return
        setTrashItems(items)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'No se pudo cargar la papelera.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadTrash()

    return () => {
      mounted = false
    }
  }, [deckId])

  const trashCount = useMemo(() => trashItems.length, [trashItems.length])

  const handleRestore = async (itemId: number) => {
    const key = String(itemId)
    setRestoringItemIds((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
    setError(null)

    try {
      await restoreDeckItem(deckId, itemId)
      setTrashItems((prev) => prev.filter((item) => Number(item.id) !== itemId))
      setToast({ type: 'success', message: 'Pregunta restaurada' })
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'No se pudo restaurar la pregunta.',
      })
    } finally {
      setRestoringItemIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const handleExpire = (itemId: string) => {
    setTrashItems((prev) => prev.filter((item) => String(item.id) !== itemId))
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Studio
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Papelera del mazo</h1>
          <p className="mt-2 text-sm text-slate-600">
            {trashCount} pregunta{trashCount === 1 ? '' : 's'} eliminada
            {trashCount === 1 ? '' : 's'}
          </p>

          <div className="mt-4">
            <Link
              href={`/decks/${deckId}`}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Volver al mazo
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <GooFissionLoader size={64} label="Cargando papelera" showGlow={false} />
              <span>Cargando papelera...</span>
            </div>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <p className="text-sm text-rose-700">{error}</p>
          </div>
        ) : null}

        {!loading && !error ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <DeckTrashList
              items={trashItems}
              restoringItemIds={restoringItemIds}
              onRestore={(itemId) => {
                void handleRestore(itemId)
              }}
              onExpire={handleExpire}
            />
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

