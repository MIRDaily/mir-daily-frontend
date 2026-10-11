'use client'

// Papelera de resúmenes activos: los grupos borrados, recuperables durante 24 horas (mismo patrón que
// la papelera de mazos y mapas). La papelera de los párrafos de cada grupo vive dentro del grupo.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { GhostButton, Hero, StickerButton, StickerCard } from '@/components/ui/sticker'
import { BaldosaGrupo } from '@/components/resumenes/ColorIconoGrupo'
import TrashTimer from '@/components/studio/TrashTimer'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'
import { listarGruposPapelera, restaurarGrupo, type GrupoPapelera } from '@/lib/resumenes/api'

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ResumenesPapeleraPage() {
  const router = useRouter()
  const { setBackAction } = useHeaderUI()
  const [grupos, setGrupos] = useState<GrupoPapelera[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error'; visible: boolean } | null>(null)

  useEffect(() => {
    setBackAction({ label: 'Resúmenes activos', href: '/resumenes', current: 'Papelera' })
    return () => setBackAction(null)
  }, [setBackAction])

  useEffect(() => {
    let vivo = true
    listarGruposPapelera()
      .then((g) => {
        if (vivo) setGrupos(g)
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo cargar la papelera.')
      })
    return () => {
      vivo = false
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

  const onRestaurar = async (id: string) => {
    setError(null)
    setRestaurando((s) => new Set(s).add(id))
    try {
      await restaurarGrupo(id)
      setGrupos((gs) => (gs ? gs.filter((g) => g.id !== id) : gs))
      setToast({ message: 'Grupo restaurado', tone: 'success', visible: false })
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'No se pudo restaurar el grupo', tone: 'error', visible: false })
    } finally {
      setRestaurando((s) => {
        const next = new Set(s)
        next.delete(id)
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

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8">
        <Hero
          badge="Papelera"
          badgeIcon="delete"
          title="Papelera"
          subtitle="Los grupos borrados se guardan 24 horas. Pasado ese tiempo desaparecen para siempre."
        >
          {grupos ? (
            <p className="mt-2 text-sm font-semibold text-[#2C3E50]">
              {grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'} en la papelera
            </p>
          ) : null}
        </Hero>

        {error ? <p className="rounded-2xl bg-[#FAEAED] px-4 py-3 text-sm font-bold text-[#B04A5E]">{error}</p> : null}

        {grupos === null && !error ? <p className="py-10 text-center text-sm">Cargando la papelera…</p> : null}

        {grupos !== null && grupos.length === 0 ? (
          <StickerCard className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-[#E8A598]">delete_sweep</span>
            <p className="text-lg font-black text-[#2C3E50]">La papelera está vacía</p>
            <p className="max-w-md text-sm">Lo que borres de tus resúmenes aparecerá aquí durante 24 horas.</p>
            <GhostButton icon="arrow_back" onClick={() => router.push('/resumenes')}>
              Volver a los grupos
            </GhostButton>
          </StickerCard>
        ) : null}

        {grupos !== null && grupos.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Grupos eliminados">
            {grupos.map((g) => (
              <li key={g.id} className="flex">
                <StickerCard as="article" className="flex h-full w-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <BaldosaGrupo color={g.color} icon={g.icon} />
                    <h2 className="min-w-0 flex-1 truncate text-lg font-black text-[#2C3E50]">{g.name}</h2>
                  </div>
                  <p className="text-xs font-medium">Eliminado: {formatDate(g.deletedAt)}</p>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <TrashTimer
                      purgeAt={g.purgeAt}
                      onExpire={() => setGrupos((gs) => (gs ? gs.filter((x) => x.id !== g.id) : gs))}
                    />
                    <StickerButton disabled={restaurando.has(g.id)} onClick={() => void onRestaurar(g.id)}>
                      {restaurando.has(g.id) ? 'Restaurando…' : 'Restaurar'}
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
