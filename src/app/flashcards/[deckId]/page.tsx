'use client'

// Página de un grupo de flashcards: gestión de tarjetas (crear / editar /
// borrar) + modo estudio con repetición espaciada (SRS) y tarjetas 3D
// volteables. El estudio reutiliza el motor de sesiones de los mazos y NO
// cuenta para las estadísticas globales.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseBrowser'
import DropdownMenu from '@/components/studio/DropdownMenu'
import FlashcardCreateModal from '@/components/studio/FlashcardCreateModal'
import CharCounter from '@/components/studio/CharCounter'
import { MAX_FLASHCARD_CHARS, resolveColor, resolveIcon } from '@/lib/flashcardTheme'
import {
  CardStackArt,
  GhostButton,
  Hero,
  SectionLabel,
  StatChip,
  StickerButton,
  tintedPaper,
} from '@/components/flashcards/ui'
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
  const [deckIcon, setDeckIcon] = useState<string | null>(null)
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
  // true mientras se prepara el estudio automático (llegada con ?study=1)
  const [autoStudy, setAutoStudy] = useState(false)

  const load = useCallback(
    async (authToken: string) => {
      setLoading(true)
      setError(null)
      try {
        const { deck, cards: list } = await fetchFlashcards(authToken, deckId)
        setDeckName(deck.name || 'Grupo de flashcards')
        setDeckColor(deck.color ?? null)
        setDeckIcon(deck.icon ?? null)
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

  const editFrontOver = editFront.length > MAX_FLASHCARD_CHARS
  const editBackOver = editBack.length > MAX_FLASHCARD_CHARS

  const handleSaveEdit = async (card: Flashcard) => {
    if (savingEdit) return
    if (!editFront.trim() || !editBack.trim() || editFrontOver || editBackOver) return
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
      // Deja de "preparar": si fue bien ya estamos en modo estudio; si falló,
      // se muestra el workspace con el error.
      setAutoStudy(false)
    }
  }

  // Auto-iniciar el estudio si se llega con ?study=1 (botón "Estudiar" del mapa).
  // Leemos el query desde window para evitar el requisito de Suspense de
  // useSearchParams en el build. Mientras se prepara NO se pinta el workspace,
  // para que no parpadee la lista antes del test.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('study') === '1') setAutoStudy(true)
  }, [])

  const autoStudyRef = useRef(false)
  useEffect(() => {
    if (!autoStudy || autoStudyRef.current) return
    if (loading || mode !== 'manage') return
    if (cards.length === 0) {
      setAutoStudy(false) // no hay nada que estudiar: mostrar el workspace
      return
    }
    autoStudyRef.current = true
    void handleStartStudy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStudy, loading, mode, cards.length])

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

  // Indicador de scroll: muestra un degradado al pie de la tarjeta 3D cuando
  // el texto no cabe entero, para avisar de que hay más contenido debajo.
  const frontScrollRef = useRef<HTMLDivElement | null>(null)
  const backScrollRef = useRef<HTMLDivElement | null>(null)
  const [frontHasMore, setFrontHasMore] = useState(false)
  const [backHasMore, setBackHasMore] = useState(false)

  const checkOverflow = useCallback(
    (el: HTMLDivElement | null, setFlag: (v: boolean) => void) => {
      if (!el) return
      setFlag(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
    },
    [],
  )

  useEffect(() => {
    if (mode !== 'study') return
    const check = () => {
      checkOverflow(frontScrollRef.current, setFrontHasMore)
      checkOverflow(backScrollRef.current, setBackHasMore)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [mode, current, checkOverflow])

  // ---- Render --------------------------------------------------------------

  // Llegada desde "Estudiar": mostramos la preparación en vez del workspace,
  // así no parpadea la lista de tarjetas antes de arrancar el test.
  if (autoStudy && mode === 'manage') {
    const c = resolveColor(deckColor)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#FAF7F4] px-6 text-center">
        <CardStackArt accent={c.bg} />
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7D8A96]/60">Flashcards</p>
          <h1 className="text-2xl font-black text-[#2C3E50]">{deckName || 'Preparando…'}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-[#7D8A96]">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: c.bg, borderTopColor: 'transparent' }}
          />
          Preparando tu sesión de estudio…
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FAF7F4] text-[#7D8A96]">
        <div className="flex items-center gap-3 font-bold">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#E8A598] border-t-transparent" />
          Cargando grupo…
        </div>
      </div>
    )
  }

  if (mode === 'study') {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 opacity-60"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)',
          }}
        />
        <div className="pointer-events-none fixed top-[-12%] right-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/12 blur-3xl" />

        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-5 py-8">
          {/* Barra de sesión: salir, grupo y cuántas llevas */}
          <div
            className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#2c3e50] bg-white px-4 py-3"
            style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
          >
            <button
              type="button"
              onClick={() => void exitStudy()}
              className="flex items-center justify-center rounded-lg p-1.5 text-[#7D8A96] transition-colors hover:bg-[#F2EFED] hover:text-[#2C3E50]"
              aria-label="Salir del repaso"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: resolveColor(deckColor).bg }}
            >
              <span className="material-symbols-outlined text-lg">{resolveIcon(deckIcon)}</span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black leading-tight text-[#2C3E50]">{deckName}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7D8A96]/60">Repaso</p>
            </div>
            <span
              className="rounded-full px-3 py-1.5 text-xs font-black text-white"
              style={{ backgroundColor: resolveColor(deckColor).bg }}
            >
              {studied} repasadas
            </span>
          </div>

          {error ? (
            <p className="mb-6 rounded-2xl border-2 border-[#E8A598]/40 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
              {error}
            </p>
          ) : null}

          {finishState ? (
            <div
              className="flex flex-col items-center gap-5 rounded-3xl border-2 border-[#2c3e50] bg-white p-10 text-center"
              style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
            >
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#2c3e50] text-white"
                style={{ backgroundColor: '#8BA888', boxShadow: '4px 4px 0 0 #2c3e50' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 40 }}>
                  {finishState === 'done' ? 'task_alt' : 'timer'}
                </span>
              </span>
              <h2 className="text-2xl font-black text-[#2C3E50]">
                {finishState === 'done'
                  ? '¡Sesión completada!'
                  : finishState === 'limit'
                    ? 'Límite de la sesión alcanzado'
                    : 'La sesión expiró'}
              </h2>
              <p>
                Has repasado <span className="font-black text-[#2C3E50]">{studied}</span> tarjetas.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <StickerButton icon="replay" color="#8BA888" onClick={() => void handleStartStudy()}>
                  Repasar de nuevo
                </StickerButton>
                <GhostButton onClick={() => void exitStudy()}>Volver al grupo</GhostButton>
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
                    <div
                      ref={frontScrollRef}
                      onScroll={() => checkOverflow(frontScrollRef.current, setFrontHasMore)}
                      className="flip-scroll"
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C99A8D]">
                        Anverso
                      </span>
                      <div className="flex flex-1 items-center justify-center">
                        <p className="whitespace-pre-wrap text-center text-2xl font-bold leading-relaxed text-[#2C3E50]">
                          {current.flashcard.front}
                        </p>
                      </div>
                      <span className="text-center text-xs font-semibold text-[#7D8A96]/70">
                        Toca la tarjeta o pulsa <kbd className="kbd">Espacio</kbd> para girar
                      </span>
                    </div>
                    {frontHasMore ? (
                      <div className="flip-fade flip-fade-front" aria-hidden>
                        <span className="material-symbols-outlined">expand_more</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flip-face flip-back">
                    <div
                      ref={backScrollRef}
                      onScroll={() => checkOverflow(backScrollRef.current, setBackHasMore)}
                      className="flip-scroll"
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7FA07B]">
                        Reverso
                      </span>
                      <div className="flex flex-1 items-center justify-center">
                        <p className="whitespace-pre-wrap text-center text-xl leading-relaxed text-[#2C3E50]">
                          {current.flashcard.back}
                        </p>
                      </div>
                      <span className="text-center text-xs font-semibold text-[#7D8A96]/70">¿La sabías?</span>
                    </div>
                    {backHasMore ? (
                      <div className="flip-fade flip-fade-back" aria-hidden>
                        <span className="material-symbols-outlined">expand_more</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {!revealed ? (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  disabled={busy}
                  className="rounded-2xl border-2 border-[#2c3e50] bg-[#7D8A96] px-6 py-4 text-base font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                  style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
                >
                  Mostrar respuesta
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleRate(false)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-white px-6 py-4 text-base font-black text-[#C4655A] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{ boxShadow: '4px 4px 0 0 #C4655A' }}
                  >
                    <span className="material-symbols-outlined">close</span>
                    No la sabía
                    <kbd className="kbd ml-1">1</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRate(true)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[#2c3e50] bg-[#8BA888] px-6 py-4 text-base font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{ boxShadow: '4px 4px 0 0 #2c3e50' }}
                  >
                    <span className="material-symbols-outlined">check</span>
                    La sabía
                    <kbd className="kbd kbd-on-dark ml-1">2</kbd>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center text-[#7D8A96]">Cargando tarjeta...</div>
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
            border-radius: 24px;
            overflow: hidden;
            /* Ficha de cartulina: borde de tinta y sombra dura, como el resto
               de la web, con los renglones pintados por gradiente. */
            border: 2px solid #2c3e50;
            box-shadow: 6px 6px 0 0 #2c3e50;
          }
          .flip-scroll {
            height: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            padding: 2rem;
          }
          .flip-front {
            background-color: #ffffff;
            background-image:
              repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125, 138, 150, 0.13) 31px 32px),
              linear-gradient(150deg, rgba(232, 165, 152, 0.14) 0%, transparent 55%);
            background-position: 0 10px, 0 0;
          }
          .flip-back {
            transform: rotateY(180deg);
            background-color: #ffffff;
            background-image:
              repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125, 138, 150, 0.13) 31px 32px),
              linear-gradient(150deg, rgba(139, 168, 136, 0.16) 0%, transparent 55%);
            background-position: 0 10px, 0 0;
          }
          /* Indicador de que hay más contenido por debajo (hace falta scroll) */
          .flip-fade {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 48px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-bottom: 4px;
            pointer-events: none;
            color: #a89a92;
          }
          .flip-fade .material-symbols-outlined {
            font-size: 20px;
            animation: flipFadeBounce 1.6s ease-in-out infinite;
          }
          .flip-fade-front {
            background: linear-gradient(to bottom, rgba(253, 246, 243, 0) 0%, #fdf6f3 80%);
          }
          .flip-fade-back {
            background: linear-gradient(to bottom, rgba(241, 246, 240, 0) 0%, #f1f6f0 80%);
            color: #93a892;
          }
          @keyframes flipFadeBounce {
            0%, 100% { transform: translateY(0); opacity: 0.7; }
            50% { transform: translateY(3px); opacity: 1; }
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
  const deckHue = resolveColor(deckColor)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#FAF7F4] text-[#7D8A96]">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(125,138,150,0.06) 31px 32px)',
        }}
      />
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] z-0 h-[26rem] w-[26rem] rounded-full bg-[#E8A598]/12 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <Hero
          badge="Grupo de flashcards"
          badgeIcon={resolveIcon(deckIcon)}
          accent={deckHue.bg}
          title={deckName}
          aside={<CardStackArt accent={deckHue.bg} />}
          actions={
            <>
              <StickerButton icon="bolt" color={deckHue.bg} onClick={() => setShowCreate(true)}>
                Crear tarjetas
              </StickerButton>
              <GhostButton
                icon="play_arrow"
                onClick={() => void handleStartStudy()}
                disabled={cards.length === 0 || busy}
              >
                Estudiar
              </GhostButton>
            </>
          }
        >
          <nav className="mt-4 flex flex-wrap items-center gap-1.5 text-xs font-bold" aria-label="Ruta">
            <Link
              href="/flashcards"
              className="flex items-center gap-1 rounded-full border-2 border-[#EAE4E2] bg-white px-2.5 py-1 text-[#7D8A96] transition-colors hover:border-[#2c3e50] hover:text-[#2C3E50]"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Mis flashcards
            </Link>
          </nav>

          {cards.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <StatChip value={cards.length} label={cards.length === 1 ? 'tarjeta' : 'tarjetas'} color={deckHue.bg} />
            </div>
          ) : null}
        </Hero>

        {error ? (
          <p className="rounded-2xl border-2 border-[#E8A598]/40 bg-[#FFF8F6] px-4 py-3 text-sm font-semibold text-[#C4655A]">
            {error}
          </p>
        ) : null}

        {/* Lista de tarjetas */}
        <section>
          <SectionLabel>
            {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
          </SectionLabel>

          {cards.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-[#D8CDC7] bg-white/60 p-12 text-center">
              <CardStackArt accent={deckHue.bg} />
              <p className="text-lg font-black text-[#2C3E50]">Aún no hay tarjetas</p>
              <p className="text-sm">Pulsa «Crear tarjetas» para empezar.</p>
              <StickerButton icon="bolt" color={deckHue.bg} onClick={() => setShowCreate(true)}>
                Crear tarjetas
              </StickerButton>
            </div>
          ) : (
            <ul className="space-y-3">
              {cards.map((card) => (
                <li
                  key={card.itemId}
                  className="relative overflow-hidden rounded-2xl border-2 border-[#2c3e50] p-4 transition-transform hover:-translate-y-0.5"
                  style={{ ...tintedPaper(deckHue.bg), boxShadow: '4px 4px 0 0 #2c3e50' }}
                >
                  {editingId === card.flashcardId ? (
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#7D8A96]/70">Anverso</span>
                            <CharCounter length={editFront.length} />
                          </div>
                          <textarea
                            value={editFront}
                            onChange={(e) => setEditFront(e.target.value)}
                            rows={3}
                            className={`w-full resize-y rounded-xl border bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888] focus:bg-white ${
                              editFrontOver ? 'border-[#E8A598]' : 'border-[#EAE4E2]'
                            }`}
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs font-semibold text-[#7D8A96]/70">Reverso</span>
                            <CharCounter length={editBack.length} />
                          </div>
                          <textarea
                            value={editBack}
                            onChange={(e) => setEditBack(e.target.value)}
                            rows={3}
                            className={`w-full resize-y rounded-xl border bg-[#FAF7F4] px-3 py-2 text-sm outline-none focus:border-[#8BA888] focus:bg-white ${
                              editBackOver ? 'border-[#E8A598]' : 'border-[#EAE4E2]'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(card)}
                          disabled={savingEdit || !editFront.trim() || !editBack.trim() || editFrontOver || editBackOver}
                          className="rounded-lg bg-[#8BA888] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {savingEdit ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-[#EAE4E2] px-4 py-2 text-sm font-semibold text-[#7D8A96] hover:border-slate-300"
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
                            <p className="whitespace-pre-wrap break-words text-sm font-semibold text-[#2C3E50]">
                              {card.front}
                            </p>
                          </div>
                          <div className="min-w-0 md:border-l md:border-[#EFE7E3] md:pl-3">
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#7FA07B]">
                              Reverso
                            </span>
                            <p className="whitespace-pre-wrap break-words text-sm text-[#7D8A96]">
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
