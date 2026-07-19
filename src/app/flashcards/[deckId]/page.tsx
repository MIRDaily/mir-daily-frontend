'use client'

// Pagina de un grupo de flashcards: gestion de tarjetas (crear / editar /
// borrar) + modo estudio con repeticion espaciada (SRS). El estudio reutiliza
// el motor de sesiones de los mazos y NO cuenta para las estadisticas globales.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import {
  createFlashcard,
  deleteFlashcard,
  endFlashcardSession,
  fetchFlashcards,
  logFlashcard,
  nextFlashcard,
  startFlashcardSession,
  updateFlashcard,
  type Flashcard,
  type StudyFlashcard,
} from '@/lib/studioFlashcards'

type Mode = 'manage' | 'study'

export default function FlashcardDeckPage() {
  const params = useParams<{ deckId: string }>()
  const deckId = String(params?.deckId ?? '')

  const [token, setToken] = useState('')
  const [deckName, setDeckName] = useState('')
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('manage')

  // Alta de tarjeta
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [adding, setAdding] = useState(false)

  // Edicion
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Estudio
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [current, setCurrent] = useState<StudyFlashcard | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [studied, setStudied] = useState(0)
  const [finishState, setFinishState] = useState<null | 'done' | 'limit' | 'expired'>(null)

  const load = useCallback(
    async (authToken: string) => {
      setLoading(true)
      setError(null)
      try {
        const { deck, cards: list } = await fetchFlashcards(authToken, deckId)
        setDeckName(deck.name || 'Grupo de flashcards')
        setCards(list)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el grupo.')
      } finally {
        setLoading(false)
      }
    },
    [deckId],
  )

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''
      if (!mounted) return
      if (!accessToken) {
        setError('No hay sesión activa.')
        setLoading(false)
        return
      }
      setToken(accessToken)
      await load(accessToken)
    })()
    return () => {
      mounted = false
    }
  }, [load])

  // ---- Gestion de tarjetas -------------------------------------------------

  const handleAdd = async () => {
    if (adding) return
    if (!newFront.trim() || !newBack.trim()) return
    setAdding(true)
    setError(null)
    try {
      const card = await createFlashcard(token, deckId, { front: newFront, back: newBack })
      setCards((prev) => [card, ...prev])
      setNewFront('')
      setNewBack('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarjeta.')
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (card: Flashcard) => {
    setEditingId(card.flashcardId)
    setEditFront(card.front)
    setEditBack(card.back)
  }

  const handleSaveEdit = async (card: Flashcard) => {
    if (savingEdit) return
    if (!editFront.trim() || !editBack.trim()) return
    setSavingEdit(true)
    setError(null)
    try {
      await updateFlashcard(token, card.flashcardId, { front: editFront, back: editBack })
      setCards((prev) =>
        prev.map((c) =>
          c.flashcardId === card.flashcardId
            ? { ...c, front: editFront.trim(), back: editBack.trim() }
            : c,
        ),
      )
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tarjeta.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (card: Flashcard) => {
    if (deletingId) return
    if (!window.confirm('¿Eliminar esta tarjeta? (recuperable 24h)')) return
    setDeletingId(card.itemId)
    setError(null)
    setCards((prev) => prev.filter((c) => c.itemId !== card.itemId))
    try {
      await deleteFlashcard(token, deckId, card.itemId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la tarjeta.')
      await load(token)
    } finally {
      setDeletingId(null)
    }
  }

  // ---- Estudio SRS ---------------------------------------------------------

  const advance = useCallback(
    async (sid: string) => {
      setBusy(true)
      try {
        const res = await nextFlashcard(token, deckId, sid)
        if (res.kind === 'card') {
          setCurrent(res.card)
          setRevealed(false)
        } else {
          setCurrent(null)
          setFinishState(res.kind)
          void endFlashcardSession(token, sid)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la siguiente tarjeta.')
      } finally {
        setBusy(false)
      }
    },
    [token, deckId],
  )

  const handleStartStudy = async () => {
    if (busy || cards.length === 0) return
    setBusy(true)
    setError(null)
    setStudied(0)
    setFinishState(null)
    try {
      const limit = Math.max(20, cards.length)
      const sid = await startFlashcardSession(token, deckId, limit)
      setSessionId(sid)
      setMode('study')
      await advance(sid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el estudio.')
    } finally {
      setBusy(false)
    }
  }

  const handleRate = async (knew: boolean) => {
    if (busy || !current || !sessionId) return
    setBusy(true)
    try {
      await logFlashcard(token, deckId, {
        deckItemId: current.id,
        isCorrect: knew,
        sessionId,
      })
      setStudied((n) => n + 1)
      await advance(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la respuesta.')
      setBusy(false)
    }
  }

  const exitStudy = async () => {
    if (sessionId) void endFlashcardSession(token, sessionId)
    setSessionId(null)
    setCurrent(null)
    setRevealed(false)
    setFinishState(null)
    setMode('manage')
    await load(token)
  }

  // ---- Render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF7F4] text-slate-500">
        Cargando grupo...
      </div>
    )
  }

  if (mode === 'study') {
    return (
      <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
        <main className="mx-auto flex w-full max-w-3xl flex-col px-6 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => void exitStudy()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-lg">close</span>
              Salir
            </button>
            <div className="text-sm font-semibold text-slate-500">
              {deckName} · {studied} repasadas
            </div>
          </div>

          {error ? (
            <p className="mb-6 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
              {error}
            </p>
          ) : null}

          {finishState ? (
            <div className="flex flex-col items-center gap-5 rounded-3xl border border-[#EAE4E2] bg-white p-10 text-center shadow-sm">
              <span className="material-symbols-outlined text-5xl text-[#8BA888]">
                {finishState === 'done' ? 'task_alt' : 'timer'}
              </span>
              <h2 className="text-2xl font-black text-slate-800">
                {finishState === 'done'
                  ? '¡Sesión completada!'
                  : finishState === 'limit'
                    ? 'Límite de la sesión alcanzado'
                    : 'La sesión expiró'}
              </h2>
              <p className="text-slate-500">Has repasado {studied} tarjetas en esta sesión.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartStudy()}
                  className="rounded-xl bg-[#8BA888] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Repasar de nuevo
                </button>
                <button
                  type="button"
                  onClick={() => void exitStudy()}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Volver al grupo
                </button>
              </div>
            </div>
          ) : current ? (
            <div className="flex flex-col gap-6">
              <div className="min-h-[320px] rounded-3xl border border-[#EAE4E2] bg-white p-8 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Anverso
                </p>
                <p className="whitespace-pre-wrap text-xl font-semibold leading-relaxed text-slate-800">
                  {current.flashcard.front}
                </p>

                {revealed ? (
                  <div className="mt-6 border-t border-dashed border-[#E6DEDA] pt-6">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8BA888]">
                      Reverso
                    </p>
                    <p className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700">
                      {current.flashcard.back}
                    </p>
                  </div>
                ) : null}
              </div>

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  disabled={busy}
                  className="rounded-2xl bg-[#7D8A96] px-6 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Mostrar respuesta
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRate(false)}
                    disabled={busy}
                    className="rounded-2xl border-2 border-[#E8A598] bg-white px-6 py-4 text-base font-bold text-[#C4655A] transition-colors hover:bg-[#FFF8F6] disabled:opacity-50"
                  >
                    No la sabía
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRate(true)}
                    disabled={busy}
                    className="rounded-2xl bg-[#8BA888] px-6 py-4 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    La sabía
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500">Cargando tarjeta...</div>
          )}
        </main>
      </div>
    )
  }

  // ---- Modo gestion --------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/decks"
              aria-label="Volver a mazos"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#8BA888] text-white transition hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M19 12H5" />
                <path d="M11 18l-6-6 6-6" />
              </svg>
            </Link>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Flashcards</p>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">{deckName}</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleStartStudy()}
            disabled={cards.length === 0 || busy}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-bold text-white shadow-md shadow-[#E8A598]/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">play_arrow</span>
            Estudiar
          </button>
        </section>

        {error ? (
          <p className="mb-6 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
            {error}
          </p>
        ) : null}

        {/* Alta de tarjeta */}
        <section className="mb-8 rounded-2xl border border-[#EAE4E2] bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Nueva tarjeta
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              placeholder="Anverso (pregunta / concepto)"
              rows={3}
              className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888]"
            />
            <textarea
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              placeholder="Reverso (respuesta / explicación)"
              rows={3}
              className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888]"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={adding || !newFront.trim() || !newBack.trim()}
              className="rounded-xl bg-[#8BA888] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding ? 'Añadiendo...' : 'Añadir tarjeta'}
            </button>
          </div>
        </section>

        {/* Lista de tarjetas */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
            </span>
            <div className="h-px flex-1 bg-[#E6DEDA]" />
          </div>

          {cards.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#CBB9] bg-white/50 p-10 text-center text-slate-500">
              Aún no hay tarjetas. Crea la primera arriba.
            </p>
          ) : (
            <ul className="space-y-3">
              {cards.map((card) => (
                <li
                  key={card.itemId}
                  className="rounded-2xl border border-[#EAE4E2] bg-white p-4 shadow-sm"
                >
                  {editingId === card.flashcardId ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <textarea
                          value={editFront}
                          onChange={(e) => setEditFront(e.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888]"
                        />
                        <textarea
                          value={editBack}
                          onChange={(e) => setEditBack(e.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(card)}
                          disabled={savingEdit || !editFront.trim() || !editBack.trim()}
                          className="rounded-lg bg-[#8BA888] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {savingEdit ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
                        <p className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">
                          {card.front}
                        </p>
                        <p className="whitespace-pre-wrap break-words border-l border-[#E6DEDA] pl-3 text-sm text-slate-600">
                          {card.back}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Editar tarjeta"
                          onClick={() => startEdit(card)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar tarjeta"
                          disabled={deletingId === card.itemId}
                          onClick={() => void handleDelete(card)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
