'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseBrowser'
import {
  type StudioDeck,
  addQuestionToDeck,
  createStudioDeck,
  fetchStudioDeckItems,
  fetchStudioDecks,
  removeQuestionFromDeck,
} from '@/lib/studioDecks'

type SaveToDeckButtonProps = {
  questionId: number
  className?: string
}

// Botón "guardar pregunta en un mazo" reutilizable (misma UX que el daily del
// dashboard). Autónomo: gestiona su propia sesión, lista de mazos y pertenencia
// de la pregunta actual. Pensado para montarse por pregunta en el simulacro.
export default function SaveToDeckButton({ questionId, className }: SaveToDeckButtonProps) {
  const qid = String(questionId)

  const [open, setOpen] = useState(false)
  const [decks, setDecks] = useState<StudioDeck[] | null>(null)
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [membership, setMembership] = useState<Record<string, boolean>>({})
  const [itemIds, setItemIds] = useState<Record<string, string>>({})
  const [membershipQuestion, setMembershipQuestion] = useState<string | null>(null)
  // Guardado por mazo (clave = deckId): permite guardar en varios a la vez,
  // cada uno con su spinner, sin bloquear el popup.
  const [pendingDecks, setPendingDecks] = useState<Record<string, boolean>>({})
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isSaved = membershipQuestion === qid && Object.values(membership).some(Boolean)

  const showFeedback = useCallback((type: 'success' | 'error', text: string) => {
    setFeedback({ type, text })
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current)
    feedbackTimeout.current = setTimeout(() => setFeedback(null), 2500)
  }, [])

  // Al cambiar de pregunta, la pertenencia y el popover se reinician (los mazos
  // sí se cachean entre preguntas).
  useEffect(() => {
    setMembership({})
    setItemIds({})
    setMembershipQuestion(null)
    setShowCreateForm(false)
    setPendingDecks({})
    setOpen(false)
  }, [qid])

  // Cerrar el popover al hacer click fuera.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

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

  const loadMembership = useCallback(
    async (token: string, deckList: StudioDeck[]) => {
      const results = await Promise.all(
        deckList.map(async (deck) => {
          const deckId = String(deck.id)
          const items = await fetchStudioDeckItems(token, deckId)
          const matched = items.find((item) => {
            const itemQuestionId = item.question_id ?? item.questionId
            return itemQuestionId != null && String(itemQuestionId) === qid
          })
          return [deckId, matched ? String(matched.id) : null] as const
        }),
      )
      setMembership(Object.fromEntries(results.map(([deckId, itemId]) => [deckId, Boolean(itemId)])))
      setItemIds(
        Object.fromEntries(results.filter(([, itemId]) => Boolean(itemId)) as Array<[string, string]>),
      )
      setMembershipQuestion(qid)
    },
    [qid],
  )

  const handleToggleSelector = useCallback(async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    const token = await getToken()
    if (!token) {
      setAuthed(false)
      return
    }
    setAuthed(true)
    try {
      setLoadingDecks(true)
      let deckList = decks
      if (!deckList) {
        deckList = (await fetchStudioDecks(token)).filter((deck) => deck.deleted_at == null)
        setDecks(deckList)
      }
      if (membershipQuestion !== qid) {
        await loadMembership(token, deckList)
      }
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al cargar los mazos')
    } finally {
      setLoadingDecks(false)
    }
  }, [open, decks, getToken, loadMembership, membershipQuestion, qid, showFeedback])

  const handleToggleInDeck = useCallback(
    async (deckId: string, deckName: string) => {
      const token = await getToken()
      if (!token) {
        showFeedback('error', 'Inicia sesión para guardar preguntas')
        return
      }
      try {
        setPendingDecks((prev) => ({ ...prev, [deckId]: true }))
        const alreadyInDeck = Boolean(membership[deckId])

        if (alreadyInDeck) {
          const itemId = itemIds[deckId]
          if (itemId) await removeQuestionFromDeck(token, deckId, itemId)
          setMembership((prev) => ({ ...prev, [deckId]: false }))
          setItemIds((prev) => {
            const next = { ...prev }
            delete next[deckId]
            return next
          })
          showFeedback('success', `Eliminada de ${deckName}`)
          return
        }

        await addQuestionToDeck(token, deckId, qid)
        const items = await fetchStudioDeckItems(token, deckId)
        const matched = items.find((item) => {
          const itemQuestionId = item.question_id ?? item.questionId
          return itemQuestionId != null && String(itemQuestionId) === qid
        })
        setMembership((prev) => ({ ...prev, [deckId]: true }))
        if (matched) setItemIds((prev) => ({ ...prev, [deckId]: String(matched.id) }))
        showFeedback('success', `Añadida a ${deckName}`)
      } catch (err) {
        console.error(err)
        showFeedback('error', 'Error al actualizar el mazo')
      } finally {
        setPendingDecks((prev) => {
          const next = { ...prev }
          delete next[deckId]
          return next
        })
      }
    },
    [getToken, itemIds, membership, qid, showFeedback],
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
      await createStudioDeck(token, trimmed)
      const deckList = (await fetchStudioDecks(token)).filter((deck) => deck.deleted_at == null)
      setDecks(deckList)
      setNewDeckName('')
      setShowCreateForm(false)
      showFeedback('success', 'Mazo creado')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al crear el mazo')
    } finally {
      setCreating(false)
    }
  }, [getToken, newDeckName, showFeedback])

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => void handleToggleSelector()}
        className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border bg-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
          isSaved
            ? 'border-[#8BA888]/40 text-[#6E8D6B]'
            : 'border-[#E9E4E1] text-[#7D8A96] hover:border-[#E8A598]/40 hover:text-[#C4655A]'
        }`}
        aria-label="Guardar pregunta en un mazo"
      >
        <span className="material-symbols-outlined text-[20px]">
          {isSaved ? 'bookmark_added' : 'bookmark'}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-[#E9E4E1] bg-white p-2 shadow-xl shadow-[#2D3748]/8">
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
                const alreadyInDeck = Boolean(membership[deckId])
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
        </div>
      ) : null}
    </div>
  )
}
