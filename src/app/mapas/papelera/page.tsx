'use client'

import { useEffect, useState } from 'react'
import { listTrashedMaps, purgeExpiredMaps, restoreMap, TRASH_HOURS, type TrashedMap } from '@/lib/mapas/api'
import { useCozyCursorOff } from '@/hooks/useCozyCursorOff'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import TrashTimer from '@/components/studio/TrashTimer'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'

// Papelera de mapas: lo borrado se puede recuperar durante 24 horas (mismo patrón que la papelera
// de mazos). Pasado el plazo se elimina del todo (api.purgeExpiredMaps).

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MapasPapeleraPage() {
  useCozyCursorOff()
  const { setBackAction } = useHeaderUI()
  const [maps, setMaps] = useState<TrashedMap[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error'; visible: boolean } | null>(null)

  useEffect(() => {
    setBackAction({ label: 'Mis mapas', href: '/mapas', current: 'Papelera' })
    return () => setBackAction(null)
  }, [setBackAction])

  useEffect(() => {
    let cancelled = false
    void purgeExpiredMaps().catch(() => {})
    listTrashedMaps()
      .then((m) => {
        if (!cancelled) setMaps(m)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo cargar la papelera de mapas.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const show = requestAnimationFrame(() => setToast((t) => (t ? { ...t, visible: true } : t)))
    const hide = setTimeout(() => setToast((t) => (t ? { ...t, visible: false } : t)), 2600)
    const clear = setTimeout(() => setToast(null), 2900)
    return () => {
      cancelAnimationFrame(show)
      clearTimeout(hide)
      clearTimeout(clear)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.message, toast?.tone])

  const onRestore = async (id: string) => {
    setError(null)
    setRestoring((s) => new Set(s).add(id))
    try {
      await restoreMap(id)
      setMaps((m) => (m ? m.filter((x) => x.id !== id) : m))
      setToast({ message: 'Mapa restaurado', tone: 'success', visible: false })
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'No se pudo restaurar el mapa', tone: 'error', visible: false })
    } finally {
      setRestoring((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] px-6 py-8 text-[#7D8A96] antialiased">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section>
          <h1 className="text-4xl font-black tracking-tight text-[#2C3E50]">Papelera</h1>
          <p className="mt-1 max-w-xl text-lg font-light">
            Los mapas borrados se guardan {TRASH_HOURS} horas. Pasado ese tiempo desaparecen para siempre.
          </p>
          {maps && (
            <p className="mt-2 text-sm font-semibold">
              {maps.length} mapa{maps.length === 1 ? '' : 's'} eliminado{maps.length === 1 ? '' : 's'}
            </p>
          )}
        </section>

        {error && (
          <div className="rounded-2xl border border-[#E8A598]/40 bg-[#FCEFEC] px-4 py-3 text-sm font-medium text-[#B87A6F]">
            {error}
          </div>
        )}

        {maps === null && !error && <p className="text-sm">Cargando la papelera…</p>}

        {maps !== null && maps.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[#7D8A96]/30 bg-white/60 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-[#E8A598]">delete_sweep</span>
            <p className="text-lg font-bold text-[#2C3E50]">La papelera está vacía</p>
            <p className="max-w-md text-sm">Lo que borres de tus mapas aparecerá aquí durante {TRASH_HOURS} horas.</p>
          </div>
        )}

        {maps !== null && maps.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Mapas eliminados">
            {maps.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 rounded-3xl border border-[#7D8A96]/15 bg-white p-5 shadow-sm">
                <div>
                  <span className="material-symbols-outlined mb-2 text-3xl text-[#E8A598]/70">account_tree</span>
                  <h2 className="line-clamp-2 text-lg font-bold text-[#2C3E50]">{m.title || 'Mapa sin título'}</h2>
                  <p className="mt-1 text-xs font-medium">
                    {m.nodeCount} {m.nodeCount === 1 ? 'nodo' : 'nodos'} · Eliminado: {formatDate(m.deleted_at)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <TrashTimer
                    purgeAt={m.purge_at}
                    onExpire={() => setMaps((list) => (list ? list.filter((x) => x.id !== m.id) : list))}
                  />
                  <button
                    type="button"
                    disabled={restoring.has(m.id)}
                    onClick={() => void onRestore(m.id)}
                    className="rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#d18d80] disabled:opacity-60"
                  >
                    {restoring.has(m.id) ? 'Restaurando…' : 'Restaurar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {toast ? <UndoDeleteToast message={toast.message} tone={toast.tone} isVisible={toast.visible} /> : null}
    </main>
  )
}
