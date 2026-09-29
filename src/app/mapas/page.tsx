'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createMap, deleteMap, listMaps, type MapSummary } from '@/lib/mapas/api'
import { useCozyCursorOff } from '@/hooks/useCozyCursorOff'
import { MapFileError, parseMapFile } from '@/lib/mapas/json'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MapasPage() {
  const router = useRouter()
  useCozyCursorOff()
  const [maps, setMaps] = useState<MapSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    listMaps()
      .then((m) => {
        if (!cancelled) setMaps(m)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      router.push(`/mapas/${await createMap()}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el mapa')
      setCreating(false)
    }
  }

  const onImport = async (file: File | undefined) => {
    if (!file || creating) return
    setCreating(true)
    try {
      const { title, doc } = parseMapFile(await file.text())
      router.push(`/mapas/${await createMap(title, doc)}`)
    } catch (e) {
      setError(
        e instanceof MapFileError ? e.message : e instanceof Error ? e.message : 'No se pudo importar el mapa',
      )
      setCreating(false)
    }
  }

  const onDelete = async (id: string) => {
    setConfirmId(null)
    try {
      await deleteMap(id)
      setMaps((m) => (m ? m.filter((x) => x.id !== id) : m))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar el mapa')
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] px-6 py-8 text-[#7D8A96] antialiased">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/studio"
              className="mb-1 flex items-center gap-2 text-sm font-semibold tracking-wider text-[#E8A598] uppercase"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Studio
            </Link>
            <h1 className="text-4xl font-black tracking-tight text-[#2C3E50]">Mapas mentales</h1>
            <p className="mt-1 max-w-xl text-lg font-light">
              Organiza un tema en un mapa: definición, clínica, diagnóstico, tratamiento y perlas MIR.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                void onImport(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={creating}
              className="flex items-center gap-2 rounded-2xl border border-[#7D8A96]/25 bg-white px-4 py-3 text-sm font-bold text-[#7D8A96] transition-colors hover:border-[#E8A598] hover:text-[#E8A598] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">upload_file</span>
              Importar JSON
            </button>
            <button
              type="button"
              onClick={() => void onCreate()}
              disabled={creating}
              className="flex items-center gap-2 rounded-2xl bg-[#E8A598] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#d18d80] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              {creating ? 'Creando…' : 'Nuevo mapa'}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-[#E8A598]/40 bg-[#FCEFEC] px-4 py-3 text-sm font-medium text-[#B87A6F]">
            {error}
          </div>
        )}

        {maps === null && !error && <p className="text-sm">Cargando tus mapas…</p>}

        {maps !== null && maps.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-[#7D8A96]/30 bg-white/60 px-6 py-16 text-center">
            <span className="material-symbols-outlined text-5xl text-[#E8A598]">account_tree</span>
            <p className="text-lg font-bold text-[#2C3E50]">Aún no tienes ningún mapa</p>
            <p className="max-w-md text-sm">
              Crea el primero: empieza por el tema central y ve colgando ideas con Tab.
            </p>
          </div>
        )}

        {maps !== null && maps.length > 0 && (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Tus mapas">
            {maps.map((m) => (
              <article
                key={m.id}
                className="group relative rounded-3xl border border-[#7D8A96]/15 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/mapas/${m.id}`} className="block">
                  <span className="material-symbols-outlined mb-3 text-3xl text-[#E8A598]">account_tree</span>
                  <h2 className="line-clamp-2 text-lg font-bold text-[#2C3E50]">{m.title || 'Mapa sin título'}</h2>
                  <p className="mt-1 text-xs font-medium">
                    {m.nodeCount} {m.nodeCount === 1 ? 'nodo' : 'nodos'} · {formatDate(m.updated_at)}
                  </p>
                </Link>
                <div className="absolute top-4 right-4">
                  {confirmId === m.id ? (
                    <div className="flex items-center gap-1 rounded-xl bg-[#FCEFEC] p-1 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => void onDelete(m.id)}
                        className="rounded-lg bg-[#B87A6F] px-2 py-1 text-white"
                      >
                        Borrar
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="px-2 py-1 text-[#7D8A96]">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(m.id)}
                      title="Borrar mapa"
                      aria-label={`Borrar ${m.title}`}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-[#7D8A96] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#FAF7F4] hover:text-[#B87A6F] focus:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}
