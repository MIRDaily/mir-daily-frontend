'use client'

// Seccion de "Grupos de flashcards" que se monta al final de la pagina de
// mazos (/decks), debajo de los mazos de preguntas. Logica autocontenida: la
// pagina solo la renderiza. Ver src/lib/studioFlashcards.ts.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DropdownMenu from '@/components/studio/DropdownMenu'
import {
  createFlashcardDeck,
  deleteFlashcardDeck,
  fetchFlashcardDecks,
  type FlashcardDeck,
} from '@/lib/studioFlashcards'

export default function FlashcardDecksSection({ token }: { token: string }) {
  const router = useRouter()
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setDecks(await fetchFlashcardDecks(token))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las flashcards.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    setError(null)
    try {
      await createFlashcardDeck(token, name)
      setNewName('')
      setShowCreate(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (deck: FlashcardDeck) => {
    if (deletingId) return
    const ok = window.confirm(`¿Enviar "${deck.name}" a la papelera? (recuperable 24h)`)
    if (!ok) return
    setDeletingId(deck.id)
    setError(null)
    // Optimista
    setDecks((prev) => prev.filter((d) => d.id !== deck.id))
    try {
      await deleteFlashcardDeck(token, deck.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el grupo.')
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-[#8BA888]">style</span>
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-800">Flashcards</h2>
            <p className="text-sm text-slate-500">
              Tus tarjetas de repaso, organizadas en grupos. No cuentan para tus estadísticas.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="shrink-0 rounded-xl bg-[#8BA888] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Crear grupo
        </button>
      </div>

      {showCreate ? (
        <div className="mb-6 rounded-2xl border border-[#EAE4E2] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreate()
                }
              }}
              placeholder="Nombre del grupo de flashcards..."
              className="h-11 flex-1 rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 text-sm outline-none focus:border-[#8BA888]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || newName.trim().length < 3}
                className="h-11 rounded-xl bg-[#8BA888] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false)
                  setNewName('')
                }}
                className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-slate-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mb-6 rounded-xl border border-[#E8A598]/30 bg-[#FFF8F6] px-4 py-3 text-sm text-[#C4655A]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-[#EAE4E2] bg-white/60" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#CBB9] bg-white/50 p-10 text-center transition-colors hover:border-[#8BA888] hover:bg-white"
        >
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#8BA888] bg-white text-3xl font-semibold leading-none text-[#8BA888]">
            +
          </span>
          <span className="text-base font-semibold text-slate-700">
            Crea tu primer grupo de flashcards
          </span>
          <span className="max-w-md text-sm text-slate-500">
            Escribe tus propias tarjetas (anverso y reverso) y repásalas con repetición espaciada.
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {decks.map((deck) => (
            <article
              key={deck.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/flashcards/${deck.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`/flashcards/${deck.id}`)
                }
              }}
              className={`group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-[#EAE4E2] bg-gradient-to-br from-white to-[#F6F4EF] p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-[#8BA888]/50 hover:shadow-lg hover:shadow-[#8BA888]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8BA888] ${
                deletingId === deck.id ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#8BA888]/10 blur-2xl transition-opacity group-hover:opacity-100"
              />
              <div className="relative z-10 flex items-start justify-between gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8BA888]/12 text-[#8BA888] shadow-sm transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined text-2xl">style</span>
                </div>
                <DropdownMenu
                  ariaLabel="Acciones del grupo"
                  items={[
                    {
                      label: 'Eliminar grupo',
                      icon: 'delete',
                      danger: true,
                      onSelect: () => void handleDelete(deck),
                    },
                  ]}
                />
              </div>

              <div className="relative z-10 mt-4">
                <h3 className="truncate text-lg font-bold text-slate-800">{deck.name}</h3>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">layers</span>
                    {deck.totalCards} {deck.totalCards === 1 ? 'tarjeta' : 'tarjetas'}
                  </span>
                  {deck.dueCards > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#E8A598]/15 px-2 py-0.5 text-xs font-bold text-[#C4655A]">
                      {deck.dueCards} por repasar
                    </span>
                  ) : deck.totalCards > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8BA888]">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Al día
                    </span>
                  ) : null}
                </div>
              </div>

              <span
                aria-hidden
                className="pointer-events-none absolute bottom-4 right-4 z-10 flex h-8 w-8 translate-x-1 items-center justify-center rounded-full bg-[#8BA888] text-white opacity-0 shadow-md transition-all group-hover:translate-x-0 group-hover:opacity-100"
              >
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
