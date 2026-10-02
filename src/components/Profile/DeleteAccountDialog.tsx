'use client'

// Eliminar cuenta (RGPD, derecho de supresión). Pide escribir ELIMINAR para
// que no se pueda hacer de un clic sin querer; el borrado lo hace el backend
// en una sola transacción (POST /api/profile/delete-account).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { GhostButton, INK } from '@/components/Profile/ui'
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch'
import { supabase } from '@/lib/supabaseBrowser'

const PALABRA = 'ELIMINAR'

export default function DeleteAccountDialog({ onCancel }: { onCancel: () => void }) {
  const authenticatedFetch = useAuthenticatedFetch()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
  const [texto, setTexto] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const confirmado = texto.trim().toUpperCase() === PALABRA

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !borrando) onCancel()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel, borrando])

  const eliminar = async () => {
    if (!confirmado || borrando) return
    setBorrando(true)
    setError(null)
    try {
      const response = await authenticatedFetch(`${apiUrl}/api/profile/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: PALABRA }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'No se pudo eliminar la cuenta.')
      }
      await supabase.auth.signOut()
      window.location.replace('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.')
      setBorrando(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2c3e50]/45 p-4 backdrop-blur-sm"
      onClick={() => !borrando && onCancel()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Eliminar cuenta"
        className="w-full max-w-md rounded-3xl border-2 border-[#2c3e50] bg-white"
        style={{ boxShadow: `7px 7px 0 0 ${INK}` }}
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 border-b-2 border-dashed border-[#2c3e50]/25 px-6 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#2c3e50] bg-[#C4655A]">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 16 }} aria-hidden>
              delete_forever
            </span>
          </span>
          <h2 className="text-base font-black text-[#2C3E50]">Eliminar cuenta</h2>
        </div>

        <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-[#7D8A96]">
          <p>
            Se borrarán <strong className="text-[#2C3E50]">para siempre</strong> tu cuenta y todo tu
            progreso: respuestas, dailies, simulacros, mazos, flashcards, mapas, nivel y rachas. No se
            puede deshacer.
          </p>
          <div>
            <label htmlFor="confirmar-borrado" className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7D8A96]/80">
              Escribe {PALABRA} para confirmar
            </label>
            <input
              id="confirmar-borrado"
              ref={inputRef}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') eliminar()
              }}
              disabled={borrando}
              autoComplete="off"
              className="mt-1.5 w-full rounded-2xl border-2 border-[#EAE4E2] bg-white px-4 py-3 text-sm font-bold text-[#2C3E50] outline-none transition-colors focus:border-[#2c3e50]"
            />
          </div>
          {error ? (
            <p className="rounded-2xl border-2 border-[#F1D3C9] bg-[#FFF4EF] px-4 py-3 text-sm font-bold text-[#C4655A]">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t-2 border-dashed border-[#2c3e50]/25 px-6 py-4">
          <GhostButton onClick={onCancel} disabled={borrando}>
            Cancelar
          </GhostButton>
          <button
            type="button"
            onClick={eliminar}
            disabled={!confirmado || borrando}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-[#2c3e50] bg-[#C4655A] px-4 py-2.5 text-sm font-black text-white transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ boxShadow: `3px 3px 0 0 ${INK}` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17 }} aria-hidden>
              delete_forever
            </span>
            {borrando ? 'Eliminando…' : 'Eliminar mi cuenta'}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
