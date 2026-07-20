'use client'

// Modal de creación rápida de tarjetas.
//  - Tema opcional (persiste entre tarjetas de la sesión).
//  - Enter en anverso -> pasa a reverso. Enter en reverso -> guarda y abre otra
//    tarjeta vacía (foco en anverso). Shift+Enter = salto de línea.
//  - Solo se sale con Escape o el botón Cerrar; si hay contenido sin guardar,
//    se pide confirmación en el propio modal.
//  - Respeta el tope máximo de tarjetas por asignatura.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { createFlashcard, type Flashcard } from '@/lib/studioFlashcards'
import { resolveColor } from '@/lib/flashcardTheme'

export default function FlashcardCreateModal({
  token,
  deckId,
  subjectName,
  colorKey,
  initialTopic = '',
  initialCount,
  max = 500,
  onCreated,
  onClose,
}: {
  token: string
  deckId: string
  subjectName?: string
  colorKey?: string | null
  initialTopic?: string
  initialCount: number
  max?: number
  onCreated?: (card: Flashcard) => void
  onClose: () => void
}) {
  const color = resolveColor(colorKey)
  const [topic, setTopic] = useState(initialTopic)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [count, setCount] = useState(initialCount)
  const [createdHere, setCreatedHere] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const frontRef = useRef<HTMLTextAreaElement | null>(null)
  const backRef = useRef<HTMLTextAreaElement | null>(null)

  const full = count >= max
  const hasContent = front.trim().length > 0 || back.trim().length > 0

  useEffect(() => {
    const t = setTimeout(() => frontRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  const attemptClose = () => {
    if (hasContent) setConfirmClose(true)
    else onClose()
  }

  // Escape global -> intento de cierre
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (confirmClose) setConfirmClose(false)
        else attemptClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, hasContent])

  const save = async () => {
    if (saving || full) return
    if (!front.trim() || !back.trim()) {
      setError('Rellena anverso y reverso.')
      if (!front.trim()) frontRef.current?.focus()
      else backRef.current?.focus()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const card = await createFlashcard(token, deckId, {
        front,
        back,
        topic: topic.trim() || undefined,
      })
      onCreated?.(card)
      setCount((c) => c + 1)
      setCreatedHere((c) => c + 1)
      setFront('')
      setBack('')
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 900)
      frontRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la tarjeta.')
    } finally {
      setSaving(false)
    }
  }

  const onFrontKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      backRef.current?.focus()
    }
  }
  const onBackKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void save()
    }
  }

  const body = (
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={attemptClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between gap-3 px-6 py-4" style={{ background: color.soft }}>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: color.bg }}
            >
              <span className="material-symbols-outlined text-xl">bolt</span>
            </span>
            <div>
              <h2 className="text-base font-black" style={{ color: color.text }}>
                Crear tarjetas
              </h2>
              {subjectName ? (
                <p className="text-xs font-semibold text-slate-500">{subjectName}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/60 hover:text-slate-800"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          {/* Tema opcional */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <span className="material-symbols-outlined text-[16px]">sell</span>
              Tema (opcional · se aplica a las que crees ahora)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="p. ej. Insuficiencia cardíaca"
              className="w-full rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none transition focus:bg-white"
              style={{ borderColor: undefined }}
            />
          </div>

          {full ? (
            <div className="rounded-xl border border-[#E8A598]/40 bg-[#FFF8F6] px-4 py-3 text-sm font-medium text-[#C4655A]">
              Has alcanzado el límite de {max} tarjetas en esta asignatura.
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Anverso</label>
                <textarea
                  ref={frontRef}
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  onKeyDown={onFrontKey}
                  rows={3}
                  placeholder="Pregunta o concepto"
                  className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none transition focus:bg-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-400">Reverso</label>
                <textarea
                  ref={backRef}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  onKeyDown={onBackKey}
                  rows={3}
                  placeholder="Respuesta o explicación"
                  className="w-full resize-y rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2 text-sm outline-none transition focus:bg-white"
                />
              </div>
            </>
          )}

          {error ? <p className="text-sm font-medium text-[#C4655A]">{error}</p> : null}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-400">
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-bold text-slate-500">Enter</kbd>{' '}
              avanza · <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-bold text-slate-500">Shift+Enter</kbd> salto de línea
            </p>
            <div className="flex items-center gap-2">
              {createdHere > 0 ? (
                <span
                  className={`text-xs font-bold transition-opacity ${justSaved ? 'opacity-100' : 'opacity-70'}`}
                  style={{ color: color.text }}
                >
                  +{createdHere} creada{createdHere === 1 ? '' : 's'}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || full || !front.trim() || !back.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: color.bg, boxShadow: `0 8px 20px -8px ${color.bg}` }}
              >
                {saving ? 'Guardando…' : 'Guardar y otra'}
                <span className="material-symbols-outlined text-lg">subdirectory_arrow_left</span>
              </button>
            </div>
          </div>
          <p className="text-right text-[11px] text-slate-400">
            {count}/{max} tarjetas
          </p>
        </div>

        {/* Confirmación de cierre con contenido sin guardar */}
        <AnimatePresence>
          {confirmClose ? (
            <motion.div
              className="absolute inset-0 z-20 flex items-center justify-center bg-white/85 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mx-6 max-w-sm rounded-2xl border border-[#EAE4E2] bg-white p-6 text-center shadow-xl">
                <span className="material-symbols-outlined text-4xl text-[#E0B15A]">warning</span>
                <h3 className="mt-2 text-lg font-bold text-slate-800">Tarjeta sin guardar</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Si sales ahora, esta tarjeta no se guardará. ¿Seguro que quieres salir?
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClose(false)}
                    className="rounded-xl border border-[#EAE4E2] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Seguir editando
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl bg-[#C4655A] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    Salir sin guardar
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(body, document.body)
}
