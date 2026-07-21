'use client'

// Mapa mental interactivo de flashcards.
// Drill-down: Hub -> Asignaturas -> Temas -> Tarjetas. Se navega hacia dentro
// hasta el nivel deseado y ahí se seleccionan las tarjetas. Las asignaturas y
// los temas se muestran como nodos radiales; las tarjetas, como rejilla.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseBrowser'
import SubjectModal from '@/components/studio/SubjectModal'
import FlashcardCreateModal from '@/components/studio/FlashcardCreateModal'
import DropdownMenu from '@/components/studio/DropdownMenu'
import { DEFAULT_COLOR_KEY, MAX_FLASHCARD_CHARS, SUBJECT_COLORS, resolveColor, resolveIcon } from '@/lib/flashcardTheme'
import CharCounter from '@/components/studio/CharCounter'
import {
  bulkDeleteFlashcards,
  copyFlashcards,
  createFlashcardDeck,
  deleteFlashcard,
  deleteFlashcardDeck,
  fetchFlashcardDecks,
  fetchFlashcards,
  moveFlashcards,
  updateFlashcard,
  type Flashcard,
  type FlashcardDeck,
} from '@/lib/studioFlashcards'

const NO_TOPIC = '__none__'

export default function FlashcardsMindMap() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'loading' | 'no-session' | 'ready'>('loading')
  const [error, setError] = useState<string | null>(null)

  const [subjects, setSubjects] = useState<FlashcardDeck[]>([])
  const [cardsBySubject, setCardsBySubject] = useState<Record<string, Flashcard[]>>({})
  const [loadingSubject, setLoadingSubject] = useState(false)

  // Ruta de navegación: [] raíz, [subjectId] asignatura, [subjectId, topicKey] tema
  const [path, setPath] = useState<string[]>([])

  const [subjectModal, setSubjectModal] = useState<null | { existing?: FlashcardDeck }>(null)
  const [createCtx, setCreateCtx] = useState<null | { deckId: string; topic?: string }>(null)
  const [detailCard, setDetailCard] = useState<Flashcard | null>(null)

  // Selección múltiple (tipo galería)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [destCtx, setDestCtx] = useState<null | { mode: 'move' | 'copy' }>(null)
  const [notice, setNotice] = useState<null | { title: string; message: string }>(null)

  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ w: 900, h: 560 })

  // --- Carga inicial --------------------------------------------------------
  const loadSubjects = useCallback(async (authToken: string) => {
    try {
      setSubjects(await fetchFlashcardDecks(authToken))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las asignaturas.')
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      const accessToken = session?.access_token ?? ''
      if (!accessToken) {
        setStatus('no-session')
        return
      }
      setToken(accessToken)
      await loadSubjects(accessToken)
      if (mounted) setStatus('ready')
    })()
    return () => {
      mounted = false
    }
  }, [loadSubjects])

  // Medir el lienzo
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [status])

  const loadCardsFor = useCallback(
    async (subjectId: string) => {
      if (cardsBySubject[subjectId]) return
      setLoadingSubject(true)
      try {
        const { cards } = await fetchFlashcards(token, subjectId)
        setCardsBySubject((prev) => ({ ...prev, [subjectId]: cards }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las tarjetas.')
      } finally {
        setLoadingSubject(false)
      }
    },
    [token, cardsBySubject],
  )

  // --- Estado derivado ------------------------------------------------------
  const currentSubject = path[0] ? subjects.find((s) => s.id === path[0]) ?? null : null
  const currentCards = useMemo(
    () => (path[0] ? cardsBySubject[path[0]] ?? [] : []),
    [path, cardsBySubject],
  )

  const topics = useMemo(() => {
    const map = new Map<string, number>()
    let noTopic = 0
    currentCards.forEach((c) => {
      const t = c.topic?.trim()
      if (t) map.set(t, (map.get(t) ?? 0) + 1)
      else noTopic += 1
    })
    const list = Array.from(map.entries()).map(([label, count]) => ({ key: label, label, count }))
    list.sort((a, b) => a.label.localeCompare(b.label))
    return { list, noTopic }
  }, [currentCards])

  const hasRealTopics = topics.list.length > 0
  const level = path.length

  // ¿Mostramos rejilla de tarjetas (hoja) o nodos radiales?
  const atLeaf = level === 2 || (level === 1 && !hasRealTopics)

  const leafCards = useMemo(() => {
    if (!atLeaf) return []
    if (level === 2) {
      const key = path[1]
      return currentCards.filter((c) =>
        key === NO_TOPIC ? !c.topic?.trim() : c.topic?.trim() === key,
      )
    }
    return currentCards
  }, [atLeaf, level, path, currentCards])

  // --- Navegación -----------------------------------------------------------
  const enterSubject = (s: FlashcardDeck) => {
    setPath([s.id])
    void loadCardsFor(s.id)
  }
  const enterTopic = (key: string) => setPath([path[0], key])
  const goUp = () => setPath((p) => p.slice(0, -1))
  const goRoot = () => setPath([])

  // --- Acciones sobre tarjetas ----------------------------------------------
  const applyCardCreated = (subjectId: string, card: Flashcard) => {
    setCardsBySubject((prev) => ({ ...prev, [subjectId]: [card, ...(prev[subjectId] ?? [])] }))
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, totalCards: s.totalCards + 1, dueCards: s.dueCards + 1 } : s)),
    )
  }

  const handleDeleteCard = async (card: Flashcard) => {
    if (!currentSubject) return
    if (!window.confirm('¿Eliminar esta tarjeta? (recuperable 24h)')) return
    const subjectId = currentSubject.id
    setCardsBySubject((prev) => ({
      ...prev,
      [subjectId]: (prev[subjectId] ?? []).filter((c) => c.itemId !== card.itemId),
    }))
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, totalCards: Math.max(0, s.totalCards - 1) } : s)),
    )
    setDetailCard(null)
    try {
      await deleteFlashcard(token, subjectId, card.itemId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la tarjeta.')
    }
  }

  const handleDeleteSubject = async (s: FlashcardDeck) => {
    if (!window.confirm(`¿Enviar la asignatura "${s.name}" a la papelera? (recuperable 24h)`)) return
    setSubjects((prev) => prev.filter((x) => x.id !== s.id))
    if (path[0] === s.id) goRoot()
    try {
      await deleteFlashcardDeck(token, s.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la asignatura.')
      await loadSubjects(token)
    }
  }

  // --- Selección múltiple ---------------------------------------------------
  // Limpiar la selección al cambiar de nivel/rama.
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setDestCtx(null)
  }, [path])

  const toggleSelect = (itemId: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })

  const selectAll = () => setSelectedIds(new Set(leafCards.map((c) => c.itemId)))
  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const removeFromCurrent = (ids: Set<number>) => {
    if (!currentSubject) return
    const sid = currentSubject.id
    setCardsBySubject((prev) => ({
      ...prev,
      [sid]: (prev[sid] ?? []).filter((c) => !ids.has(c.itemId)),
    }))
    setSubjects((prev) =>
      prev.map((s) => (s.id === sid ? { ...s, totalCards: Math.max(0, s.totalCards - ids.size) } : s)),
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`¿Eliminar ${selectedIds.size} tarjeta(s)? (recuperable 24h)`)) return
    const ids = new Set(selectedIds)
    removeFromCurrent(ids)
    clearSelection()
    try {
      await bulkDeleteFlashcards(token, Array.from(ids))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron eliminar las tarjetas.')
      if (currentSubject) {
        setCardsBySubject((prev) => {
          const copy = { ...prev }
          delete copy[currentSubject.id]
          return copy
        })
        void loadCardsFor(currentSubject.id)
      }
    }
  }

  const performDestination = async (target: FlashcardDeck, mode: 'move' | 'copy') => {
    if (selectedIds.size === 0 || !currentSubject) return
    const ids = new Set(selectedIds)
    setDestCtx(null)
    try {
      const { done, alreadyThere } =
        mode === 'move'
          ? await moveFlashcards(token, Array.from(ids), target.id)
          : await copyFlashcards(token, Array.from(ids), target.id)

      // Mover saca las tarjetas del grupo actual; copiar las deja donde están.
      if (mode === 'move' && done > 0) removeFromCurrent(ids)

      if (done > 0) {
        setSubjects((prev) =>
          prev.map((s) => (s.id === target.id ? { ...s, totalCards: s.totalCards + done } : s)),
        )
        setCardsBySubject((prev) => {
          const copy = { ...prev }
          delete copy[target.id]
          return copy
        })
      }
      clearSelection()

      // Aviso si alguna ya estaba en el destino
      if (alreadyThere > 0) {
        const verb = mode === 'move' ? 'estaban' : 'existían'
        setNotice({
          title:
            done === 0
              ? 'Nada que ' + (mode === 'move' ? 'mover' : 'copiar')
              : mode === 'move'
                ? 'Movidas parcialmente'
                : 'Copiadas parcialmente',
          message:
            (done > 0
              ? `${done} ${mode === 'move' ? 'movida' : 'copiada'}${done === 1 ? '' : 's'}. `
              : '') +
            `${alreadyThere} ${alreadyThere === 1 ? 'ya' : 'ya'} ${verb} en «${target.name}»${
              mode === 'copy' ? ' y no se duplicaron' : ''
            }.`,
        })
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudieron ${mode === 'move' ? 'mover' : 'copiar'} las tarjetas.`,
      )
    }
  }

  // --- Layout radial --------------------------------------------------------
  const center = { x: size.w / 2, y: size.h / 2 }
  const radialCount = level === 0 ? subjects.length : topics.list.length + (topics.noTopic > 0 ? 1 : 0)
  const radius = Math.max(140, Math.min(Math.min(size.w, size.h) / 2 - 96, 300))
  const positionFor = (i: number, n: number) => {
    if (n <= 0) return center
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }
  }

  // --- Render de nodos ------------------------------------------------------
  const centerColor = currentSubject ? resolveColor(currentSubject.color) : null

  const renderCenter = () => {
    const isRoot = level === 0
    const label = isRoot ? 'Mis flashcards' : level === 1 ? currentSubject?.name ?? '' : humanizeTopic(path[1])
    const icon = isRoot ? 'hub' : level === 1 ? resolveIcon(currentSubject?.icon) : 'sell'
    const bg = isRoot ? '#2c3e50' : centerColor?.bg ?? '#2c3e50'
    return (
      <button
        type="button"
        onClick={isRoot ? undefined : goUp}
        style={{ left: center.x, top: center.y, background: bg }}
        className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full text-white shadow-xl transition-transform ${
          isRoot ? 'h-32 w-32 cursor-default' : 'h-28 w-28 cursor-pointer hover:scale-105'
        }`}
      >
        <span className="material-symbols-outlined text-3xl">{icon}</span>
        <span className="max-w-[7rem] truncate px-2 text-center text-xs font-bold">{label}</span>
        {!isRoot ? <span className="text-[10px] opacity-70">volver ↑</span> : null}
      </button>
    )
  }

  const renderConnectors = (n: number) => (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
      {Array.from({ length: n }).map((_, i) => {
        const p = positionFor(i, n)
        return (
          <line
            key={i}
            x1={center.x}
            y1={center.y}
            x2={p.x}
            y2={p.y}
            stroke="#D8CFC9"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )

  return (
    <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
      <main className="mx-auto w-full max-w-6xl px-5 py-6">
        {/* Barra superior: breadcrumb + acciones */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <Link href="/studio" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#8BA888] text-white transition hover:opacity-90" aria-label="Volver a studio">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>
            </Link>
            <button type="button" onClick={goRoot} className={level === 0 ? 'text-slate-800' : 'hover:text-slate-800'}>
              Mis flashcards
            </button>
            {currentSubject ? (
              <>
                <span className="text-slate-300">/</span>
                <button type="button" onClick={goUp} className={level === 1 ? 'text-slate-800' : 'hover:text-slate-800'}>
                  {currentSubject.name}
                </button>
              </>
            ) : null}
            {level === 2 ? (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-slate-800">{humanizeTopic(path[1])}</span>
              </>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {level === 0 ? (
              <button
                type="button"
                onClick={() => setSubjectModal({})}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8A598] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#E8A598]/25 transition-opacity hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Nueva asignatura
              </button>
            ) : currentSubject ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push(`/flashcards/${currentSubject.id}?study=1`)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#EAE4E2] bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  Estudiar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateCtx({
                      deckId: currentSubject.id,
                      topic: level === 2 && path[1] !== NO_TOPIC ? path[1] : undefined,
                    })
                  }
                  className="fc-pulse inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
                  style={{
                    background: resolveColor(currentSubject.color).bg,
                    boxShadow: `0 8px 22px -8px ${resolveColor(currentSubject.color).bg}`,
                  }}
                >
                  <span className="material-symbols-outlined text-lg">bolt</span>
                  Crear tarjetas
                </button>
              </>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mb-4 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">{error}</p>
        ) : null}

        {status === 'loading' ? (
          <div className="flex h-[60vh] items-center justify-center text-slate-400">Cargando…</div>
        ) : status === 'no-session' ? (
          <p className="rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
            No hay sesión activa. Inicia sesión para ver tus flashcards.
          </p>
        ) : (
          <div
            ref={canvasRef}
            className="relative h-[68vh] min-h-[520px] w-full overflow-hidden rounded-3xl border border-[#EDE6E1]"
            style={{
              background: 'radial-gradient(circle at 50% 42%, #ffffff 0%, #F7F1EC 100%)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={path.join('/') + '::' + (atLeaf ? 'leaf' : 'map')}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0"
              >
                {atLeaf ? (
                  <LeafGrid
                    cards={leafCards}
                    loading={loadingSubject}
                    color={resolveColor(currentSubject?.color)}
                    onBack={goUp}
                    backLabel={level === 2 ? humanizeTopic(path[1]) : currentSubject?.name ?? ''}
                    onSelect={setDetailCard}
                    onCreate={() =>
                      currentSubject &&
                      setCreateCtx({
                        deckId: currentSubject.id,
                        topic: level === 2 && path[1] !== NO_TOPIC ? path[1] : undefined,
                      })
                    }
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onEnterSelect={() => setSelectMode(true)}
                    onToggleSelect={toggleSelect}
                    onSelectAll={selectAll}
                    onClearSelect={clearSelection}
                  />
                ) : (
                  <>
                    {renderConnectors(radialCount)}
                    {renderCenter()}
                    {/* Nodos hijos */}
                    {level === 0
                      ? subjects.map((s, i) => {
                          const p = positionFor(i, subjects.length)
                          const c = resolveColor(s.color)
                          return (
                            <motion.div
                              key={s.id}
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.03 * i, type: 'spring', stiffness: 260, damping: 20 }}
                              style={{ left: p.x, top: p.y }}
                              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                            >
                              <SubjectNode
                                subject={s}
                                color={c}
                                onOpen={() => enterSubject(s)}
                                onEdit={() => setSubjectModal({ existing: s })}
                                onDelete={() => void handleDeleteSubject(s)}
                              />
                            </motion.div>
                          )
                        })
                      : [
                          ...topics.list.map((t) => ({ key: t.key, label: t.label, count: t.count })),
                          ...(topics.noTopic > 0
                            ? [{ key: NO_TOPIC, label: 'Sin tema', count: topics.noTopic }]
                            : []),
                        ].map((t, i, arr) => {
                          const p = positionFor(i, arr.length)
                          const c = resolveColor(currentSubject?.color)
                          const maxCount = Math.max(1, ...arr.map((x) => x.count))
                          // Diámetro escalado por cantidad (64–124 px)
                          const size = 64 + Math.round((t.count / maxCount) * 60)
                          return (
                            <motion.div
                              key={t.key}
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.03 * i, type: 'spring', stiffness: 260, damping: 20 }}
                              style={{ left: p.x, top: p.y }}
                              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                            >
                              <TopicNode label={t.label} count={t.count} size={size} color={c} onOpen={() => enterTopic(t.key)} />
                            </motion.div>
                          )
                        })}
                    {level === 0 && subjects.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setSubjectModal({})}
                        className="absolute left-1/2 top-[64%] -translate-x-1/2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                      >
                        Crea tu primera asignatura
                      </button>
                    ) : null}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Modales */}
      <AnimatePresence>
        {subjectModal ? (
          <SubjectModal
            token={token}
            existing={subjectModal.existing}
            onClose={() => setSubjectModal(null)}
            onSaved={(deck) => {
              setSubjects((prev) => {
                const exists = prev.some((s) => s.id === deck.id)
                return exists
                  ? prev.map((s) => (s.id === deck.id ? { ...s, ...deck } : s))
                  : [...prev, { ...deck, totalCards: 0, dueCards: 0 }]
              })
              setSubjectModal(null)
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {createCtx ? (
          <FlashcardCreateModal
            token={token}
            deckId={createCtx.deckId}
            subjectName={subjects.find((s) => s.id === createCtx.deckId)?.name}
            colorKey={subjects.find((s) => s.id === createCtx.deckId)?.color}
            initialTopic={createCtx.topic ?? ''}
            initialCount={subjects.find((s) => s.id === createCtx.deckId)?.totalCards ?? 0}
            onCreated={(card) => applyCardCreated(createCtx.deckId, card)}
            onClose={() => setCreateCtx(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {detailCard ? (
          <CardDetail
            card={detailCard}
            token={token}
            color={resolveColor(currentSubject?.color)}
            onClose={() => setDetailCard(null)}
            onDelete={() => void handleDeleteCard(detailCard)}
            onSaved={(patch) => {
              if (!currentSubject) return
              setCardsBySubject((prev) => ({
                ...prev,
                [currentSubject.id]: (prev[currentSubject.id] ?? []).map((c) =>
                  c.itemId === detailCard.itemId ? { ...c, ...patch } : c,
                ),
              }))
              setDetailCard((d) => (d ? { ...d, ...patch } : d))
            }}
          />
        ) : null}
      </AnimatePresence>

      {/* Barra de acciones de la selección (tipo galería) */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 ? (
          <motion.div
            initial={{ y: 70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 70, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-5 z-[250] flex justify-center px-4"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-[#EAE4E2] bg-white/95 px-3 py-2 shadow-2xl shadow-black/10 backdrop-blur">
              <span className="px-2 text-sm font-bold text-slate-700">
                {selectedIds.size} seleccionada{selectedIds.size === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setDestCtx({ mode: 'copy' })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#7BA7C4] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">content_copy</span>
                Copiar
              </button>
              <button
                type="button"
                onClick={() => setDestCtx({ mode: 'move' })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#8BA888] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">drive_file_move</span>
                Mover
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#C4655A] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                Eliminar
              </button>
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Cancelar selección"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {destCtx ? (
          <MoveCardsModal
            mode={destCtx.mode}
            token={token}
            subjects={subjects.filter((s) => s.id !== currentSubject?.id)}
            count={selectedIds.size}
            onSubjectCreated={(deck) =>
              setSubjects((prev) => [...prev, { ...deck, totalCards: 0, dueCards: 0 }])
            }
            onPick={(deck) => void performDestination(deck, destCtx.mode)}
            onClose={() => setDestCtx(null)}
          />
        ) : null}
      </AnimatePresence>

      {/* Aviso (p. ej. tarjetas que ya estaban en el destino) */}
      <AnimatePresence>
        {notice ? (
          <motion.div
            className="fixed inset-0 z-[330] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setNotice(null)} />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <span className="material-symbols-outlined text-4xl text-[#E0B15A]">info</span>
              <h3 className="mt-2 text-lg font-bold text-slate-800">{notice.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{notice.message}</p>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="mt-5 rounded-xl bg-[#2c3e50] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Entendido
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <style jsx>{`
        .fc-pulse {
          animation: fcPulse 2.2s ease-in-out infinite;
        }
        @keyframes fcPulse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}

function humanizeTopic(key: string): string {
  return key === NO_TOPIC ? 'Sin tema' : key
}

// --- Sub-componentes --------------------------------------------------------

function SubjectNode({
  subject,
  color,
  onOpen,
  onEdit,
  onDelete,
}: {
  subject: FlashcardDeck
  color: ReturnType<typeof resolveColor>
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative flex w-32 flex-col items-center">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-3xl text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: color.bg, boxShadow: `0 12px 26px -12px ${color.bg}` }}
      >
        <span className="material-symbols-outlined text-3xl">{resolveIcon(subject.icon)}</span>
        <span className="rounded-full bg-white/25 px-2 text-[11px] font-bold">{subject.totalCards}</span>
      </button>
      <div className="mt-1.5 flex items-center gap-1">
        <span className="max-w-[7rem] truncate text-center text-xs font-bold text-slate-700">{subject.name}</span>
      </div>
      <div className="absolute -right-1 -top-1 opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu
          ariaLabel="Acciones de la asignatura"
          items={[
            { label: 'Editar', icon: 'edit', onSelect: onEdit },
            { label: 'Eliminar', icon: 'delete', danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </div>
  )
}

function TopicNode({
  label,
  count,
  size,
  color,
  onOpen,
}: {
  label: string
  count: number
  size: number
  color: ReturnType<typeof resolveColor>
  onOpen: () => void
}) {
  // Burbuja cuyo diámetro refleja la cantidad de tarjetas del tema.
  return (
    <div className="flex w-32 flex-col items-center">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${label}: ${count} tarjetas`}
        className="flex flex-col items-center justify-center rounded-full border-2 text-center shadow-md transition-transform hover:scale-105"
        style={{
          width: size,
          height: size,
          background: color.soft,
          borderColor: color.ring,
          color: color.text,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: Math.max(16, size * 0.24) }}>
          sell
        </span>
        <span className="font-black leading-none" style={{ fontSize: Math.max(15, size * 0.26) }}>
          {count}
        </span>
      </button>
      <span className="mt-1.5 line-clamp-2 max-w-[8rem] text-center text-xs font-bold text-slate-700">{label}</span>
    </div>
  )
}

function LeafGrid({
  cards,
  loading,
  color,
  onBack,
  backLabel,
  onSelect,
  onCreate,
  selectMode,
  selectedIds,
  onEnterSelect,
  onToggleSelect,
  onSelectAll,
  onClearSelect,
}: {
  cards: Flashcard[]
  loading: boolean
  color: ReturnType<typeof resolveColor>
  onBack: () => void
  backLabel: string
  onSelect: (c: Flashcard) => void
  onCreate: () => void
  selectMode: boolean
  selectedIds: Set<number>
  onEnterSelect: () => void
  onToggleSelect: (itemId: number) => void
  onSelectAll: () => void
  onClearSelect: () => void
}) {
  const allSelected = cards.length > 0 && cards.every((c) => selectedIds.has(c.itemId))
  return (
    <div className="absolute inset-0 flex flex-col p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {backLabel}
        </button>
        <span className="text-sm font-semibold text-slate-400">
          {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {cards.length > 0 && !selectMode ? (
            <button
              type="button"
              onClick={onEnterSelect}
              className="inline-flex items-center gap-1 rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-base">check_box</span>
              Seleccionar
            </button>
          ) : null}
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={allSelected ? onClearSelect : onSelectAll}
                className="rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {allSelected ? 'Ninguna' : 'Todo'}
              </button>
              <button
                type="button"
                onClick={onClearSelect}
                className="rounded-lg border border-[#EAE4E2] bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </>
          ) : null}
        </div>
      </div>
      {loading ? (
        <div className="flex flex-1 items-center justify-center text-slate-400">Cargando tarjetas…</div>
      ) : cards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl">style</span>
          <p>No hay tarjetas aquí todavía.</p>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
            style={{ background: color.bg }}
          >
            Crear tarjetas
          </button>
        </div>
      ) : (
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
          {cards.map((c) => {
            const checked = selectedIds.has(c.itemId)
            return (
              <button
                key={c.itemId}
                type="button"
                onClick={() => (selectMode ? onToggleSelect(c.itemId) : onSelect(c))}
                className={`relative flex h-28 flex-col rounded-2xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  checked ? 'border-transparent ring-2' : 'border-[#EAE4E2]'
                }`}
                style={{
                  background: checked ? color.soft : '#fff',
                  ...(checked ? ({ ['--tw-ring-color' as string]: color.ring } as React.CSSProperties) : {}),
                }}
              >
                {selectMode ? (
                  <span
                    className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 text-white"
                    style={{
                      background: checked ? color.bg : 'rgba(255,255,255,0.85)',
                      borderColor: checked ? color.bg : '#CBBFB8',
                    }}
                  >
                    {checked ? <span className="material-symbols-outlined text-[15px]">check</span> : null}
                  </span>
                ) : null}
                {c.topic ? (
                  <span
                    className="mb-1 w-fit max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: checked ? '#fff' : color.soft, color: color.text }}
                  >
                    {c.topic}
                  </span>
                ) : null}
                <span className="line-clamp-3 flex-1 pr-6 text-sm font-semibold text-slate-800">{c.front}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CardDetail({
  card,
  token,
  color,
  onClose,
  onDelete,
  onSaved,
}: {
  card: Flashcard
  token: string
  color: ReturnType<typeof resolveColor>
  onClose: () => void
  onDelete: () => void
  onSaved: (patch: { front: string; back: string; topic: string | null }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [topic, setTopic] = useState(card.topic ?? '')
  const [flipped, setFlipped] = useState(false)
  const [saving, setSaving] = useState(false)

  const frontOver = front.length > MAX_FLASHCARD_CHARS
  const backOver = back.length > MAX_FLASHCARD_CHARS

  const save = async () => {
    if (saving || !front.trim() || !back.trim() || frontOver || backOver) return
    setSaving(true)
    try {
      await updateFlashcard(token, card.flashcardId, { front, back, topic: topic.trim() || undefined })
      onSaved({ front: front.trim(), back: back.trim(), topic: topic.trim() || null })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ background: color.soft }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: color.text }}>
            {topic.trim() ? topic : 'Tarjeta'}
          </span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/60">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          {editing ? (
            <div className="flex flex-col gap-3">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema (opcional)" className="rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:bg-white" />
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Anverso</span>
                  <CharCounter length={front.length} />
                </div>
                <textarea
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  rows={3}
                  className={`w-full resize-y rounded-xl border bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:bg-white ${frontOver ? 'border-[#E8A598]' : 'border-[#EAE4E2]'}`}
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Reverso</span>
                  <CharCounter length={back.length} />
                </div>
                <textarea
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  rows={3}
                  className={`w-full resize-y rounded-xl border bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:bg-white ${backOver ? 'border-[#E8A598]' : 'border-[#EAE4E2]'}`}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-[#EAE4E2] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={() => void save()} disabled={saving || !front.trim() || !back.trim() || frontOver || backOver} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: color.bg }}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setFlipped((v) => !v)}
                className="min-h-[160px] w-full rounded-2xl border border-[#EFE7E3] bg-[#FBF8F6] p-5 text-left transition hover:bg-white"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {flipped ? 'Reverso' : 'Anverso'} · toca para girar
                </span>
                <p className="mt-2 whitespace-pre-wrap text-base font-semibold text-slate-800">
                  {flipped ? card.back : card.front}
                </p>
              </button>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 rounded-lg border border-[#F0D9D4] px-3 py-2 text-sm font-semibold text-[#C4655A] transition hover:bg-[#FFF1EE]">
                  <span className="material-symbols-outlined text-lg">delete</span> Eliminar
                </button>
                <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: color.bg }}>
                  <span className="material-symbols-outlined text-lg">edit</span> Editar
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function MoveCardsModal({
  mode,
  token,
  subjects,
  count,
  onSubjectCreated,
  onPick,
  onClose,
}: {
  mode: 'move' | 'copy'
  token: string
  subjects: FlashcardDeck[]
  count: number
  onSubjectCreated: (deck: FlashcardDeck) => void
  onPick: (deck: FlashcardDeck) => void
  onClose: () => void
}) {
  const verb = mode === 'move' ? 'Mover' : 'Copiar'
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [colorKey, setColorKey] = useState(DEFAULT_COLOR_KEY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAndMove = async () => {
    if (busy || name.trim().length < 3) return
    setBusy(true)
    setError(null)
    try {
      const deck = await createFlashcardDeck(token, { name, color: colorKey, icon: 'style' })
      onSubjectCreated(deck)
      onPick(deck)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo.')
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[320] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-black text-slate-800">
            {verb} {count} tarjeta{count === 1 ? '' : 's'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto px-5 pb-5">
          {creating ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#EAE4E2] p-4">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void createAndMove()
                  }
                }}
                placeholder="Nombre del nuevo grupo"
                className="rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2.5 text-sm outline-none focus:bg-white"
              />
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={c.label}
                    onClick={() => setColorKey(c.key)}
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{ background: c.bg, boxShadow: colorKey === c.key ? `0 0 0 2px #fff, 0 0 0 4px ${c.ring}` : undefined }}
                  />
                ))}
              </div>
              {error ? <p className="text-sm font-medium text-[#C4655A]">{error}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-[#EAE4E2] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={() => void createAndMove()}
                  disabled={busy || name.trim().length < 3}
                  className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  style={{ background: resolveColor(colorKey).bg }}
                >
                  {busy ? (mode === 'move' ? 'Moviendo…' : 'Copiando…') : `Crear y ${verb.toLowerCase()}`}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[#D8CDC7] px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-[#8BA888] hover:bg-[#F6F8F5]"
              >
                <span className="material-symbols-outlined text-[#8BA888]">add</span>
                Crear grupo nuevo
              </button>
              {subjects.length === 0 ? (
                <p className="px-1 py-3 text-center text-sm text-slate-400">No hay otras asignaturas. Crea un grupo nuevo.</p>
              ) : (
                subjects.map((s) => {
                  const c = resolveColor(s.color)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onPick(s)}
                      className="flex items-center gap-3 rounded-xl border border-[#EAE4E2] bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: c.bg }}>
                        <span className="material-symbols-outlined text-lg">{resolveIcon(s.icon)}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">{s.name}</span>
                      <span className="text-xs font-semibold text-slate-400">{s.totalCards}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
