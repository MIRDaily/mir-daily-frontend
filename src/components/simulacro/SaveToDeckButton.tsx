'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabaseBrowser'
import {
  hasFreshPickerDecks,
  loadPickerDecks,
  markPickerDeckUsed,
  markPickerDecksStale,
  sortPickerDecks,
  usePickerDecks,
} from '@/lib/studio/deckPickerStore'
import { loadMembershipBatch } from '@/lib/studio/membershipBatch'
import {
  isQuestionMembershipKnown,
  markQuestionInDeck,
  setQuestionDecks,
  unmarkQuestionInDeck,
  useQuestionDecks,
} from '@/lib/studio/savedQuestionsStore'
import {
  type StudioDeck,
  type StudioDeckError,
  addQuestionToDeck,
  createStudioDeck,
  fetchQuestionMembership,
  removeQuestionFromDeck,
} from '@/lib/studioDecks'

type SaveToDeckButtonProps = {
  questionId: number | string
  className?: string
  /** Más pequeño (36 px), para colocarlo en una barra. */
  compact?: boolean
  /**
   * Todas las preguntas de la pantalla (las del simulacro, de la revisión...).
   * Con ellas, la primera apertura pregunta de una vez en qué mazos está cada
   * una (membershipBatch) y las demás aperturas no piden nada. Sin ellas, se
   * pregunta solo por esta.
   */
  batchQuestionIds?: readonly string[]
}

