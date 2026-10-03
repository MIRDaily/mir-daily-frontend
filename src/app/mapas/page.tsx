'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createMap,
  deleteMap,
  duplicateMap,
  listMaps,
  purgeExpiredMaps,
  renameMap,
  restoreMap,
  setMapPinned,
  setMapSubject,
  type MapSummary,
} from '@/lib/mapas/api'
import { MapCard } from '@/components/mapas/list/MapCard'
import { searchable } from '@/lib/mapas/summary'
import UndoDeleteToast from '@/components/studio/UndoDeleteToast'
import { useCozyCursorOff } from '@/hooks/useCozyCursorOff'
import { useHeaderUI } from '@/providers/HeaderUIProvider'
import { MapFileError, parseMapFile } from '@/lib/mapas/json'
import Image from 'next/image'
import { useTutorialReady } from '@/providers/TutorialProvider'
import { TUTORIAL_MAPAS } from '@/lib/tutorials/scripts'
import { firstPendingLesson, readLessonsDone, TOTAL_LESSONS } from '@/components/mapas/tutorial/progress'

const noSubscribe = () => () => {}

type Sort = 'recent' | 'name' | 'size'
const SORT_LABEL: Record<Sort, string> = { recent: 'Más recientes', name: 'Nombre (A–Z)', size: 'Más grandes' }

