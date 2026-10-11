'use client'

// Papelera de los párrafos de un grupo de resúmenes activos: los párrafos borrados de ESE grupo,
// recuperables durante 24 horas (mismo patrón que la papelera de preguntas de un mazo).

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { GhostButton, Hero, StickerButton, StickerCard } from '@/components/ui/sticker'
import { ParrafoHuecos, ResumenHuecos } from '@/components/resumenes/ParrafoHuecos'
import TrashTimer from '@/components/studio/TrashTimer'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'
import { listarParrafosPapelera, restaurarParrafo, type ParrafoPapelera } from '@/lib/resumenes/api'

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ResumenPapeleraPage() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id ?? '')
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const [items, setItems] = useState<ParrafoPapelera[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error'; visible: boolean } | null>(null)

  useEffect(() => {
    setBackAction({ label: 'Grupo', href: `/resumenes/${id}`, current: 'Papelera' })
    return () => setBackAction(null)
  }, [id, setBackAction])

  useEffect(() => {
    if (!id) return
    let vivo = true
    setItems(null)
    setError(null)
    listarParrafosPapelera(id)
      .then((xs) => {
        if (vivo) setItems(xs)
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar la papelera.')
      })
    return () => {
      vivo = false
    }
  }, [id])

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

  const onRestaurar = async (itemId: number) => {
    setError(null)
    setRestaurando((s) => new Set(s).add(itemId))
    try {
      await restaurarParrafo(id, itemId)
      setItems((xs) => (xs ? xs.filter((x) => x.parrafo.itemId !== itemId) : xs))
      setToast({ message: 'Párrafo restaurado', tone: 'success', visible: false })
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'No se pudo restaurar el párrafo', tone: 'error', visible: false })
    } finally {
      setRestaurando((s) => {
        const next = new Set(s)
        next.delete(itemId)
        return next
      })
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)' }}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8">
        <Hero
          badge="Papelera del grupo"
          badgeIcon="delete"
          title="Papelera"
          subtitle="Los párrafos borrados de este grupo se guardan 24 horas. Pasado ese tiempo desaparecen para siempre."
        >
          {items ? (
            <p className="mt-2 text-sm font-semibold text-[#2C3E50]">
              {items.length} {items.length === 1 ? 'párrafo' : 'párrafos'} en la papelera
            </p>
          ) : null}
        </Hero>

        {error ? <p className="rounded-2xl bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E]">{error}</p> : null}

        {items === null && !error ? <p className="py-10 text-center text-sm">Cargando la papelera…</p> : null}

        {items !== null && items.length === 0 ? (
          <StickerCard className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-[#E8A598]">delete_sweep</span>
            <p className="text-lg font-black text-[#2C3E50]">La papelera está vacía</p>
            <p className="max-w-md text-sm">Lo que borres de este grupo aparecerá aquí durante 24 horas.</p>
            <GhostButton icon="arrow_back" onClick={() => router.push(`/resumenes/${id}`)}>
              Volver al grupo
            </GhostButton>
          </StickerCard>
        ) : null}

        {items !== null && items.length > 0 ? (
          <ul className="flex flex-col gap-4" aria-label="Párrafos eliminados">
            {items.map(({ parrafo, deletedAt, purgeAt }) => (
              <li key={parrafo.itemId}>
                <StickerCard as="article" className="flex flex-col gap-3 p-5">
                  {parrafo.tema ? (
                    <p className="truncate text-[0.66rem] font-extrabold uppercase tracking-wide text-[#7D8A96]">{parrafo.tema}</p>
                  ) : null}
                  <ParrafoHuecos texto={parrafo.texto} huecos={parrafo.huecos} />
                  <div className="flex flex-wrap items-center gap-2 text-[0.7rem]">
                    <ResumenHuecos huecos={parrafo.huecos} />
                    {parrafo.origen?.page ? (
                      <span>
                        {parrafo.origen.unit === 'diapositiva' ? 'Diap.' : 'Pág.'} {parrafo.origen.page}
                        {parrafo.modo === 'literal' ? ' · texto original' : ''}
                      </span>
                    ) : null}
                    <span className="ml-auto font-medium">Eliminado: {formatDate(deletedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <TrashTimer
                      purgeAt={purgeAt}
                      onExpire={() => setItems((xs) => (xs ? xs.filter((x) => x.parrafo.itemId !== parrafo.itemId) : xs))}
                    />
                    <StickerButton disabled={restaurando.has(parrafo.itemId)} onClick={() => void onRestaurar(parrafo.itemId)}>
                      {restaurando.has(parrafo.itemId) ? 'Restaurando…' : 'Restaurar'}
                    </StickerButton>
                  </div>
                </StickerCard>
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      {toast ? <UndoDeleteToast message={toast.message} tone={toast.tone} isVisible={toast.visible} /> : null}
    </div>
  )
}
