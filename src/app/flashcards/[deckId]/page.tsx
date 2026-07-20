'use client'

// Página de un grupo de flashcards: gestión de tarjetas (crear / editar /
// borrar) + modo estudio con repetición espaciada (SRS) y tarjetas 3D
// volteables. El estudio reutiliza el motor de sesiones de los mazos y NO
// cuenta para las estadísticas globales.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import DropdownMenu from '@/components/studio/DropdownMenu'
import FlashcardCreateModal from '@/components/studio/FlashcardCreateModal'
import { resolveColor } from '@/lib/flashcardTheme'
import {
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
  const [deckColor, setDeckColor] = useState<string | null>(null)
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('manage')

  // Alta de tarjeta (modal)
  const [showCreate, setShowCreate] = useState(false)

  // Edición
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
        setDeckColor(deck.color ?? null)
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

  // ---- Gestión de tarjetas -------------------------------------------------

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

  const handleRate = useCallback(
    async (knew: boolean) => {
      if (busy || !current || !sessionId || !revealed) return
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
    },
    [busy, current, sessionId, revealed, token, deckId, advance],
  )

  const exitStudy = async () => {
    if (sessionId) void endFlashcardSession(token, sessionId)
    setSessionId(null)
    setCurrent(null)
    setRevealed(false)
    setFinishState(null)
    setMode('manage')
    await load(token)
  }

  // Atajos de teclado en modo estudio: Espacio = girar, 1 = fallo, 2 = acierto.
  useEffect(() => {
    if (mode !== 'study' || finishState || !current) return
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setRevealed((v) => !v)
      } else if (revealed && e.key === '1') {
        e.preventDefault()
        void handleRate(false)
      } else if (revealed && e.key === '2') {
        e.preventDefault()
        void handleRate(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, finishState, current, revealed, handleRate])

  // ---- Render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF7F4] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
          Cargando grupo...
        </div>
      </div>
    )
  }

  if (mode === 'study') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAF7F4] to-[#F3ECE8] text-slate-800">
        <main className="mx-auto flex w-full max-w-3xl flex-col px-5 py-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => void exitStudy()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#EAE4E2] bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-lg">close</span>
              Salir
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <span className="material-symbols-outlined text-lg text-[#8BA888]">style</span>
              {deckName}
              <span className="ml-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#8BA888] shadow-sm">
                {studied} repasadas
              </span>
            </div>
          </div>

          {error ? (
            <p className="mb-6 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
              {error}
            </p>
          ) : null}

          {finishState ? (
            <div className="flex flex-col items-center gap-5 rounded-[28px] border border-[#EAE4E2] bg-white p-10 text-center shadow-xl shadow-black/5">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#8BA888]/12 text-[#8BA888]">
                <span className="material-symbols-outlined text-5xl">
                  {finishState === 'done' ? 'task_alt' : 'timer'}
                </span>
              </span>
              <h2 className="text-2xl font-black text-slate-800">
                {finishState === 'done'
                  ? '¡Sesión completada!'
                  : finishState === 'limit'
                    ? 'Límite de la sesión alcanzado'
                    : 'La sesión expiró'}
              </h2>
              <p className="text-slate-500">
                Has repasado <span className="font-bold text-slate-700">{studied}</span> tarjetas.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleStartStudy()}
                  className="rounded-xl bg-[#8BA888] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#8BA888]/25 transition-opacity hover:opacity-90"
                >
                  Repasar de nuevo
                </button>
                <button
                  type="button"
                  onClick={() => void exitStudy()}
                  className="rounded-xl border border-[#EAE4E2] bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Volver al grupo
                </button>
              </div>
            </div>
          ) : current ? (
            <div className="flex flex-col gap-6">
              <div className="flip-scene" key={current.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={revealed ? 'Ocultar respuesta' : 'Mostrar respuesta'}
                  onClick={() => setRevealed((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setRevealed((v) => !v)
                    }
                  }}
                  className={`flip-card ${revealed ? 'is-flipped' : ''}`}
                >
                  <div className="flip-face flip-front">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C99A8D]">
                      Anverso
                    </span>
                    <div className="flex flex-1 items-center justify-center">
                      <p className="whitespace-pre-wrap text-center text-2xl font-semibold leading-relaxed text-slate-800">
                        {current.flashcard.front}
                      </p>
                    </div>
                    <span className="text-center text-xs font-medium text-slate-400">
                      Toca la tarjeta o pulsa <kbd className="kbd">Espacio</kbd> para girar
                    </span>
                  </div>
                  <div className="flip-face flip-back">
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7FA07B]">
                      Reverso
                    </span>
                    <div className="flex flex-1 items-center justify-center">
                      <p className="whitespace-pre-wrap text-center text-xl leading-relaxed text-slate-700">
                        {current.flashcard.back}
                      </p>
                    </div>
                    <span className="text-center text-xs font-medium text-slate-400">
                      ¿La sabías?
                    </span>
                  </div>
                </div>
              </div>

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  disabled={busy}
                  className="rounded-2xl bg-[#7D8A96] px-6 py-4 text-base font-bold text-white shadow-md shadow-[#7D8A96]/25 transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Mostrar respuesta
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRate(false)}
                    disabled={busy}
                    className="group flex items-center justify-center gap-2 rounded-2xl border-2 border-[#E8A598] bg-white px-6 py-4 text-base font-bold text-[#C4655A] shadow-sm transition-all hover:bg-[#FFF8F6] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">close</span>
                    No la sabía
                    <kbd className="kbd ml-1">1</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRate(true)}
                    disabled={busy}
                    className="group flex items-center justify-center gap-2 rounded-2xl bg-[#8BA888] px-6 py-4 text-base font-bold text-white shadow-md shadow-[#8BA888]/25 transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">check</span>
                    La sabía
                    <kbd className="kbd kbd-on-dark ml-1">2</kbd>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500">Cargando tarjeta...</div>
          )}
        </main>

        <style jsx>{`
          .flip-scene {
            perspective: 1800px;
          }
          .flip-card {
            position: relative;
            width: 100%;
            min-height: 360px;
            transform-style: preserve-3d;
            transition: transform 0.55s cubic-bezier(0.2, 0.85, 0.25, 1);
            cursor: pointer;
            outline: none;
          }
          .flip-card:focus-visible {
            box-shadow: 0 0 0 3px rgba(232, 165, 152, 0.5);
            border-radius: 28px;
          }
          .flip-card.is-flipped {
            transform: rotateY(180deg);
          }
          .flip-face {
            position: absolute;
            inset: 0;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            border-radius: 28px;
            padding: 2rem;
            overflow: auto;
            box-shadow: 0 18px 40px -18px rgba(0, 0, 0, 0.25), 0 4px 12px -6px rgba(0, 0, 0, 0.1);
          }
          .flip-front {
            background: linear-gradient(150deg, #ffffff 0%, #fdf6f3 100%);
            border: 1px solid #efe4df;
          }
          .flip-back {
            transform: rotateY(180deg);
            background: linear-gradient(150deg, #ffffff 0%, #f1f6f0 100%);
            border: 1px solid #e0eadd;
          }
          .kbd {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 1.4rem;
            padding: 0.05rem 0.35rem;
            border-radius: 0.4rem;
            border: 1px solid #d9d0cb;
            background: #fbf8f6;
            font-size: 0.68rem;
            font-weight: 700;
            color: #8a7f79;
            line-height: 1.4;
          }
          .kbd-on-dark {
            border-color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.18);
            color: #ffffff;
          }
        `}</style>
      </div>
    )
  }

  // ---- Modo gestión --------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FAF7F4] text-slate-800">
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <section className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/flashcards"
              aria-label="Volver a flashcards"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#8BA888] text-white shadow-sm transition hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M19 12H5" />
                <path d="M11 18l-6-6 6-6" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8BA888]/12 text-[#8BA888]">
                <span className="material-symbols-outlined text-2xl">style</span>
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Flashcards</p>
                <h1 className="text-2xl font-black tracking-tight text-slate-800 sm:text-3xl">
                  {deckName}
                </h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="fc-create-btn inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90"
              style={{
                background: resolveColor(deckColor).bg,
                boxShadow: `0 10px 24px -10px ${resolveColor(deckColor).bg}`,
              }}
            >
              <span className="material-symbols-outlined text-lg">bolt</span>
              Crear tarjetas
            </button>
            <button
              type="button"
              onClick={() => void handleStartStudy()}
              disabled={cards.length === 0 || busy}
              className="inline-flex items-center gap-2 rounded-xl border border-[#EAE4E2] bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-opacity hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg">play_arrow</span>
              Estudiar
            </button>
          </div>
        </section>

        {error ? (
          <p className="mb-6 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
            {error}
          </p>
        ) : null}

        {/* Lista de tarjetas */}
        <section>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
            </span>
            <div className="h-px flex-1 bg-[#E6DEDA]" />
          </div>

          {cards.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#D8CDC7] bg-white/50 p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-[#CBBFB8]">style</span>
              <p className="font-semibold text-slate-600">Aún no hay tarjetas</p>
              <p className="text-sm text-slate-400">Pulsa «Crear tarjetas» para empezar.</p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                style={{ background: resolveColor(deckColor).bg }}
              >
                Crear tarjetas
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {cards.map((card) => (
                <li
                  key={card.itemId}
                  className="rounded-2xl border border-[#EAE4E2] bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  {editingId === card.flashcardId ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <textarea
                          value={editFront}
                          onChange={(e) => setEditFront(e.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888] focus:bg-white"
                        />
                        <textarea
                          value={editBack}
                          onChange={(e) => setEditBack(e.target.value)}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888] focus:bg-white"
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
                      <div className="min-w-0 flex-1">
                        {card.topic ? (
                          <span className="mb-2 inline-block rounded-full bg-[#8BA888]/12 px-2 py-0.5 text-[10px] font-bold text-[#5C7A59]">
                            {card.topic}
                          </span>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="min-w-0">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#C99A8D]">
                              Anverso
                            </span>
                            <p className="whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">
                              {card.front}
                            </p>
                          </div>
                          <div className="min-w-0 md:border-l md:border-[#EFE7E3] md:pl-3">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#7FA07B]">
                              Reverso
                            </span>
                            <p className="whitespace-pre-wrap break-words text-sm text-slate-600">
                              {card.back}
                            </p>
                          </div>
                        </div>
                      </div>
                      <DropdownMenu
                        ariaLabel="Acciones de la tarjeta"
                        items={[
                          { label: 'Editar', icon: 'edit', onSelect: () => startEdit(card) },
                          {
                            label: 'Eliminar',
                            icon: 'delete',
                            danger: true,
                            onSelect: () => void handleDelete(card),
                          },
                        ]}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {showCreate ? (
        <FlashcardCreateModal
          token={token}
          deckId={deckId}
          subjectName={deckName}
          colorKey={deckColor}
          initialCount={cards.length}
          onCreated={(card) => setCards((prev) => [card, ...prev])}
          onClose={() => setShowCreate(false)}
        />
      ) : null}

      <style jsx>{`
        .fc-create-btn {
          animation: fcCreatePulse 2.4s ease-in-out infinite;
        }
        @keyframes fcCreatePulse {
          0%, 100% { transform: translateY(0); filter: brightness(1); }
          50% { transform: translateY(-2px); filter: brightness(1.06); }
        }
      `}</style>
    </div>
  )
}