export default function MapasPage() {
  const router = useRouter()
  useCozyCursorOff()

  // El retroceso va en la cabecera global, como en mazos.
  const { setBackAction } = useHeaderUI()
  useEffect(() => {
    setBackAction({ label: 'Estudio', href: '/studio' })
    return () => setBackAction(null)
  }, [setBackAction])
  const [maps, setMaps] = useState<MapSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pinSupported, setPinSupported] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  // Borrar manda el mapa a la papelera (24 h) y ofrece deshacer, igual que en mazos.
  const [undo, setUndo] = useState<{ map: MapSummary; index: number } | null>(null)
  const [undoBusy, setUndoBusy] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'neutral' | 'success' | 'error'; visible: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDelete = useRef<Map<string, Promise<void>>>(new Map())

  const showToast = (message: string, tone: 'neutral' | 'success' | 'error', ms: number) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, tone, visible: false })
    requestAnimationFrame(() => setToast((t) => (t ? { ...t, visible: true } : t)))
    toastTimer.current = setTimeout(() => {
      setToast((t) => (t ? { ...t, visible: false } : t))
      toastTimer.current = setTimeout(() => setToast(null), 260)
    }, ms)
  }
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    [],
  )
  const fileRef = useRef<HTMLInputElement>(null)
  // Progreso del tutorial interactivo (lo guarda el propio tutorial en este navegador).
  // (useSyncExternalStore: en el servidor no hay localStorage y la primera pintura dice 0.)
  const lessonsDone = useSyncExternalStore(noSubscribe, () => readLessonsDone().length, () => 0)
  const resumeAt = useSyncExternalStore(noSubscribe, () => firstPendingLesson(readLessonsDone()), () => 0)

  // La mascota invita al tutorial la primera vez (una vez por cuenta), con la lista ya pintada.
  useTutorialReady(TUTORIAL_MAPAS.id, maps !== null)

  useEffect(() => {
    let cancelled = false
    void purgeExpiredMaps().catch(() => {})
    listMaps()
      .then((r) => {
        if (cancelled) return
        setMaps(r.maps)
        setPinSupported(r.pinSupported)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const patchMap = (id: string, patch: Partial<MapSummary>) =>
    setMaps((m) => (m ? m.map((x) => (x.id === id ? { ...x, ...patch } : x)) : m))

  const reload = async () => {
    try {
      const r = await listMaps()
      setMaps(r.maps)
      setPinSupported(r.pinSupported)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo recargar la lista')
    }
  }

  const onRename = (map: MapSummary, raw: string) => {
    setRenamingId(null)
    const title = raw.trim().slice(0, 200)
    if (!title || title === map.title) return
    patchMap(map.id, { title })
    renameMap(map.id, title).catch((e: unknown) => {
      patchMap(map.id, { title: map.title })
      showToast(e instanceof Error ? e.message : 'No se pudo renombrar', 'error', 3000)
    })
  }

  const onDuplicate = async (map: MapSummary) => {
    try {
      await duplicateMap(map.id)
      await reload()
      showToast('Mapa duplicado', 'success', 2200)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo duplicar', 'error', 3000)
    }
  }

  const onSubject = (map: MapSummary, subject: string | null) => {
    patchMap(map.id, { subject })
    setMapSubject(map.id, subject).catch((e: unknown) => {
      patchMap(map.id, { subject: map.subject })
      showToast(e instanceof Error ? e.message : 'No se pudo cambiar la asignatura', 'error', 3000)
    })
  }

  const onPin = (map: MapSummary) => {
    patchMap(map.id, { pinned: !map.pinned })
    setMapPinned(map.id, !map.pinned).catch((e: unknown) => {
      patchMap(map.id, { pinned: map.pinned })
      showToast(e instanceof Error ? e.message : 'No se pudo fijar', 'error', 3000)
    })
  }

  // Búsqueda (título, texto de los nodos y asignatura), filtro por asignatura y orden.
  const subjectsPresent = useMemo(
    () => [...new Set((maps ?? []).map((m) => m.subject).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b, 'es')),
    [maps],
  )
  const visible = useMemo(() => {
    const q = searchable(query)
    const list = (maps ?? []).filter((m) => {
      if (subjectFilter && m.subject !== subjectFilter) return false
      if (!q) return true
      return searchable(m.title).includes(q) || m.text.includes(q) || searchable(m.subject ?? '').includes(q)
    })
    const by: Record<Sort, (a: MapSummary, b: MapSummary) => number> = {
      recent: (a, b) => b.updated_at.localeCompare(a.updated_at),
      name: (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
      size: (a, b) => b.nodeCount - a.nodeCount,
    }
    return [...list].sort(by[sort])
  }, [maps, query, subjectFilter, sort])
  const pinnedMaps = visible.filter((m) => m.pinned)
  const restMaps = visible.filter((m) => !m.pinned)

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

  const onDelete = async (map: MapSummary) => {
    if (undoBusy || !maps) return
    const index = maps.findIndex((x) => x.id === map.id)
    if (index < 0) return
    setError(null)
    setMaps((m) => (m ? m.filter((x) => x.id !== map.id) : m))
    setUndo({ map, index })
    showToast('Mapa enviado a la papelera (24 h)', 'neutral', 6000)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), 6000)
    const request = deleteMap(map.id)
    pendingDelete.current.set(map.id, request)
    try {
      await request
    } catch (e) {
      setMaps((m) => {
        if (!m || m.some((x) => x.id === map.id)) return m
        const next = [...m]
        next.splice(Math.min(index, next.length), 0, map)
        return next
      })
      setUndo(null)
      showToast(e instanceof Error ? e.message : 'No se pudo borrar el mapa', 'error', 3000)
    } finally {
      pendingDelete.current.delete(map.id)
    }
  }

  const onUndo = async () => {
    if (!undo || undoBusy) return
    const { map, index } = undo
    setUndoBusy(true)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    try {
      const pending = pendingDelete.current.get(map.id)
      if (pending) await pending.catch(() => {})
      await restoreMap(map.id)
      setMaps((m) => {
        if (!m || m.some((x) => x.id === map.id)) return m
        const next = [...m]
        next.splice(Math.min(index, next.length), 0, map)
        return next
      })
      setUndo(null)
      showToast('Mapa restaurado', 'success', 2500)
    } catch (e) {
      setUndo(null)
      showToast(e instanceof Error ? e.message : 'No se pudo restaurar el mapa', 'error', 3000)
    } finally {
      setUndoBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F4] px-6 py-8 text-[#7D8A96] antialiased">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
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
            <Link
              href="/mapas/papelera"
              title="Papelera"
              aria-label="Papelera de mapas"
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#7D8A96]/25 bg-white text-[#7D8A96] transition-colors hover:border-[#E8A598] hover:text-[#E8A598]"
            >
              <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
            </Link>
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

        {/* Tutorial interactivo: siempre aquí, para quien quiera aprender (o repasar) los atajos.
            La primera vez, la mascota lo señala (TUTORIAL_MAPAS). */}
        <Link
          href={resumeAt > 0 && lessonsDone < TOTAL_LESSONS ? `/mapas/tutorial?leccion=${resumeAt}` : '/mapas/tutorial'}
          data-tutorial="mapas-aprende"
          className="group flex items-center gap-5 rounded-3xl border border-[#E8A598]/30 bg-gradient-to-r from-[#FCEFEC] to-white p-4 pr-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="relative size-20 shrink-0 transition-transform group-hover:-rotate-3 group-hover:scale-105">
            <Image src="/img/mascota/saludo.png" alt="" fill sizes="80px" className="object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black tracking-widest text-[#E8A598] uppercase">Tutorial interactivo</p>
            <p className="text-lg font-bold text-[#2C3E50]">Aprende a usar los mapas en cinco minutos</p>
            <p className="text-sm">
              Crear con el teclado, plegar, mover y cambiar ramas, buscar… practicando en un mapa de prueba.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="flex items-center gap-1 rounded-2xl bg-[#E8A598] px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-[#d18d80]">
              {lessonsDone > 0 && lessonsDone < TOTAL_LESSONS ? 'Seguir' : lessonsDone >= TOTAL_LESSONS ? 'Repasar' : 'Empezar'}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </span>
            {lessonsDone > 0 && (
              <span className="text-xs font-medium">
                {Math.min(lessonsDone, TOTAL_LESSONS)} de {TOTAL_LESSONS} lecciones
              </span>
            )}
          </div>
        </Link>

        {error && (
          <div className="rounded-2xl border border-[#E8A598]/40 bg-[#FCEFEC] px-4 py-3 text-sm font-medium text-[#B87A6F]">
            {error}
          </div>
        )}

        {maps === null && !error && (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Cargando tus mapas">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-3xl border border-[#7D8A96]/10 bg-white">
                <div className="aspect-[16/10] bg-[#F1ECE6]" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 rounded bg-[#F1ECE6]" />
                  <div className="h-3 w-1/3 rounded bg-[#F1ECE6]" />
                </div>
              </div>
            ))}
          </section>
        )}

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
          <>
            {/* Buscar, filtrar por asignatura y ordenar */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="relative min-w-[220px] flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[20px] text-[#7D8A96]">search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por título o por lo que hay dentro…"
                  aria-label="Buscar mapas"
                  className="w-full rounded-2xl border border-[#7D8A96]/20 bg-white py-3 pr-4 pl-10 text-sm font-medium text-[#2C3E50] outline-none transition-colors placeholder:text-[#7D8A96]/70 focus:border-[#E8A598]"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <span className="sr-only">Ordenar</span>
                <span className="material-symbols-outlined text-[20px]">sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-2xl border border-[#7D8A96]/20 bg-white px-3 py-3 text-sm font-semibold text-[#2C3E50] outline-none focus:border-[#E8A598]"
                >
                  {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
                    <option key={k} value={k}>
                      {SORT_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {subjectsPresent.length > 0 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por asignatura">
                {[null, ...subjectsPresent].map((s) => (
                  <button
                    key={s ?? 'todas'}
                    type="button"
                    onClick={() => setSubjectFilter(s)}
                    aria-pressed={subjectFilter === s}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
                      subjectFilter === s
                        ? 'border-[#E8A598] bg-[#FCEFEC] text-[#B87A6F]'
                        : 'border-[#7D8A96]/20 bg-white text-[#7D8A96] hover:border-[#E8A598]'
                    }`}
                  >
                    {s ?? 'Todas'}
                  </button>
                ))}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-[#7D8A96]/30 bg-white/60 px-6 py-14 text-center">
                <span className="material-symbols-outlined text-4xl text-[#E8A598]">search_off</span>
                <p className="text-lg font-bold text-[#2C3E50]">Ningún mapa coincide</p>
                <p className="text-sm">Prueba con otra palabra o quita el filtro.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSubjectFilter(null)
                  }}
                  className="mt-1 rounded-xl bg-[#E8A598] px-4 py-2 text-sm font-bold text-white hover:bg-[#d18d80]"
                >
                  Quitar búsqueda y filtros
                </button>
              </div>
            ) : (
              <>
                {pinnedMaps.length > 0 && (
                  <section aria-label="Mapas fijados" className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-1.5 text-xs font-black tracking-widest text-[#7D8A96] uppercase">
                      <span className="material-symbols-outlined text-[16px] text-[#E8A598]">push_pin</span>Fijados
                    </h2>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedMaps.map((m) => (
              <MapCard
                key={m.id}
                map={m}
                pinSupported={pinSupported}
                renaming={renamingId === m.id}
                onStartRename={() => setRenamingId(m.id)}
                onRename={(t) => onRename(m, t)}
                onCancelRename={() => setRenamingId(null)}
                onDuplicate={() => void onDuplicate(m)}
                onSubject={(subject) => onSubject(m, subject)}
                onPin={() => onPin(m)}
                onDelete={() => void onDelete(m)}
              />
            ))}
                    </div>
                  </section>
                )}
                {restMaps.length > 0 && (
                  <section aria-label="Tus mapas" className="flex flex-col gap-3">
                    {pinnedMaps.length > 0 && (
                      <h2 className="text-xs font-black tracking-widest text-[#7D8A96] uppercase">Todos los mapas</h2>
                    )}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {restMaps.map((m) => (
              <MapCard
                key={m.id}
                map={m}
                pinSupported={pinSupported}
                renaming={renamingId === m.id}
                onStartRename={() => setRenamingId(m.id)}
                onRename={(t) => onRename(m, t)}
                onCancelRename={() => setRenamingId(null)}
                onDuplicate={() => void onDuplicate(m)}
                onSubject={(subject) => onSubject(m, subject)}
                onPin={() => onPin(m)}
                onDelete={() => void onDelete(m)}
              />
            ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
      {toast ? (
        <UndoDeleteToast
          message={toast.message}
          tone={toast.tone}
          isVisible={toast.visible}
          actionLabel={undo && toast.tone === 'neutral' ? 'Deshacer' : undefined}
          actionDisabled={undoBusy}
          onAction={undo && toast.tone === 'neutral' ? () => void onUndo() : undefined}
        />
      ) : null}
    </main>
  )
}
