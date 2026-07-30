'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createRoom, joinRoom } from '@/lib/versus/queries'
import { VersusError } from '@/lib/versus/types'

// El PIN se dicta en voz alta y se teclea en un móvil, así que el alfabeto no
// tiene caracteres ambiguos (ni O/0, ni I/1/L). Aquí solo se filtra lo que el
// usuario escribe; la validación de verdad la hace el backend.
const PIN_ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g

export default function VersusEntry() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleError(err: unknown) {
    if (err instanceof VersusError && err.code === 'USERNAME_REQUIRED') {
      router.push('/onboarding')
      return
    }
    setError(err instanceof Error ? err.message : 'Algo ha ido mal. Inténtalo de nuevo.')
  }

  async function handleCreate() {
    setBusy('create')
    setError(null)
    try {
      const { room } = await createRoom('classic')
      router.push(`/versus/${room.pin}`)
    } catch (err) {
      handleError(err)
      setBusy(null)
    }
  }

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault()
    if (pin.length !== 6) return

    setBusy('join')
    setError(null)
    try {
      const { room } = await joinRoom(pin)
      router.push(`/versus/${room.pin}`)
    } catch (err) {
      handleError(err)
      setBusy(null)
    }
  }

  return (
    <section className="mb-12">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        {/* Crear sala */}
        <article className="flex flex-col rounded-2xl border border-[#E8A598]/30 bg-gradient-to-br from-white to-[#fff5f2] p-6 shadow-sm">
          <div className="mb-4 w-fit rounded-xl bg-[#E8A598] p-3 text-white">
            <span className="material-symbols-outlined text-2xl">add_circle</span>
          </div>
          <h3 className="mb-2 text-xl font-bold text-[#2c3e50]">Crear una sala</h3>
          <p className="mb-5 flex-1 text-sm leading-relaxed">
            Abres la sala, compartes el código de 6 caracteres y quien lo tenga
            entra. Nadie puede colarse sin él.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy !== null}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#E8A598] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#E8A598]/20 transition-colors hover:bg-[#d18d80] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">meeting_room</span>
            {busy === 'create' ? 'Creando…' : 'Crear sala'}
          </button>
        </article>

        {/* Unirse */}
        <article className="flex flex-col rounded-2xl border border-[#7D8A96]/25 bg-gradient-to-br from-white to-[#f5f7f9] p-6 shadow-sm">
          <div className="mb-4 w-fit rounded-xl bg-[#7D8A96] p-3 text-white">
            <span className="material-symbols-outlined text-2xl">login</span>
          </div>
          <h3 className="mb-2 text-xl font-bold text-[#2c3e50]">Entrar con código</h3>
          <p className="mb-5 flex-1 text-sm leading-relaxed">
            ¿Te han pasado un código? Escríbelo aquí para unirte a la sala.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.toUpperCase().replace(PIN_ALPHABET, '').slice(0, 6))
              }
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Código de sala"
              className="w-full rounded-xl border-2 border-[#EAE4E2] bg-white px-4 py-3 text-center font-mono text-lg font-bold tracking-[0.3em] text-[#2c3e50] outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-[#7D8A96]/40 focus:border-[#7D8A96]/60 sm:flex-1"
            />
            <button
              type="submit"
              disabled={pin.length !== 6 || busy !== null}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#7D8A96] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#7D8A96]/15 transition-colors hover:bg-[#6c7985] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'join' ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </article>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#C4655A]/25 bg-[#C4655A]/8 px-4 py-3 text-sm font-medium text-[#C4655A]"
        >
          {error}
        </p>
      ) : null}
    </section>
  )
}
