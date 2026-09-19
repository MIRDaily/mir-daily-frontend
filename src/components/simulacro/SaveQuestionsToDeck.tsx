'use client'

// "Guardar falladas en un mazo": en el repaso de un simulacro (y del
// historial), manda de una vez las preguntas falladas —y, si se quiere, las
// dejadas en blanco— a un mazo existente o a uno nuevo. Las anuladas no entran:
// no son fallos. El backend salta las que ya estaban en el mazo y respeta su
// tope de preguntas.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabaseBrowser'
import {
  type StudioDeck,
  type StudioDeckError,
  addQuestionsToDeck,
  createStudioDeck,
  fetchStudioDecks,
  isAutoFailedDeck,
} from '@/lib/studioDecks'
import { markQuestionInDeck } from '@/lib/studio/savedQuestionsStore'

type Props = {
  failedIds: string[]
  blankIds: string[]
}

function defaultDeckName(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `Fallos simulacro ${dd}/${mm}/${d.getFullYear()}`
}

export default function SaveQuestionsToDeck({ failedIds, blankIds }: Props) {
  const [open, setOpen] = useState(false)
  const [includeBlank, setIncludeBlank] = useState(false)
  const [decks, setDecks] = useState<StudioDeck[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [busyDeck, setBusyDeck] = useState<string | null>(null)
  const [newName, setNewName] = useState(defaultDeckName)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const ids = includeBlank ? [...failedIds, ...blankIds] : failedIds
  const disabled = failedIds.length === 0 && blankIds.length === 0

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }, [])

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setFeedback(null)
    // Si no hay fallos pero sí blancos, se ofrece directamente con blancos.
    if (failedIds.length === 0 && blankIds.length > 0) setIncludeBlank(true)
    if (decks) return
    const token = await getToken()
    if (!token) {
      setFeedback({ ok: false, text: 'Inicia sesión para guardar preguntas.' })
      return
    }
    try {
      setLoading(true)
      const list = await fetchStudioDecks(token)
      setDecks(list.filter((d) => d.deleted_at == null && !isAutoFailedDeck(d)))
    } catch {
      setFeedback({ ok: false, text: 'No se pudieron cargar los mazos.' })
    } finally {
      setLoading(false)
    }
  }

  /** Guarda en el mazo y cuenta el resultado. Sin comprobar `busyDeck`: la
   *  usan tanto el clic en un mazo como "crear y guardar". */
  const doSave = async (token: string, deckId: string, deckName: string) => {
    setBusyDeck(deckId)
    try {
      const res = await addQuestionsToDeck(token, deckId, ids)
      for (const [qid, itemId] of Object.entries(res.items)) {
        markQuestionInDeck(qid, deckId, itemId)
      }
      setFeedback({
        ok: true,
        text:
          res.added === 0
            ? `Ya estaban todas en «${deckName}».`
            : `${res.added} ${res.added === 1 ? 'pregunta guardada' : 'preguntas guardadas'} en «${deckName}»${
                res.skipped > 0 ? ` (${res.skipped} ya estaban)` : ''
              }.`,
      })
    } catch (err) {
      const e = err as StudioDeckError | null
      setFeedback({
        ok: false,
        text: e?.limitReached ? (err as Error).message : 'No se pudieron guardar las preguntas.',
      })
    } finally {
      setBusyDeck(null)
    }
  }

  const saveTo = async (deckId: string, deckName: string) => {
    if (ids.length === 0 || busyDeck) return
    const token = await getToken()
    if (!token) return
    setFeedback(null)
    await doSave(token, deckId, deckName)
  }

  const createAndSave = async () => {
    const name = newName.trim()
    if (!name || ids.length === 0 || busyDeck) return
    const token = await getToken()
    if (!token) return
    setBusyDeck('__new__')
    setFeedback(null)
    let deck: StudioDeck | undefined
    try {
      const created = (await createStudioDeck(token, name)) as { deck?: StudioDeck } | null
      deck = created?.deck
      if (!deck) throw new Error('Sin mazo')
    } catch {
      setFeedback({ ok: false, text: 'No se pudo crear el mazo (¿ya existe uno con ese nombre?).' })
      setBusyDeck(null)
      return
    }
    const createdDeck = deck
    setDecks((prev) => [createdDeck, ...(prev ?? [])])
    await doSave(token, String(createdDeck.id), createdDeck.name || name)
    setNewName(defaultDeckName())
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={disabled}
        className="flex items-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-2 text-sm font-black text-[#2c3e50] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        style={{ boxShadow: '3px 3px 0 0 #2c3e50' }}
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-lg">library_add</span>
        Guardar falladas
        <span className="tabular-nums text-[#C4655A]">{failedIds.length}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-3rem)] sm:left-auto sm:right-0 rounded-2xl border-2 border-[#2c3e50] bg-white p-3"
            style={{ boxShadow: '5px 5px 0 0 #2c3e50' }}
          >
            <p className="px-1 pb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#7D8A96]">
              Guardar {ids.length} {ids.length === 1 ? 'pregunta' : 'preguntas'} en…
            </p>

            {blankIds.length > 0 ? (
              <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-xl bg-[#FAF7F4] px-3 py-2 text-xs font-bold text-[#2c3e50]">
                <input
                  type="checkbox"
                  checked={includeBlank}
                  onChange={(e) => setIncludeBlank(e.target.checked)}
                  className="h-4 w-4 accent-[#E8A598]"
                />
                Incluir las {blankIds.length} en blanco
              </label>
            ) : null}

            {/* Mazo nuevo con nombre por defecto (editable) */}
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-dashed border-[#E9E4E1] p-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void createAndSave()
                  }
                }}
                maxLength={60}
                aria-label="Nombre del mazo nuevo"
                className="min-w-0 flex-1 rounded-lg border border-[#E9E4E1] bg-white px-2 py-1.5 text-xs font-semibold text-[#2c3e50] outline-none focus:border-[#E8A598]"
              />
              <button
                type="button"
                onClick={() => void createAndSave()}
                disabled={!newName.trim() || ids.length === 0 || busyDeck != null}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-[#E8A598] px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white disabled:opacity-50"
              >
                {busyDeck === '__new__' ? (
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-sm">add</span>
                )}
                Nuevo
              </button>
            </div>

            <div className="max-h-56 space-y-1 overflow-y-auto">
              {loading ? (
                <p className="px-2 py-3 text-xs text-[#7D8A96]">Cargando mazos…</p>
              ) : decks && decks.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[#7D8A96]">Aún no tienes mazos: crea uno arriba.</p>
              ) : (
                (decks ?? []).map((deck) => {
                  const id = String(deck.id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void saveTo(id, deck.name || 'Mazo')}
                      disabled={ids.length === 0 || busyDeck != null}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-[#374151] transition-colors hover:bg-[#FAF7F4] disabled:opacity-60"
                    >
                      <span className="truncate pr-2 font-medium">{deck.name || `Mazo ${deck.id}`}</span>
                      {busyDeck === id ? (
                        <span className="material-symbols-outlined animate-spin text-base text-[#E8A598]">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-base text-[#7D8A96]">add_circle</span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {feedback ? (
              <p
                className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${
                  feedback.ok ? 'bg-[#EEF7EE] text-[#6E8D6B]' : 'bg-[#FFF0EE] text-[#C4655A]'
                }`}
              >
                {feedback.text}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
