'use client'

// Modal para crear o editar una asignatura de flashcards (nombre + color + icono).

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  createFlashcardDeck,
  updateFlashcardDeck,
  type FlashcardDeck,
} from '@/lib/studioFlashcards'
import { DEFAULT_COLOR_KEY, DEFAULT_ICON, SUBJECT_COLORS, SUBJECT_ICONS, resolveColor } from '@/lib/flashcardTheme'

export default function SubjectModal({
  token,
  existing,
  onSaved,
  onClose,
}: {
  token: string
  existing?: { id: string; name: string; color?: string | null; icon?: string | null }
  onSaved: (deck: FlashcardDeck) => void
  onClose: () => void
}) {
  const isEdit = Boolean(existing)
  const [name, setName] = useState(existing?.name ?? '')
  const [colorKey, setColorKey] = useState(existing?.color ?? DEFAULT_COLOR_KEY)
  const [icon, setIcon] = useState(existing?.icon ?? DEFAULT_ICON)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const color = resolveColor(colorKey)

  const save = async () => {
    if (saving) return
    if (name.trim().length < 3) {
      setError('El nombre necesita al menos 3 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const deck = isEdit
        ? await updateFlashcardDeck(token, existing!.id, { name, color: colorKey, icon })
        : await createFlashcardDeck(token, { name, color: colorKey, icon })
      onSaved(deck)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la asignatura.')
    } finally {
      setSaving(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-[#2c3e50]/45 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border-2 border-[#2c3e50] bg-white"
        style={{ boxShadow: '7px 7px 0 0 #2c3e50' }}
      >
        {/* Previsualización */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ background: color.soft }}>
          <span
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: color.bg }}
          >
            <span className="material-symbols-outlined text-3xl">{icon}</span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: color.text }}>
              {isEdit ? 'Editar asignatura' : 'Nueva asignatura'}
            </p>
            <p className="truncate text-lg font-black text-[#2C3E50]">
              {name.trim() || 'Sin nombre'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#7D8A96]/70">Nombre</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save()
                }
              }}
              placeholder="p. ej. Cardiología"
              className="w-full rounded-xl border border-[#EAE4E2] bg-[#FAF7F4] px-3 py-2.5 text-sm outline-none transition focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[#7D8A96]/70">Color</label>
            <div className="flex flex-wrap gap-2.5">
              {SUBJECT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-label={c.label}
                  onClick={() => setColorKey(c.key)}
                  className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                    colorKey === c.key ? 'ring-2 ring-offset-2' : ''
                  }`}
                  style={{ background: c.bg, boxShadow: colorKey === c.key ? `0 0 0 2px #fff, 0 0 0 4px ${c.ring}` : undefined }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold text-[#7D8A96]/70">Icono</label>
            <div className="grid grid-cols-8 gap-2">
              {SUBJECT_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`flex h-9 items-center justify-center rounded-lg border transition ${
                    icon === ic ? 'border-transparent text-white' : 'border-[#EAE4E2] text-[#7D8A96] hover:bg-[#F7F4F2]'
                  }`}
                  style={icon === ic ? { background: color.bg } : undefined}
                >
                  <span className="material-symbols-outlined text-[20px]">{ic}</span>
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="text-sm font-medium text-[#C4655A]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#EAE4E2] bg-white px-4 py-2.5 text-sm font-semibold text-[#2C3E50] transition hover:bg-[#F7F4F2]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || name.trim().length < 3}
              className="rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: color.bg }}
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear asignatura'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