// Botón "guardar pregunta en un mazo" reutilizable (misma UX que el daily del
// dashboard). Autónomo: gestiona su propia sesión, lista de mazos y pertenencia
// de la pregunta actual. Pensado para montarse por pregunta en el simulacro.
export default function SaveToDeckButton({
  questionId,
  className,
  compact = false,
  batchQuestionIds,
}: SaveToDeckButtonProps) {
  const qid = String(questionId)

  const [open, setOpen] = useState(false)
  // La lista de mazos es la misma para todos los selectores de la pestaña y se
  // pide una vez (ver deckPickerStore), no en cada pregunta.
  const decks = usePickerDecks()
  const [loadingDecks, setLoadingDecks] = useState(false)
  // En qué mazos está la pregunta. Vive fuera del botón (ver
  // savedQuestionsStore) para que el marcador no se pierda al cambiar de
  // pregunta y volver, ni al pasar del simulacro a los resultados.
  const knownDecks = useQuestionDecks(qid)
  // Guardado por mazo (clave = deckId): permite guardar en varios a la vez,
  // cada uno con su spinner, sin bloquear el popup.
  const [pendingDecks, setPendingDecks] = useState<Record<string, boolean>>({})
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  // El popup va en un portal a <body>: dentro del detalle de resultados (que
  // tiene overflow-hidden) se recortaba. Se coloca con position: fixed.
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSaved = Object.keys(knownDecks).length > 0

  const showFeedback = useCallback((type: 'success' | 'error', text: string) => {
    setFeedback({ type, text })
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    feedbackTimeout.current = setTimeout(() => setFeedback(null), 2500)
  }, [])

  // Al cambiar de pregunta se cierra el popover (los mazos sí se cachean entre
  // preguntas, y lo sabido de cada pregunta está en el store).
  useEffect(() => {
    setShowCreateForm(false)
    setNewDeckName('')
    setPendingDecks({})
    setOpen(false)
  }, [qid])

  // Cerrar el popover al hacer click fuera (del botón y del propio popover,
  // que al ir en un portal ya no está dentro del contenedor).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Escape cierra el popover y nada más: en fase de captura para que no le
  // llegue también al modal de debajo (el detalle de resultados).
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  // Posición del popover: bajo el botón y alineado a su borde derecho, sin
  // salirse de la pantalla. Si abajo no cabe, se abre hacia arriba.
  const placePopover = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const width = popoverRef.current?.offsetWidth ?? 288
    const height = popoverRef.current?.offsetHeight ?? 0
    const margin = 8
    const left = Math.min(
      Math.max(margin, rect.right - width),
      window.innerWidth - width - margin,
    )
    const below = rect.bottom + margin
    const fitsBelow = below + height <= window.innerHeight - margin
    const top = fitsBelow || rect.top - margin - height < margin
      ? below
      : rect.top - margin - height
    setPopoverPos({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPos(null)
      return
    }
    placePopover()
    window.addEventListener('resize', placePopover)
    window.addEventListener('scroll', placePopover, true)
    return () => {
      window.removeEventListener('resize', placePopover)
      window.removeEventListener('scroll', placePopover, true)
    }
  }, [open, placePopover])

  // El alto cambia al cargar los mazos o abrir "Nuevo mazo": se recoloca.
  useEffect(() => {
    if (!open || !popoverRef.current) return
    const observer = new ResizeObserver(() => placePopover())
    observer.observe(popoverRef.current)
    return () => observer.disconnect()
  }, [open, placePopover])

  useEffect(
    () => () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    },
    [],
  )

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const handleToggleSelector = useCallback(async () => {
    if (open) {
      setOpen(false)
      return
    }
    // Lo guardado desde la última apertura sube arriba, en el mismo render en
    // que se abre (así no se ve el orden viejo ni un salto). Con el selector
    // abierto el orden ya no cambia: ver markPickerDeckUsed.
    sortPickerDecks()
    setOpen(true)
    const token = await getToken()
    if (!token) {
      setAuthed(false)
      return
    }
    setAuthed(true)

    // Solo se pide lo que falta: la lista, si no está o caducó (una vez para
    // toda la pestaña), y dónde está ESTA pregunta, si no se sabe ya. Volver a
    // abrir una pregunta ya consultada no cuesta ninguna petición.
    const needDecks = !hasFreshPickerDecks()
    const needMembership = !isQuestionMembershipKnown(qid)
    if (!needDecks && !needMembership) return

    // Con las preguntas de la pantalla, de golpe las de todo el simulacro. Si
    // el lote falla, o esta pregunta cambió con él en vuelo (y por eso no se
    // aplicó), se pregunta solo por ella.
    const loadMembership = async () => {
      if (batchQuestionIds && batchQuestionIds.length > 1) {
        try {
          await loadMembershipBatch(token, [qid, ...batchQuestionIds])
        } catch (err) {
          console.error(err)
        }
        if (isQuestionMembershipKnown(qid)) return
      }
      setQuestionDecks(qid, await fetchQuestionMembership(token, qid))
    }

    try {
      setLoadingDecks(true)
      await Promise.all([
        needDecks ? loadPickerDecks(token) : null,
        needMembership ? loadMembership() : null,
      ])
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al cargar los mazos')
    } finally {
      setLoadingDecks(false)
    }
  }, [open, getToken, qid, showFeedback, batchQuestionIds])

  const handleToggleInDeck = useCallback(
    async (deckId: string, deckName: string) => {
      const token = await getToken()
      if (!token) {
        showFeedback('error', 'Inicia sesión para guardar preguntas')
        return
      }
      try {
        setPendingDecks((prev) => ({ ...prev, [deckId]: true }))
        const alreadyInDeck = deckId in knownDecks

        if (alreadyInDeck) {
          let itemId: string | null = knownDecks[deckId] || null
          // Si el POST no devolvió el id de la fila, se busca antes de borrar:
          // sin él la pregunta se quedaba en el mazo aunque dijera "Eliminada".
          if (!itemId) {
            const items = await fetchQuestionMembership(token, qid)
            itemId = items[deckId] ?? null
          }
          if (itemId) await removeQuestionFromDeck(token, deckId, itemId)
          unmarkQuestionInDeck(qid, deckId)
          showFeedback('success', `Eliminada de ${deckName}`)
          return
        }

        // El POST ya devuelve el id de la fila, asi que no hace falta releerse
        // el mazo entero solo para poder deshacer.
        const savedItemId = await addQuestionToDeck(token, deckId, qid)
        markQuestionInDeck(qid, deckId, savedItemId ?? null)
        markPickerDeckUsed(deckId)
        showFeedback('success', `Añadida a ${deckName}`)
      } catch (err) {
        console.error(err)
        const deckError = err as StudioDeckError | null
        // Borrado en otra pestaña o dispositivo: la lista en memoria estaba
        // vieja. Se vuelve a pedir para que desaparezca.
        if (deckError?.status === 404) {
          markPickerDecksStale()
          void loadPickerDecks(token).catch(() => {})
          showFeedback('error', `${deckName} ya no existe`)
          return
        }
        // El mazo lleno no es un fallo tecnico: se dice lo que pasa, con el
        // limite real que manda el servidor.
        const motivo = deckError?.limitReached ? (err as Error).message : 'Error al actualizar el mazo'
        showFeedback('error', motivo)
      } finally {
        setPendingDecks((prev) => {
          const next = { ...prev }
          delete next[deckId]
          return next
        })
      }
    },
    [getToken, knownDecks, qid, showFeedback],
  )

  const handleCreateDeck = useCallback(async () => {
    const trimmed = newDeckName.trim()
    if (!trimmed) return
    const token = await getToken()
    if (!token) {
      showFeedback('error', 'Inicia sesión para crear mazos')
      return
    }
    try {
      setCreating(true)
      // El mazo nuevo entra arriba de la lista compartida sin volver a pedirla
      // (createStudioDeck avisa a deckPickerStore).
      const created = (await createStudioDeck(token, trimmed)) as { deck?: StudioDeck } | null
      setNewDeckName('')
      setShowCreateForm(false)
      // Se crea para guardar esta pregunta: sin añadirla, el aviso decía
      // "Mazo creado" y la pregunta no quedaba en ningún mazo.
      if (created?.deck) {
        const deckId = String(created.deck.id)
        const savedItemId = await addQuestionToDeck(token, deckId, qid)
        markQuestionInDeck(qid, deckId, savedItemId ?? null)
        markPickerDeckUsed(deckId)
        showFeedback('success', `Añadida a ${created.deck.name || trimmed}`)
      } else {
        showFeedback('success', 'Mazo creado')
      }
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al crear el mazo')
    } finally {
      setCreating(false)
    }
  }, [getToken, newDeckName, qid, showFeedback])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => void handleToggleSelector()}
        className={`relative flex items-center justify-center border bg-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
        } ${
          isSaved
            ? 'border-[#8BA888]/40 text-[#6E8D6B]'
            : 'border-[#E9E4E1] text-[#7D8A96] hover:border-[#E8A598]/40 hover:text-[#C4655A]'
        }`}
        aria-label="Guardar pregunta en un mazo"
      >
        <span className={`material-symbols-outlined ${compact ? 'text-[18px]' : 'text-[20px]'}`}>
          {isSaved ? 'bookmark_added' : 'bookmark'}
        </span>
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Guardar en mazo"
          className="fixed z-[110] w-72 max-w-[calc(100vw-16px)] rounded-2xl border border-[#E9E4E1] bg-white p-2 shadow-xl shadow-[#2D3748]/8"
          style={{
            top: popoverPos?.top ?? 0,
            left: popoverPos?.left ?? 0,
            // Hasta medirse no se enseña, para que no parpadee en (0, 0).
            visibility: popoverPos ? 'visible' : 'hidden',
          }}
        >
          <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
            Guardar en mazo
          </p>

          <div className="mb-2">
            {!showCreateForm ? (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#E9E4E1] bg-[#FAF7F4] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#7D8A96] transition-colors hover:border-[#E8A598]/40 hover:text-[#C4655A]"
              >
                <span className="material-symbols-outlined text-base">add</span>
                Nuevo mazo
              </button>
            ) : (
              <div className="rounded-xl border border-[#E9E4E1] bg-[#FAF7F4] p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7D8A96]">
                    Crear mazo
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false)
                      setNewDeckName('')
                    }}
                    className="rounded-md p-1 text-[#7D8A96] transition-colors hover:bg-white hover:text-[#C4655A]"
                    aria-label="Cerrar creación de mazo"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(event) => setNewDeckName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleCreateDeck()
                      }
                    }}
                    placeholder="Nombre del mazo..."
                    className="h-9 flex-1 rounded-lg border border-[#E9E4E1] bg-white px-3 text-sm text-[#374151] outline-none focus:border-[#E8A598]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateDeck()}
                    disabled={creating || !newDeckName.trim()}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-[#E9E4E1] bg-white px-3 text-xs font-bold uppercase tracking-wide text-[#7D8A96] transition-colors hover:border-[#E8A598]/40 hover:text-[#C4655A] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Crear mazo"
                  >
                    {creating ? (
                      '...'
                    ) : (
                      <span className="material-symbols-outlined text-base">keyboard_return</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {authed === false ? (
              <p className="px-2 py-2 text-sm text-[#7D8A96]">Inicia sesión para guardar preguntas.</p>
            ) : loadingDecks ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-[#7D8A96]">
                <span className="material-symbols-outlined animate-spin text-base text-[#E8A598]">
                  progress_activity
                </span>
                Cargando mazos...
              </div>
            ) : !decks || decks.length === 0 ? (
              <p className="px-2 py-2 text-sm text-[#7D8A96]">No tienes mazos activos.</p>
            ) : (
              decks.map((deck) => {
                const deckId = String(deck.id)
                const alreadyInDeck = deckId in knownDecks
                const isPending = Boolean(pendingDecks[deckId])
                return (
                  <button
                    key={deckId}
                    type="button"
                    onClick={() => void handleToggleInDeck(deckId, deck.name || `Mazo ${deck.id}`)}
                    disabled={isPending}
                    className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:opacity-60 ${
                      alreadyInDeck
                        ? 'bg-[#EEF7EE] text-[#6E8D6B] hover:bg-[#FFF0EE] hover:text-[#C4655A]'
                        : 'text-[#374151] hover:bg-[#FAF7F4]'
                    }`}
                  >
                    <span className="truncate pr-2 font-medium">{deck.name || `Mazo ${deck.id}`}</span>
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <span className="material-symbols-outlined animate-spin text-base text-[#E8A598]">
                          progress_activity
                        </span>
                      ) : (
                        <>
                          {alreadyInDeck ? (
                            <>
                              <span className="text-[11px] font-bold uppercase tracking-wide group-hover:hidden">
                                Guardada
                              </span>
                              <span className="hidden text-[11px] font-bold uppercase tracking-wide group-hover:inline">
                                Quitar
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] font-bold uppercase tracking-wide text-[#7D8A96]">
                              Guardar
                            </span>
                          )}
                          {alreadyInDeck ? (
                            <span className="relative inline-flex h-4 w-4 items-center justify-center">
                              <span className="material-symbols-outlined absolute text-base text-[#6E8D6B] transition-all duration-150 group-hover:scale-75 group-hover:opacity-0">
                                check_circle
                              </span>
                              <span className="material-symbols-outlined absolute scale-75 text-base text-[#C4655A] opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
                                remove_circle
                              </span>
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-base text-[#7D8A96]">add_circle</span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {feedback ? (
            <p
              className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                feedback.type === 'success' ? 'bg-[#EEF7EE] text-[#6E8D6B]' : 'bg-[#FFF0EE] text-[#C4655A]'
              }`}
            >
              {feedback.text}
            </p>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
